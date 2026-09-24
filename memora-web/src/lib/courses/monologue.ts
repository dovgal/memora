// Рассказ о себе: чистая логика вокруг записи и разбора.
//
// Вынесено из компонента, потому что здесь решается самое дорогое: что мы
// считаем сказанным. Длинную запись распознаём кусками, и на тишине между
// фразами модель распознавания любит досочинять («Sous-titres réalisés par…»).
// Если такой кусок попадёт в разбор, человека отругают за чужие слова.

/** Слово распознавания с метками времени — секунды от начала ВСЕЙ записи. */
export interface TimedWord {
  word: string;
  start: number;
  end: number;
  probability: number;
}

/** Распознанный кусок записи. offset — где он начался, в секундах. */
export interface ChunkTranscript {
  index: number;
  offset: number;
  text: string;
  /** Метки времени — от начала куска, как их вернул сервис. */
  words: TimedWord[];
  noSpeechProb: number;
  avgLogprob: number;
}

export const DEFAULT_MIN_SECONDS = 30;
export const DEFAULT_MAX_SECONDS = 150;

/** Пределы записи из упражнения — с защитой от опечаток в данных курса. */
export function recordingLimits(ex: { minSeconds?: number; maxSeconds?: number }): { min: number; max: number } {
  const max = clampNumber(ex.maxSeconds, 30, 300, DEFAULT_MAX_SECONDS);
  const min = clampNumber(ex.minSeconds, 5, max, Math.min(DEFAULT_MIN_SECONDS, max));
  return { min, max };
}

function clampNumber(v: number | undefined, lo: number, hi: number, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

/** 65 → «1:05». */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}'’-]+/u)
    .map(w => w.replace(/^['’-]+|['’-]+$/g, ''))
    .filter(Boolean);
}

export const countWords = (text: string) => words(text).length;

/**
 * Зацикливание: одна тройка слов раз за разом или почти нет разных слов.
 * Так выглядит распознавание шума, а не речь, даже очень неуверенная.
 */
