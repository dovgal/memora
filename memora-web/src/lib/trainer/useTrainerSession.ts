'use client';
// Оркестратор занятия «Заучивание»: тянет данные, планирует состав и очередь,
// резолвит задание под каждый пункт очереди, проверяет ответ, отправляет
// рейтинг в FSRS и событие в игровой слой, вставляет карточку обратно при
// промахе, считает сводку под конец.
//
// Вся логика планирования/лесенки/рейтинга/переучивания/сводки — чистые
// функции из соседних файлов (planner, ladder, queue, rating, relearn,
// coaching), проверенные node:test. Этот хук — единственное место, где они
// соединяются с сетью, таймерами и React-состоянием, поэтому сам он юнит-тестами
// не покрыт.
//
// Скорость: занятие стартует, как только известны набор и состояние FSRS.
// Серверные упражнения ждём не дольше трёх секунд — сервер на новых карточках
// зовёт LLM, и это может длиться до двадцати секунд. Не дождались — начинаем на
// безопасных локальных, а серверные подмешиваются в ещё не показанные пункты,
// когда придут (и дозапрашиваются в фоне, пока сервер говорит pending > 0).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { FieldSchema, FlashcardResponse, SetResponse } from '@/types/schema';
import type { CardProfile, ExerciseKind, PreparedSet, TrainerExercise } from '@/lib/contracts/trainer';
import { reportStudyEvent, type GameUpdate } from '@/lib/game/client';
import { parseRange, selectCards } from '@/lib/studySelection';
import { checkWrittenAnswer, getCardText } from '@/lib/studyUtils';
import { checkProduction } from '@/lib/courses/productionApi';
import { checkDictation } from '@/lib/courses/dictation';
import { prefetchAudio } from './prefetch';
import { playTrainerAudio, stopTrainerAudio } from './audio';
import { fetchMnemonic, prepareTrainerSet } from './api';
import { trainerToken } from './authToken';
import { fetchFsrsState, submitFsrsReview, type FsrsReviewResult } from './fsrsApi';
import { newCardsLeft, planSession } from './planner';
import { buildSessionQueue, repickUpcoming } from './queue';
import { scheduleRelearn, shouldRelearn, shouldShowMnemonic } from './relearn';
import { classifyResponseTime, GOOD, mapOutcomeToRating } from './rating';
import { coachingHeading, coachingNextStep } from './coaching';
import { buildLocalExercise, shuffled, type TrainerTask } from './localExercises';
import { languageCodeForSide, targetSide, type Side, type SideLangs } from './lang';
import { loadTrainerSettings, saveTrainerSettings } from './settings';
import {
  DEFAULT_TRAINER_SETTINGS,
  type AnswerDirection,
  type CardSchedule,
  type FsrsRating,
  type GradingMode,
  type PlannedCard,
  type SessionItem,
  type TrainerSettings,
} from './types';

/** Виды, которые сервер делает лучше клиента: осмысленные приманки, род, грамматика, фраза. */
const SERVER_PREFERRED: ReadonlySet<ExerciseKind> = new Set(['recognize', 'gender', 'cloze', 'conjugate', 'build']);
const LOCAL_KINDS: ReadonlySet<ExerciseKind> = new Set(['recognize', 'recall', 'listen', 'speak']);
function isLocalKind(k: ExerciseKind): k is 'recognize' | 'recall' | 'listen' | 'speak' {
  return LOCAL_KINDS.has(k);
}

/** Пороги «быстро/медленно» на вид задания: у речи и построения фразы время естественно другое. */
const TIMING: Record<ExerciseKind, { fastMs: number; slowMs: number }> = {
  recognize: { fastMs: 2500, slowMs: 9000 },
  gender: { fastMs: 2000, slowMs: 8000 },
  recall: { fastMs: 3500, slowMs: 15000 },
  listen: { fastMs: 4000, slowMs: 16000 },
  conjugate: { fastMs: 3500, slowMs: 15000 },
  cloze: { fastMs: 3500, slowMs: 15000 },
  speak: { fastMs: 6000, slowMs: 20000 },
  build: { fastMs: 15000, slowMs: 45000 },
};

/**
 * Сколько ждём серверные упражнения перед стартом. Сервер тратит на LLM до
 * ~18 с за вызов — столько держать ребёнка перед спиннером нельзя. Не успел —
 * начинаем на локальных, а пришедшее позже подмешиваем в следующие пункты.
 */
const PREPARE_HEAD_START_MS = 3000;
/** LLM-карточек за вызов: сервер всё равно укладывается в ~18 с и остаток отдаёт в pending. */
const PREPARE_LIMIT = 4;
/** Пауза между фоновыми дозапросами: лимит — пять вызовов ИИ в минуту на человека, общий с мнемоникой и проверкой фраз. */
const PREPARE_INTERVAL_MS = 15_000;
const PREPARE_MAX_CALLS = 6;

