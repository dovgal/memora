// Разбор текста на предложения и слова для читалки.
//
// Основа — Intl.Segmenter: он знает границы слов и предложений для десятков
// языков, включая китайский и японский, где пробелов между словами нет.
// Регулярка оставлена запасным путём для старых браузеров.

import type { Block } from './draft';

/** Кусочек абзаца: слово (кликабельное) либо разделитель. */
export interface Token {
  text: string;
  /** Слово — то, что можно перевести и добавить в словарь. */
  word: boolean;
  /** Нормализованная форма для словаря (нижний регистр, без пунктуации). */
  key: string;
}

/**
 * Языки с элизией: во французском «l'homme» — это два слова, и читатель
 * ищет в словаре «homme», а не «l'homme». Отрезаем короткий служебный кусок.
 */
const ELISION_LANGS = new Set(['fr', 'it', 'ca', 'oc']);
const ELISION = /^(l|d|j|n|qu|s|t|m|c)['’]$/i;

/** Нормализация слова: нижний регистр, без внешней пунктуации. */
export function normalizeWord(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '');
}

function segmenterWords(text: string, lang: string): { text: string; word: boolean }[] | null {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (!Seg) return null;
  const seg = new Seg(lang || undefined, { granularity: 'word' });
  const out: { text: string; word: boolean }[] = [];
  for (const s of seg.segment(text)) {
    out.push({ text: s.segment, word: !!s.isWordLike });
  }
  return out;
}

function regexWords(text: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  const re = /[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), word: false });
    out.push({ text: m[0], word: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}

/** Абзац → токены. Слова остаются с исходным регистром, ключ — нормализованный. */
export function tokenize(text: string, lang = ''): Token[] {
  const base = (() => {
    try {
      const r = segmenterWords(text, lang);
      return r ?? regexWords(text);
    } catch {
      return regexWords(text);
    }
  })();

  const elision = ELISION_LANGS.has(lang.slice(0, 2).toLowerCase());
  const out: Token[] = [];
  for (const t of base) {
    if (!t.word) {
      out.push({ text: t.text, word: false, key: '' });
      continue;
    }
    // «l'homme» → «l'» отдельным разделителем и «homme» словом.
    const m = elision ? t.text.match(/^([\p{L}]{1,2}['’])(.+)$/u) : null;
    if (m && ELISION.test(m[1])) {
      out.push({ text: m[1], word: false, key: '' });
      out.push({ text: m[2], word: true, key: normalizeWord(m[2]) });
      continue;
    }
    const key = normalizeWord(t.text);
    // Числа и одиночные символы словарём не считаем — они только мешают счётчику.
    const isWord = key.length > 0 && /\p{L}/u.test(key);
    out.push({ text: t.text, word: isWord, key: isWord ? key : '' });
  }
  return out;
}

/**
 * Текст → предложения БЕЗ обрезки пробелов. Пробел между предложениями —
 * часть текста: если его срезать, при выводе фразы склеятся в одну строку.
 */
/**
 * Новое предложение после точки, начинающееся с цифры или кавычки.
 *
 * Системный разделитель такую границу не видит: по его правилам точка перед
 * цифрой продолжает предложение (это про «3. 14»). Из-за этого «…в 1789 году.
 * 14 июля…» слипалось в одно.
 */
const AFTER_DOT = /(?<=[.!?…])(?=\s+[0-9«„“(\[])/u;

/**
 * Сокращение в конце куска — значит, точка не конец предложения.
 *
 * Тот же разделитель рвёт «M. Dupont» после инициала: список сокращений он не
 * знает вовсе. Одиночная буква с точкой — это почти всегда инициал.
 */
const ABBR = /(?:^|[\s(«„"'])(?:[A-Za-zА-Яа-яЁё]|Mme|Mlle|Mr|Dr|Prof|St|Ste|vs|etc|см|рис|стр|табл|тыс|млн|млрд|напр|ср)\.$/iu;

/** Склеивает куски, оторванные от своего предложения сокращением. */
function mergeAbbrev(parts: string[]): string[] {
  const out: string[] = [];
  for (const part of parts) {
    if (out.length > 0 && ABBR.test(out[out.length - 1].trimEnd())) {
      out[out.length - 1] += part;
    } else {
      out.push(part);
    }
  }
  return out;
}

export function splitSentencesRaw(text: string, lang = ''): string[] {
  const Seg = (Intl as unknown as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    try {
      const seg = new Seg(lang || undefined, { granularity: 'sentence' });
      const out = mergeAbbrev(
        [...seg.segment(text)]
          .flatMap(s => s.segment.split(AFTER_DOT))
          .filter(s => s.trim().length > 0),
      );
      if (out.length) return out;
    } catch { /* язык не поддержан — падаем в регулярку */ }
  }
  // Граница перед пробелом, а не по пробелу: разделитель уезжает в следующее
  // предложение и не пропадает.
  return mergeAbbrev(text.split(/(?<=[.!?…])(?=\s)/).filter(s => s.trim().length > 0));
}

/**
 * Предложения для перевода и чтения вслух — те же и в том же порядке, что и
 * при выводе, но без краевых пробелов. Нумерация совпадает со splitSentencesRaw.
 */
export function splitSentences(text: string, lang = ''): string[] {
  return splitSentencesRaw(text, lang).map(s => s.trim());
}

/** Абзацы текста (пустая строка — разделитель). */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\r\n\s*\r\n/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Глава → страницы примерно по `targetChars` символов, границы — по абзацам.
 * Страница (а не бесконечная прокрутка) даёт понятный шаг: прочитал —
 * разобрал незнакомые слова — «знаю все» — дальше.
 */
export function paginate(paragraphs: string[], targetChars = 1600): string[][] {
  const pages: string[][] = [];
  let cur: string[] = [];
  let size = 0;
  for (const p of paragraphs) {
    // Абзац длиннее страницы кладём отдельной страницей, не разрывая мысль.
    if (size > 0 && size + p.length > targetChars) {
      pages.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += p.length;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

/**
 * Разбиение на страницы с учётом картинок.
 *
 * Картинке назначен вес: без него страница с тремя иллюстрациями и парой строк
 * текста считалась бы «пустой» и слипалась бы со следующей, а картинки уехали
 * бы от своего абзаца.
 */
export function paginateBlocks(blocks: Block[], targetChars = 1600): Block[][] {
  const IMAGE_WEIGHT = 700;
  const pages: Block[][] = [];
  let cur: Block[] = [];
  let size = 0;

  for (const b of blocks) {
    const weight = b.kind === 'img' ? IMAGE_WEIGHT : b.text.length;
    if (size > 0 && size + weight > targetChars) {
      pages.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(b);
    size += weight;
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

/** Сколько уникальных слов на странице — для счётчика «новых слов». */
export function uniqueWords(paragraphs: string[], lang: string): string[] {
  const set = new Set<string>();
  for (const p of paragraphs) {
    for (const t of tokenize(p, lang)) {
      if (t.word && t.key) set.add(t.key);
    }
  }
  return [...set];
}