export function looksLikeLoop(text: string): boolean {
  const w = words(text);
  if (w.length < 12) return false;
  const counts = new Map<string, number>();
  for (let i = 0; i + 2 < w.length; i++) {
    const key = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const top = Math.max(0, ...counts.values());
  if (top >= 4 && top * 3 * 2 >= w.length) return true;
  return w.length >= 20 && new Set(w).size * 5 < w.length;
}

/**
 * Что модель распознавания выдаёт на тишине и шуме. Это титры и концовки
 * роликов, на которых её учили, — в рассказе о себе их не бывает.
 */
const PHANTOM_PHRASES = [
  'sous-titres', 'sous-titrage', 'amara.org', "merci d'avoir regardé", 'abonnez-vous',
  "n'oubliez pas de vous abonner", 'merci de votre visionnage',
];

const NO_SPEECH = 0.6;
const WEAK_LOGPROB = -0.7;
const LOW_LOGPROB = -1.2;
const LOW_WORD_CONFIDENCE = 0.4;

/** Кусок, которому верить нельзя: модель сама сомневается или досочинила. */
export function isPhantomChunk(c: ChunkTranscript): boolean {
  const text = c.text.trim().toLowerCase().replace(/’/g, "'");
  if (!text) return true;
  if (PHANTOM_PHRASES.some(p => text.includes(p))) return true;
  // По отдельности «речи нет» бывает и на длинной паузе посреди настоящей
  // речи, поэтому верим ему только вместе с неправдоподобным текстом.
  if (c.noSpeechProb > NO_SPEECH && c.avgLogprob !== 0 && c.avgLogprob < WEAK_LOGPROB) return true;
  if (c.avgLogprob !== 0 && c.avgLogprob < LOW_LOGPROB) return true;
  if (looksLikeLoop(text)) return true;
  if (c.words.length > 0) {
    const mean = c.words.reduce((s, w) => s + w.probability, 0) / c.words.length;
    if (mean < LOW_WORD_CONFIDENCE) return true;
  }
  return false;
}

/** Склеить куски по порядку, выбросив сомнительные; метки времени — от начала записи. */
export function mergeChunks(chunks: ChunkTranscript[]): { text: string; words: TimedWord[]; dropped: number } {
  const sorted = [...chunks].sort((a, b) => a.index - b.index);
  const kept = sorted.filter(c => !isPhantomChunk(c));
  return {
    text: kept.map(c => c.text.trim()).filter(Boolean).join(' '),
    words: kept.flatMap(c => c.words.map(w => ({ ...w, start: w.start + c.offset, end: w.end + c.offset }))),
    dropped: sorted.length - kept.length,
  };
}

export interface PickedTranscript {
  text: string;
  words: TimedWord[];
  /** Кто распознал: наш сервис, браузер или никто. */
  source: 'server' | 'browser' | 'none';
  /** Сколько кусков выброшено как шум. */
  dropped: number;
  /** Сервис распознал не все куски — текст может быть неполным. */
  partial: boolean;
}

/**
 * Какому распознаванию верить.
 *
 * Сервис точнее и слушает выбранный нами микрофон, поэтому главный — он.
 * Браузер — страховка: сервис может быть не настроен, не ответить на часть
 * кусков или счесть тихую речь тишиной. Тогда берём того, кто услышал больше.
 */
export function pickTranscript(opts: {
  chunks: ChunkTranscript[];
  /** Сколько кусков отправляли на распознавание. */
  expected: number;
  browserText: string;
}): PickedTranscript {
  const merged = mergeChunks(opts.chunks);
  const browser = opts.browserText.trim();
  const serverWords = countWords(merged.text);
  const browserWords = countWords(browser);
  const complete = opts.expected > 0 && opts.chunks.length >= opts.expected;

  const useBrowser = browserWords > 0 && (
    // Сервис ответил не на всё — берём того, кто услышал больше.
    (!complete && browserWords >= serverWords)
    // Сервис счёл почти всё тишиной, а браузер слышал рассказ: вероятнее,
    // голос просто тихий, чем браузер выдумал пять слов из ничего.
    || (serverWords < 3 && browserWords >= 5)
  );
  if (useBrowser) {
    return { text: browser, words: [], source: 'browser', dropped: merged.dropped, partial: false };
  }
  if (serverWords > 0) {
    return { text: merged.text, words: merged.words, source: 'server', dropped: merged.dropped, partial: !complete };
  }
  return { text: '', words: [], source: 'none', dropped: merged.dropped, partial: false };
}

const MIN_REVIEW_WORDS = 5;
/** Быстрее этого начинающий не говорит; такой плотный текст — досочинённый. */
const MAX_PLAUSIBLE_WPM = 250;

/**
 * Причина не отправлять рассказ на разбор, или null — можно разбирать.
 * Лучше честно сказать «не расслышали», чем разбирать чужие слова.
 */
export function refusalReason(text: string, durationSeconds: number, spoken: boolean): string | null {
  const n = countWords(text);
  if (n < MIN_REVIEW_WORDS) {
    return spoken
      ? 'Почти ничего не расслышали. Проверьте микрофон и расскажите ещё раз — или напишите ответ.'
      : 'Слишком коротко — напишите хотя бы пару предложений.';
  }
  if (looksLikeLoop(text)) {
    return 'Похоже, распознавание приняло шум за речь. Запишите ещё раз ближе к микрофону.';
  }
  if (spoken && durationSeconds >= 20 && (n * 60) / durationSeconds > MAX_PLAUSIBLE_WPM) {
    return 'Распознано подозрительно много слов для такой записи — похоже на помехи. Запишите ещё раз.';
  }
  return null;
}

// ---------- Разбор ----------

export type ErrorKind = 'grammar' | 'vocabulary' | 'pronunciation' | 'other';

export interface MonologueReview {
  overall: string;
  goalsCovered: { goal: string; covered: boolean; note: string }[];
  errors: { quote: string; correction: string; explanation: string; kind: ErrorKind }[];
  betterVersion: string;
  usefulPhrases: { fr: string; ru: string }[];
  /** 1–5; ноль — оценки нет. */
  scores: { content: number; grammar: number; vocabulary: number; fluency: number };
  nextStep: string;
  fluency: {
    words: number;
    durationSeconds: number;
    wordsPerMinute: number | null;
    fillers: number;
    fillerWords: { word: string; count: number }[];
    repetitions: number;
    longPauses: number | null;
    longestPauseSeconds: number | null;
  };
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? v as Record<string, unknown> : {});
const KINDS: ErrorKind[] = ['grammar', 'vocabulary', 'pronunciation', 'other'];

/** Привести ответ сервера к виду, который не уронит экран разбора. */
export function normalizeReview(raw: unknown): MonologueReview {
  const r = obj(raw);
  const s = obj(r.scores);
  const f = obj(r.fluency);
  return {
    overall: str(r.overall),
    goalsCovered: arr(r.goalsCovered).map(obj)
      .map(g => ({ goal: str(g.goal), covered: g.covered === true, note: str(g.note) }))
      .filter(g => g.goal),
    errors: arr(r.errors).map(obj)
      .map(e => ({
        quote: str(e.quote),
        correction: str(e.correction),
        explanation: str(e.explanation),
        kind: (KINDS as string[]).includes(str(e.kind)) ? str(e.kind) as ErrorKind : 'other' as const,
      }))
      .filter(e => e.quote && e.correction),
    betterVersion: str(r.betterVersion),
    usefulPhrases: arr(r.usefulPhrases).map(obj)
      .map(p => ({ fr: str(p.fr), ru: str(p.ru) }))
      .filter(p => p.fr),
    scores: {
      content: num(s.content), grammar: num(s.grammar), vocabulary: num(s.vocabulary), fluency: num(s.fluency),
    },
    nextStep: str(r.nextStep),
    fluency: {
      words: num(f.words),
      durationSeconds: num(f.durationSeconds),
      wordsPerMinute: numOrNull(f.wordsPerMinute),
      fillers: num(f.fillers),
      fillerWords: arr(f.fillerWords).map(obj).map(x => ({ word: str(x.word), count: num(x.count) })).filter(x => x.word),
      repetitions: num(f.repetitions),
      longPauses: numOrNull(f.longPauses),
      longestPauseSeconds: numOrNull(f.longestPauseSeconds),
    },
  };
}

/**
 * Тело ответа разбора. Долгий разбор сервер держит пробелами, чтобы прокси
 * не оборвал соединение, а ошибку тогда пишет в поле error при статусе 200.
 */
export function parseReviewBody(status: number, body: string): { review: MonologueReview } | { error: string } {
  let data: unknown = null;
  try { data = JSON.parse(body.trim()); } catch { /* ниже — общий ответ */ }
  const error = str(obj(data).error);
  if (error) return { error };
  if (status < 200 || status >= 300 || !data) {
    return { error: status === 429 ? 'Слишком много проверок подряд — подождите минуту.' : `Проверка не ответила (${status}).` };
  }
  const review = normalizeReview(data);
  if (!review.overall && !review.betterVersion) return { error: 'Проверка вернула пустой разбор — попробуйте ещё раз.' };
  return { review };
}

/** Короткая реплика лисёнку по итогам: хвалим всегда, громче — за хороший рассказ. */
export function foxLine(review: MonologueReview): string {
  const s = review.scores;
  const given = [s.content, s.grammar, s.vocabulary, s.fluency].filter(x => x > 0);
  const avg = given.length ? given.reduce((a, b) => a + b, 0) / given.length : 0;
  const covered = review.goalsCovered.filter(g => g.covered).length;
  if (avg >= 4) return 'Отличный рассказ! Так и говорите на собеседовании';
  if (review.goalsCovered.length && covered === review.goalsCovered.length) return 'Всё главное сказали — теперь шлифуем';
  if (avg >= 3) return 'Хорошо получилось! Посмотрим, что подправить';
  return 'Вы рассказали — это главное. Разберём по шагам';
}