/** Стабильный «случайный» выбор стороны для mixed-направления: не мигает при перерисовке. */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function promptSideFor(item: SessionItem, urlAsk: 'front' | 'back' | null, direction: AnswerDirection): Side {
  // ask=back — курс просит спрашивать оборот (формы по инфинитиву), как в прежнем режиме.
  if (urlAsk === 'back') return 'front';
  if (urlAsk === 'front') return 'back';
  if (direction === 'front-to-back') return 'front';
  if (direction === 'back-to-front') return 'back';
  return hashSeed(`${item.cardId}:${item.kind}:${item.attempt}`) % 2 === 0 ? 'front' : 'back';
}

function itemKey(item: SessionItem): string {
  return `${item.cardId}:${item.kind}:${item.attempt}:${item.followUp ? 'f' : ''}`;
}

function isWrittenCorrect(raw: string, exercise: TrainerExercise, mode: GradingMode): boolean {
  const candidates = exercise.acceptedAnswers.length > 0 ? exercise.acceptedAnswers : [exercise.answer];
  return candidates.some(c => checkWrittenAnswer(raw, c, mode));
}

/**
 * Оценка сказанного: доля слов эталона, которые распознавание услышало, с
 * учётом французских омофонов (checkDictation в режиме речи). Короткое —
 * до трёх слов — должно прозвучать целиком; длиннее прощаем четверть:
 * распознавание само теряет служебные слова, и это не ошибка ученика.
 */
function speechScore(heard: string, exercise: TrainerExercise): { correct: boolean; score: number } {
  const candidates = exercise.acceptedAnswers.length > 0 ? exercise.acceptedAnswers : [exercise.answer];
  let best = 0;
  for (const target of [exercise.answer, ...candidates]) {
    const check = checkDictation(target, heard, { spoken: true });
    if (check.total > 0) best = Math.max(best, check.correct / check.total);
    if (checkWrittenAnswer(heard, target, 'soft')) best = 1;
  }
  const words = exercise.answer.trim().split(/\s+/).length;
  return { correct: words <= 3 ? best >= 1 : best >= 0.75, score: best };
}

/** Серверные варианты без повторов (приманка, совпадающая с ответом, — худший вопрос). */
function dedupOptions(ex: TrainerExercise): string[] | null | undefined {
  if (!ex.options) return ex.options;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of [ex.answer, ...ex.options]) {
    const k = o.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return ex.kind === 'gender' ? ex.options.filter(o => out.includes(o)) : shuffled(out);
}

function recorderAvailable(): boolean {
  return typeof window !== 'undefined'
    && 'MediaRecorder' in window
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface WeakCard {
  cardId: string;
  /** Текст на изучаемом языке — его и даём прослушать. */
  text: string;
  translation: string;
  lang: string;
  side: Side;
  misses: number;
}

export interface SessionSummary {
  heading: string;
  accuracy: number;
  answered: number;
  minutes: number;
  cardsMovedUp: number;
  weakCards: WeakCard[];
  dueTomorrow: number;
  nextStep: string;
}

export interface AnswerFeedback {
  /** Проверка по смыслу не ответила — ответ не засчитан ни в плюс, ни в минус. */
  unchecked?: boolean;
  corrected?: string;
  explanation?: string;
  /** Для речи: что услышало распознавание и насколько совпало. */
  heard?: string;
  score?: number;
}

export interface CoachingState {
  loading: boolean;
  mnemonic: string | null;
  example: { text: string; translation: string } | null;
}

export type TrainerStatus = 'loading' | 'ready' | 'finishing' | 'finished' | 'empty' | 'error';

export function useTrainerSession(setId: string) {
  const { status: sessionStatus } = useSession();

  const [status, setStatus] = useState<TrainerStatus>('loading');
  const [set, setSet] = useState<SetResponse | null>(null);
  const [settings, setSettingsState] = useState<TrainerSettings>(DEFAULT_TRAINER_SETTINGS);
  const [queue, setQueue] = useState<SessionItem[]>([]);
  const [index, setIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [coaching, setCoaching] = useState<CoachingState | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [combo, setCombo] = useState(0);
  const [xpFloat, setXpFloat] = useState<{ amount: number; id: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastAnswerText, setLastAnswerText] = useState('');
  const [grading, setGrading] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [backLink, setBackLink] = useState<string | null>(null);
  // Счётчик перерисовки: данные занятия живут в ref (их меняют фоновые
  // загрузки), и когда они меняются, текущее задание нужно пересобрать.
  const [, setTick] = useState(0);

  const startedForIdRef = useRef<string | null>(null);
  const sessionTokenRef = useRef(0);
  const cardsByIdRef = useRef<Map<string, FlashcardResponse>>(new Map());
  const allCardsRef = useRef<FlashcardResponse[]>([]);
  const schemaRef = useRef<FieldSchema[] | undefined>(undefined);
  const plannedRef = useRef<Map<string, PlannedCard>>(new Map());
  const profilesByIdRef = useRef<Map<string, CardProfile>>(new Map());
  const exercisesByKeyRef = useRef<Map<string, TrainerExercise[]>>(new Map());
  const exerciseCacheRef = useRef<Map<string, TrainerTask>>(new Map());
  const mnemonicPromisesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const urlAskRef = useRef<'front' | 'back' | null>(null);
  const settingsRef = useRef<TrainerSettings>(DEFAULT_TRAINER_SETTINGS);
  const speechOkRef = useRef(false);
  const queueRef = useRef<SessionItem[]>([]);
  const indexRef = useRef(0);
  const answeredRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uiTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const startedAtRef = useRef(0);
  const itemStartedAtRef = useRef(0);
  const statsRef = useRef({ answered: 0, correct: 0, combo: 0, newLeft: 0, practice: false });
  const missesByCardRef = useRef<Map<string, number>>(new Map());
  const lastReviewRef = useRef<Map<string, { rating: FsrsRating; result: FsrsReviewResult | null }>>(new Map());
  const pendingReviewsRef = useRef<Set<Promise<unknown>>>(new Set());
  const distinctCardsRef = useRef<Set<string>>(new Set());

  const langsFor = useCallback((cardId: string): SideLangs | undefined => {
    const p = profilesByIdRef.current.get(cardId);
    return p ? { front: p.langFront, back: p.langBack } : undefined;
  }, []);

  /** Какие виды заданий доступны карточке: серверные + безопасные локальные, с учётом звука и микрофона. */
  const availableKindsFor = useCallback((cardId: string): ReadonlySet<ExerciseKind> => {
    const result = new Set<ExerciseKind>();
    const card = cardsByIdRef.current.get(cardId);
    if (!card) return result;
    const schema = schemaRef.current;
    const all = allCardsRef.current;
    const langs = langsFor(cardId);
    const fixedAsk = urlAskRef.current !== null;

    if (buildLocalExercise(card, all, 'recall', 'front', schema, langs)) result.add('recall');
    if (buildLocalExercise(card, all, 'recognize', 'front', schema, langs)) result.add('recognize');
    // Курс с закреплённым направлением (глаголы: ask=back) спрашивает только
    // письменно и выбором — как прежний режим; слух и речь там не к месту.
    if (fixedAsk) return result;

    if (settingsRef.current.sound && buildLocalExercise(card, all, 'listen', 'front', schema, langs)) result.add('listen');
    if (speechOkRef.current && buildLocalExercise(card, all, 'speak', 'front', schema, langs)) result.add('speak');
    for (const kind of ['gender', 'cloze', 'conjugate', 'build'] as const) {
      if (exercisesByKeyRef.current.get(`${cardId}:${kind}`)?.length) result.add(kind);
    }
    return result;
  }, [langsFor]);

  /** Задание для пункта очереди: серверное, где сервер лучше, иначе локальное, иначе безопасный отступ. */
  const resolveExercise = useCallback((item: SessionItem): TrainerTask | null => {
    const key = itemKey(item);
    const cached = exerciseCacheRef.current.get(key);
    if (cached) return cached;

    const card = cardsByIdRef.current.get(item.cardId);
    if (!card) return null;
    const schema = schemaRef.current;
    const all = allCardsRef.current;
    const langs = langsFor(item.cardId);
    const promptSide = promptSideFor(item, urlAskRef.current, settingsRef.current.direction);

    // Вид мог стать недоступен уже после планирования: выключили звук,
    // отказались говорить вслух. Тогда — письменное вспоминание.
    let kind = item.kind;
    if ((kind === 'listen' && !settingsRef.current.sound) || (kind === 'speak' && !speechOkRef.current)) kind = 'recall';

    let task: TrainerTask | null = null;
    const serverList = urlAskRef.current === null && SERVER_PREFERRED.has(kind)
      ? exercisesByKeyRef.current.get(`${item.cardId}:${kind}`) ?? []
      : [];
    // Серверное узнавание всегда спрашивает лицевую сторону целиком — берём
    // его, только когда и мы спрашиваем её, а на обороте одно поле.
    const backFields = schema?.filter(f => f.side === 'back' && f.type === 'text').length ?? 0;
    const serverFits = kind !== 'recognize' || (promptSide === 'front' && backFields <= 1);
    if (serverList.length > 0 && serverFits) {
      const ex = serverList[(item.attempt - 1) % serverList.length];
      const tSide = targetSide(card, schema, langs);
      task = {
        ...ex,
        options: dedupOptions(ex),
        promptSide: kind === 'recognize' ? 'front' : undefined,
        targetSide: tSide,
      };
      if (kind === 'recognize' && (task.options?.length ?? 0) < 2) task = null;
    }
    if (!task && isLocalKind(kind)) task = buildLocalExercise(card, all, kind, promptSide, schema, langs);
    if (!task) {
      // Выбранный лесенкой вид на деле недоступен (например, сервер его так
      // и не подготовил) — не бросаем карточку без задания.
      task = buildLocalExercise(card, all, 'recall', promptSide, schema, langs)
        ?? buildLocalExercise(card, all, 'recognize', promptSide, schema, langs);
    }
    if (task) exerciseCacheRef.current.set(key, task);
    return task;
  }, [langsFor]);

  const clearTimers = useCallback(() => {
    if (advanceTimerRef.current) { clearTimeout(advanceTimerRef.current); advanceTimerRef.current = null; }
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    uiTimersRef.current.push(t);
  }, []);

  const handleGameUpdate = useCallback((update: GameUpdate | null) => {
    if (!update) return;
    if (update.xpGained > 0) {
      const id = Date.now();
      setXpFloat({ amount: update.xpGained, id });
      later(() => setXpFloat(cur => (cur?.id === id ? null : cur)), 1400);
    }
    const achievement = update.newAchievements[0];
    const message = achievement
      ? `Новое достижение: ${achievement.emoji} ${achievement.title}`
      : update.leveledUp ? `Новый уровень: ${update.level}!` : null;
    if (message) {
      setToast(message);
      later(() => setToast(cur => (cur === message ? null : cur)), 3500);
    }
  }, [later]);

  const buildSummary = useCallback((): SessionSummary => {
    const stats = statsRef.current;
    const accuracy = stats.answered > 0 ? Math.round((stats.correct / stats.answered) * 100) : 0;
    const minutes = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 60_000));
    const reviews = [...lastReviewRef.current.values()];
    const cardsMovedUp = reviews.filter(r => r.rating >= GOOD && r.result).length;
    const dueTomorrow = reviews.filter(r => r.result && r.result.scheduledDays <= 1).length;
    const schema = schemaRef.current;
    const weakCards: WeakCard[] = [...missesByCardRef.current.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cardId, misses]) => {
        const card = cardsByIdRef.current.get(cardId);
        if (!card) return null;
        const langs = langsFor(cardId);
        const side = targetSide(card, schema, langs);
        const other: Side = side === 'front' ? 'back' : 'front';
        return {
          cardId,
          text: getCardText(card, side, schema, false),
          translation: getCardText(card, other, schema, false),
          lang: langs?.[side] ?? languageCodeForSide(card, side, schema),
          side,
          misses,
        };
      })
      .filter((c): c is WeakCard => c !== null);
    return {
      heading: coachingHeading(accuracy),
      accuracy,
      answered: stats.answered,
      minutes,
      cardsMovedUp,
      weakCards,
      dueTomorrow,
      nextStep: coachingNextStep({
        accuracy,
        weakTerms: weakCards.map(c => c.text),
        newLeft: stats.newLeft,
        dueTomorrow,
        practice: stats.practice,
      }),
    };
  }, [langsFor]);

  const finishSession = useCallback(async () => {
    const token = sessionTokenRef.current;
    setStatus('finishing');
    stopTrainerAudio();
    // Сводке нужны ответы FSRS («завтра вернутся N») — ждём их, но недолго.
    await Promise.race([Promise.allSettled([...pendingReviewsRef.current]), sleep(2500)]);
    if (token !== sessionTokenRef.current) return;
    const result = buildSummary();
    setSummary(result);
    setStatus('finished');
    void reportStudyEvent({
      type: 'session_complete',
      source: 'flashcards',
      cards: distinctCardsRef.current.size,
      correct: statsRef.current.correct,
      minutes: result.minutes,
    }).then(handleGameUpdate);
  }, [buildSummary, handleGameUpdate]);

  /** Перейти к пункту. Состояние ответа сбрасываем здесь, в событии, а не эффектом по index. */
  const goTo = useCallback((nextIdx: number) => {
    clearTimers();
    if (nextIdx >= queueRef.current.length) { void finishSession(); return; }
    indexRef.current = nextIdx;
    answeredRef.current = false;
    itemStartedAtRef.current = Date.now();
    setIndex(nextIdx);
    setShowResult(false);
    setIsCorrect(null);
    setHintUsed(false);
    setCoaching(null);
    setFeedback(null);
    setLastAnswerText('');
  }, [clearTimers, finishSession]);

  /** Дальше — только с того пункта, на котором ответили: иначе таймер и Enter перескочили бы через один. */
  const advanceFrom = useCallback((fromIdx: number) => {
    if (indexRef.current !== fromIdx || !answeredRef.current) return;
    goTo(fromIdx + 1);
  }, [goTo]);

  const setQueueBoth = useCallback((updater: (q: SessionItem[]) => SessionItem[]) => {
    const next = updater(queueRef.current);
    queueRef.current = next;
    setQueue(next);
  }, []);

  /** Данные для заданий изменились — пересобрать ещё не показанное и перерисовать. */
  const refreshUpcoming = useCallback(() => {
    const current = queueRef.current[indexRef.current];
    const keep = current ? itemKey(current) : null;
    for (const key of [...exerciseCacheRef.current.keys()]) {
      if (key !== keep) exerciseCacheRef.current.delete(key);
    }
    setQueueBoth(q => repickUpcoming(q, indexRef.current + 1, plannedRef.current, availableKindsFor));
    setTick(t => t + 1);
  }, [availableKindsFor, setQueueBoth]);

  const mergePrepared = useCallback((prepared: PreparedSet) => {
    for (const p of prepared.profiles) profilesByIdRef.current.set(p.cardId, p);
    const byKey = new Map<string, TrainerExercise[]>();
    for (const ex of prepared.exercises) {
      if (!ex.answer?.trim()) continue; // без эталона сверять нечего — контракт так и говорит
      const key = `${ex.cardId}:${ex.kind}`;
      const list = byKey.get(key) ?? [];
      list.push(ex);
      byKey.set(key, list);
    }
    for (const [key, list] of byKey) exercisesByKeyRef.current.set(key, list);
  }, []);

  const load = useCallback(async () => {
    const token = ++sessionTokenRef.current;
    clearTimers();
    stopTrainerAudio();
    setStatus('loading');
    setSummary(null);
    setCombo(0);
    exerciseCacheRef.current.clear();
    missesByCardRef.current.clear();
    lastReviewRef.current.clear();
    distinctCardsRef.current.clear();
    pendingReviewsRef.current.clear();
    statsRef.current = { answered: 0, correct: 0, combo: 0, newLeft: 0, practice: false };

    const params = new URLSearchParams(window.location.search);
    const range = parseRange(params.get('range'));
    const ask = params.get('ask');
    urlAskRef.current = ask === 'front' || ask === 'back' ? ask : null;
    const back = params.get('back');
    setBackLink(back && back.startsWith('/') ? back : null);
    const loadedSettings = loadTrainerSettings();
    setSettingsState(loadedSettings);
    settingsRef.current = loadedSettings;
    speechOkRef.current = recorderAvailable();

    try {
      const [setRes, schedulesRaw] = await Promise.all([
        fetch(`/api/sets/${setId}`),
        fetchFsrsState(setId),
      ]);
      if (token !== sessionTokenRef.current) return;
      if (!setRes.ok) { setStatus('error'); return; }
      const data: SetResponse = await setRes.json();
      // Курс открывает карточки на своей партии: отбор приходит в адресе.
      data.flashcards = selectCards(data.flashcards, range);
      setSet(data);
      if (data.flashcards.length < 2) { setStatus('empty'); return; }

      allCardsRef.current = data.flashcards;
      cardsByIdRef.current = new Map(data.flashcards.map(c => [c.id, c]));
      schemaRef.current = data.fieldsSchema;

      const scheduleById = new Map<string, CardSchedule>();
      for (const c of data.flashcards) {
        scheduleById.set(c.id, { cardId: c.id, state: 0, due: null, stability: 0, lapses: 0, reps: 0 });
      }
      for (const s of schedulesRaw) if (scheduleById.has(s.cardId)) scheduleById.set(s.cardId, s);
      const schedules = [...scheduleById.values()];

      const planned = planSession(schedules, { now: new Date() });
      if (planned.length === 0) { setStatus('empty'); return; }
      plannedRef.current = new Map(planned.map(p => [p.cardId, p]));
      statsRef.current.newLeft = newCardsLeft(schedules, planned);
      statsRef.current.practice = planned.every(p => p.reason === 'practice');

      // Серверу — сперва повторяемые: им нужны cloze/build/conjugate, новым
      // карточкам в этом занятии хватит узнавания и вспоминания.
      const cardIds = [...planned].sort((a, b) => Number(a.isNew) - Number(b.isNew)).map(p => p.cardId);
      profilesByIdRef.current = new Map();
      exercisesByKeyRef.current = new Map();
      const firstPrepare = urlAskRef.current === null
        ? prepareTrainerSet(setId, { cardIds, limit: PREPARE_LIMIT })
        : Promise.resolve(null);
      const early = await Promise.race([firstPrepare, sleep(PREPARE_HEAD_START_MS).then(() => undefined)]);
      if (token !== sessionTokenRef.current) return;
      if (early) mergePrepared(early);

      const initialQueue = buildSessionQueue(planned, availableKindsFor);
      queueRef.current = initialQueue;
      setQueue(initialQueue);
      indexRef.current = 0;
      answeredRef.current = false;
      setIndex(0);
      setShowResult(false);
      setIsCorrect(null);
      setHintUsed(false);
      setCoaching(null);
      setFeedback(null);
      setLastAnswerText('');
      startedAtRef.current = Date.now();
      itemStartedAtRef.current = Date.now();
      setStatus('ready');

      // Фон: подмешать пришедшее позже и дозапросить, пока сервер говорит «ещё есть».
      void (async () => {
        let res: PreparedSet | null | undefined = early === undefined ? await firstPrepare : early;
        let calls = 1;
        while (token === sessionTokenRef.current && res) {
          if (res !== early) { mergePrepared(res); refreshUpcoming(); }
          if (res.pending <= 0 || calls >= PREPARE_MAX_CALLS) break;
          await sleep(PREPARE_INTERVAL_MS);
          if (token !== sessionTokenRef.current) break;
          res = await prepareTrainerSet(setId, { cardIds, limit: PREPARE_LIMIT });
          calls++;
        }
      })();
    } catch (e) {
      console.error('Не удалось подготовить занятие', e);
      if (token === sessionTokenRef.current) setStatus('error');
    }
  }, [setId, availableKindsFor, clearTimers, mergePrepared, refreshUpcoming]);

  useEffect(() => {
    // Ждём окончания загрузки сессии, чтобы запросы ушли сразу с токеном.
    if (sessionStatus === 'loading') return;
    if (startedForIdRef.current === setId) return;
    startedForIdRef.current = setId;
    void load();
    // load меняется вместе с setId; запускаем его только раз на набор — иначе
    // гидратация сессии перезапускала бы загрузку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setId, sessionStatus]);

  useEffect(() => {
    const timers = uiTimersRef.current;
    const tokenRef = sessionTokenRef;
    const startedRef = startedForIdRef;
    const advanceRef = advanceTimerRef;
    return () => {
      // Всё, что ещё летит (загрузка, фоновые дозапросы, мнемоника), узнает
      // по сменившемуся токену, что занятие закрыто. Сброс startedFor нужен
      // StrictMode: он размонтирует и монтирует заново — загрузка должна
      // перезапуститься, а не остаться осиротевшей со старым токеном.
      tokenRef.current++;
      startedRef.current = null;
      if (advanceRef.current) clearTimeout(advanceRef.current);
      timers.forEach(clearTimeout);
      stopTrainerAudio();
    };
  }, []);

  const currentItem = status === 'ready' ? queue[index] ?? null : null;
  const currentCard = currentItem ? cardsByIdRef.current.get(currentItem.cardId) ?? null : null;
  const currentExercise = currentItem ? resolveExercise(currentItem) : null;
  const currentProfile = currentItem ? profilesByIdRef.current.get(currentItem.cardId) ?? null : null;
  const currentPlanned = currentItem ? plannedRef.current.get(currentItem.cardId) ?? null : null;

  /** Что озвучивать до ответа: задание, если оно на изучаемом языке и не выдаёт ответ. */
  const promptAudioOf = useCallback((task: TrainerTask): { text: string; lang: string; side?: Side } | null => {
    if (task.promptLang === 'ru') return null;
    switch (task.kind) {
      case 'recognize':
      case 'recall':
      case 'listen':
      case 'gender':
        return { text: task.prompt, lang: task.promptLang, side: task.kind === 'gender' ? undefined : task.promptSide };
      case 'speak':
        // «Прочитайте вслух» — образец можно услышать заранее; «скажите по-французски» — нет.
        return task.prompt.trim() === task.answer.trim() ? { text: task.answer, lang: task.answerLang, side: task.targetSide } : null;
      default:
        return null;
    }
  }, []);

  /** Что озвучивать после ответа: изучаемую сторону, если её ещё не звучало. */
  const answerAudioOf = useCallback((task: TrainerTask): { text: string; lang: string; side?: Side } | null => {
    // Ответ по-русски (или это был диктант) — ещё раз звучит само слово: теперь
    // уже вместе со смыслом, это и закрепляет.
    if (task.kind === 'listen' || task.answerLang === 'ru') return promptAudioOf(task);
    // «le»/«la» отдельно от слова звучат бессмысленно, а само слово уже прозвучало.
    if (task.kind === 'gender') return null;
    if (promptAudioOf(task)?.text === task.answer) return null;
    // Записанная озвучка стороны читает все её поля — годится, только если спрашивали сторону целиком.
    const isWholeSide = (task.kind === 'recognize' || task.kind === 'recall' || task.kind === 'speak') && !task.answerLabel;
    return { text: task.answer, lang: task.answerLang, side: isWholeSide ? (task.promptSide === 'front' ? 'back' : 'front') : undefined };
  }, [promptAudioOf]);

  // Озвучка нового задания и прогрев озвучки следующих трёх. Состояние здесь
  // не меняется — только внешний мир (звук, HTTP-кэш).
  const currentKey = currentItem ? itemKey(currentItem) : null;
  useEffect(() => {
    if (status !== 'ready' || !currentExercise) return;
    if (settingsRef.current.sound) {
      const a = promptAudioOf(currentExercise);
      if (a) void playTrainerAudio({ ...a, card: currentCard, schema: schemaRef.current });
    }
    if (!settingsRef.current.sound) return;
    for (let i = indexRef.current + 1; i <= indexRef.current + 3 && i < queueRef.current.length; i++) {
      const ex = resolveExercise(queueRef.current[i]);
      if (!ex) continue;
      const before = promptAudioOf(ex);
      const after = answerAudioOf(ex);
      if (before) void prefetchAudio(before.text, before.lang);
      if (after) void prefetchAudio(after.text, after.lang);
    }
    // Мнемонику лечу заказываем заранее: покажем её после попытки, и ждать не придётся.
    if (currentPlanned?.leech && currentItem && !currentProfile?.mnemonic && !mnemonicPromisesRef.current.has(currentItem.cardId)) {
      mnemonicPromisesRef.current.set(currentItem.cardId, fetchMnemonic(currentItem.cardId));
    }
    // Эффект привязан к смене задания (currentKey), а не к каждой перерисовке.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey, status]);

  const replay = useCallback((slow = false) => {
    if (!currentExercise) return;
    const a = showResult ? answerAudioOf(currentExercise) ?? promptAudioOf(currentExercise) : promptAudioOf(currentExercise);
    if (a) void playTrainerAudio({ ...a, card: currentCard, schema: schemaRef.current, slow });
  }, [currentExercise, currentCard, showResult, promptAudioOf, answerAudioOf]);

  const useHint = useCallback(() => {
    if (showResult) return;
    setHintUsed(true);
  }, [showResult]);

  const setSettings = useCallback((next: TrainerSettings) => {
    const prev = settingsRef.current;
    setSettingsState(next);
    settingsRef.current = next;
    saveTrainerSettings(next);
    if (!next.sound) stopTrainerAudio();
    if (prev.sound !== next.sound || prev.direction !== next.direction) refreshUpcoming();
  }, [refreshUpcoming]);

  const next = useCallback(() => {
    advanceFrom(indexRef.current);
  }, [advanceFrom]);

  /** «Не могу сейчас говорить»: без оценки дальше, и до конца занятия — без заданий вслух. */
  const skipSpeaking = useCallback(() => {
    if (answeredRef.current) return;
    speechOkRef.current = false;
    const current = queueRef.current[indexRef.current];
    if (current) exerciseCacheRef.current.delete(itemKey(current));
    itemStartedAtRef.current = Date.now();
    refreshUpcoming();
  }, [refreshUpcoming]);

  const showCoaching = useCallback((cardId: string, token: number, idx: number) => {
    const profile = profilesByIdRef.current.get(cardId);
    const example = profile?.example ?? null;
    const known = profile?.mnemonic ?? null;
    if (known) { setCoaching({ loading: false, mnemonic: known, example }); return; }
    let promise = mnemonicPromisesRef.current.get(cardId);
    if (!promise) {
      promise = fetchMnemonic(cardId);
      mnemonicPromisesRef.current.set(cardId, promise);
    }
    setCoaching({ loading: true, mnemonic: null, example });
    void promise.then(m => {
      // Пока мнемоника шла, человек мог уйти дальше — чужой карточке она ни к чему.
      if (token !== sessionTokenRef.current || indexRef.current !== idx) return;
      setCoaching({ loading: false, mnemonic: m, example });
    });
  }, []);

  const submitAnswer = useCallback(async (raw: string | number, opts: { gaveUp?: boolean } = {}) => {
    const item = queueRef.current[indexRef.current];
    const idx = indexRef.current;
    const token = sessionTokenRef.current;
    const exercise = item ? resolveExercise(item) : null;
    if (!item || !exercise || answeredRef.current) return;
    answeredRef.current = true;

    const elapsedMs = Date.now() - itemStartedAtRef.current;
    let correct = false;
    let displayAnswerText = '';
    let answerFeedback: AnswerFeedback | null = null;

    if (opts.gaveUp) {
      correct = false;
    } else if (exercise.kind === 'recognize' || exercise.kind === 'gender') {
      const chosen = typeof raw === 'number' ? exercise.options?.[raw] ?? '' : String(raw);
      correct = chosen !== '' && chosen === exercise.answer;
      displayAnswerText = chosen;
    } else if (exercise.kind === 'build') {
      displayAnswerText = String(raw);
      setLastAnswerText(displayAnswerText);
      setGrading(true);
      try {
        const idToken = await trainerToken();
        const verdict = await checkProduction({
          prompt: exercise.prompt,
          expected: exercise.acceptedAnswers.length > 0 ? exercise.acceptedAnswers : [exercise.answer],
          userAnswer: displayAnswerText,
          focus: profilesByIdRef.current.get(item.cardId)?.lemma ?? undefined,
          // Фраза своя: примеры сервера — лишь образцы, отличие от них не ошибка.
          freeForm: true,
        }, idToken ?? undefined);
        correct = verdict.isCorrect;
        answerFeedback = { corrected: verdict.corrected || undefined, explanation: verdict.explanation || undefined };
      } catch {
        // Проверка по смыслу недоступна — не наказываем ни ученика, ни карточку.
        answerFeedback = { unchecked: true };
      } finally {
        setGrading(false);
      }
      if (token !== sessionTokenRef.current || indexRef.current !== idx) return;
    } else if (exercise.kind === 'speak') {
      displayAnswerText = String(raw);
      const scored = speechScore(displayAnswerText, exercise);
      correct = scored.correct;
      answerFeedback = { heard: displayAnswerText, score: scored.score };
      void reportStudyEvent({ type: 'pronunciation', source: 'flashcards', score: scored.score }).then(handleGameUpdate);
    } else {
      displayAnswerText = String(raw);
      correct = isWrittenCorrect(displayAnswerText, exercise, settingsRef.current.grading);
    }

    const unchecked = answerFeedback?.unchecked === true;
    setIsCorrect(unchecked ? null : correct);
    setShowResult(true);
    setLastAnswerText(displayAnswerText);
    setFeedback(answerFeedback);

    if (settingsRef.current.sound) {
      const a = answerAudioOf(exercise);
      if (a) void playTrainerAudio({ ...a, card: cardsByIdRef.current.get(item.cardId), schema: schemaRef.current });
    }

    if (unchecked) return; // ни рейтинга, ни опыта: ответ никто не проверил

    if (exercise.kind === 'build') {
      void reportStudyEvent({ type: 'sentence_built', source: 'flashcards', correct }).then(handleGameUpdate);
    }

    const stats = statsRef.current;
    stats.answered += 1;
    if (correct) stats.correct += 1;
    distinctCardsRef.current.add(item.cardId);
    stats.combo = correct ? stats.combo + 1 : 0;
    setCombo(stats.combo);

    const timing = classifyResponseTime({ responseMs: elapsedMs, ...TIMING[exercise.kind] });
    const rating = mapOutcomeToRating({
      correct,
      usedHint: hintUsed,
      fast: timing.fast,
      slow: timing.slow,
      recognitionOnly: exercise.kind === 'recognize' || exercise.kind === 'gender',
      retry: item.attempt > 1 || !!item.followUp,
    });
    const review = submitFsrsReview(item.cardId, rating).then(result => {
      lastReviewRef.current.set(item.cardId, { rating, result });
    });
    pendingReviewsRef.current.add(review);
    void review.finally(() => pendingReviewsRef.current.delete(review));

    void reportStudyEvent({
      type: 'answer', source: 'flashcards', correct, firstTry: item.attempt === 1, combo: stats.combo,
    }).then(handleGameUpdate);

    const leech = plannedRef.current.get(item.cardId)?.leech ?? false;
    if (correct) {
      if (leech) showCoaching(item.cardId, token, idx);
      // Верно — дальше сами, чуть погодя: успеть увидеть «верно» и услышать слово.
      // Разбор фразы и мнемонику лечу надо прочитать — там ждём Enter.
      if (exercise.kind !== 'build' && !leech) {
        const delay = answerAudioOf(exercise) && settingsRef.current.sound ? 1400 : 900;
        advanceTimerRef.current = setTimeout(() => advanceFrom(idx), delay);
      }
      return;
    }

    missesByCardRef.current.set(item.cardId, (missesByCardRef.current.get(item.cardId) ?? 0) + 1);
    if (shouldRelearn(item)) setQueueBoth(q => scheduleRelearn(q, idx, item));
    if (leech || shouldShowMnemonic({ missCount: item.missCount + 1 })) showCoaching(item.cardId, token, idx);
  }, [resolveExercise, hintUsed, handleGameUpdate, answerAudioOf, advanceFrom, setQueueBoth, showCoaching]);

  const restart = useCallback(() => {
    void load();
  }, [load]);

  return {
    status,
    set,
    schema: set?.fieldsSchema,
    settings,
    setSettings,
    backLink,
    position: index + 1,
    queueLength: queue.length,
    currentCard,
    currentExercise,
    currentProfile,
    currentItem,
    isLeech: currentPlanned?.leech ?? false,
    showResult,
    isCorrect,
    lastAnswerText,
    hintUsed,
    useHint,
    coaching,
    feedback,
    grading,
    combo,
    xpFloat,
    toast,
    submitAnswer,
    skipSpeaking,
    next,
    replay,
    summary,
    restart,
  };
}
