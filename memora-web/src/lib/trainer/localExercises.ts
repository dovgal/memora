// Локальная сборка БЕЗОПАСНЫХ упражнений из текста карточки.
//
// «Безопасных» — значит без единой капли грамматики: recognize (узнать
// перевод среди вариантов), recall (вспомнить и написать), listen (услышать и
// записать), speak (произнести вслух). Всё, что требует понимания структуры
// языка — отрицание, время, род, спряжение, — по прямому требованию задачи
// НЕ генерируется на клиенте: раньше /api/ai/learn/generate придумывало такие
// задания на лету для любой карточки, и получалась бессмыслица (просят
// поставить в отрицание карточку, которая сама — одно существительное).
// Такие упражнения приходят только от /api/sets/{id}/trainer/prepare, где их
// проверяет судья.

import type { FlashcardResponse, FieldSchema } from '@/types/schema';
import { generateDistractors, getCardText, getCardSingleField, acceptableAnswers } from '@/lib/studyUtils';
import type { TrainerExercise } from '@/lib/contracts/trainer';
import { languageCodeForSide, targetSide, type Side, type SideLangs } from './lang';

export type LocalExerciseKind = 'recognize' | 'recall' | 'listen' | 'speak';
export type { Side };

/**
 * Упражнение в том виде, в каком его показывает тренажёр: серверное или
 * локальное плюс то, что знает только клиент.
 */
export type TrainerTask = TrainerExercise & {
  /** Имя поля ответа, когда у стороны карточки их несколько («INFINITIF»). */
  answerLabel?: string;
  /** Сторона карточки в задании — чтобы проиграть записанную к ней озвучку. */
  promptSide?: Side;
  /** Сторона карточки на изучаемом языке — её озвучиваем после ответа. */
  targetSide?: Side;
  /** Собрано на клиенте (сервер недоступен или не подготовил этот вид). */
  local?: boolean;
};

function otherSide(side: Side): Side {
  return side === 'front' ? 'back' : 'front';
}

/** Честное перемешивание (Фишер–Йетс): sort(() => 0.5 - random) заметно предпочитает исходный порядок. */
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function langFor(card: FlashcardResponse, side: Side, schema?: FieldSchema[], langs?: SideLangs): string {
  return langs?.[side] ?? languageCodeForSide(card, side, schema);
}

function textFieldCount(side: Side, schema?: FieldSchema[]): number {
  return schema?.filter(f => f.side === side && f.type === 'text').length ?? 0;
}

const ARTICLES = new Set(['le', 'la', 'les', 'un', 'une', 'des', 'du', 'the', 'a', 'an', 'to']);

/**
 * Подсказка-начало: первая буква слова, а у «le livre» — артикль и первая
 * буква существительного («le l…»): одна «l» от артикля не подсказывает ничего.
 */
export function firstLetterHint(answer: string): string | null {
  const words = answer.trim().split(/\s+/);
  if (words.length === 0 || !words[0]) return null;
  const elided = /^(l|d|j|qu)['’](.+)$/i.exec(words[0]);
  if (elided) return `${words[0].slice(0, words[0].length - elided[2].length)}${elided[2][0]}…`;
  if (ARTICLES.has(words[0].toLowerCase()) && words[1]) return `${words[0]} ${words[1][0]}…`;
  return answer.trim().length > 1 ? `${words[0][0]}…` : null;
}

/** Убираем ведущую транскрипцию «[bɔ̃ʒuʁ] привет» — её никто не набирает руками. */
function stripIpa(text: string): string {
  return text.replace(/^\[[^\]]*\]\s*/, '');
}

/** recognize: выбрать верный перевод среди вариантов с локально собранными, схлопнутыми приманками. */
export function buildRecognizeExercise(
  card: FlashcardResponse,
  allCards: FlashcardResponse[],
  promptSide: Side,
  schema?: FieldSchema[],
  langs?: SideLangs,
): TrainerTask | null {
  const answerSide = otherSide(promptSide);
  const promptText = getCardText(card, promptSide, schema);
  const answerText = getCardText(card, answerSide, schema);
  if (!promptText || !answerText) return null;

  const answerType = answerSide === 'front' ? 'term' : 'definition';
  const numDistractors = Math.min(3, allCards.length - 1);
  // generateDistractors уже отбрасывает пустые подписи, повторы и приманки,
  // совпадающие с верным ответом, — выбор из двух одинаковых вариантов хуже,
  // чем выбор из меньшего числа.
  const distractors = generateDistractors(card, allCards, numDistractors, answerType, schema);
  if (distractors.length === 0) return null; // не из чего собрать выбор — пусть решает recall

  return {
    id: `local:${card.id}:recognize:${promptSide}`,
    cardId: card.id,
    kind: 'recognize',
    prompt: promptText,
    promptLang: langFor(card, promptSide, schema, langs),
    answer: answerText,
    acceptedAnswers: [answerText],
    answerLang: langFor(card, answerSide, schema, langs),
    options: shuffled([...distractors, answerText]),
    hint: null,
    explanation: null,
    confidence: 1,
    promptSide,
    targetSide: targetSide(card, schema, langs),
    local: true,
  };
}

/**
 * recall: вспомнить и написать ответ — retrieval, а не узнавание.
 *
 * Если на стороне ответа несколько полей (у глаголов — три формы), просим
 * одно, с его именем: набрать «BORE BORNE PORTER, SUPPORTER» целиком никто
 * не сможет, а «введите PAST PARTICIPLE» — понятное задание.
 */
export function buildRecallExercise(
  card: FlashcardResponse,
  promptSide: Side,
  schema?: FieldSchema[],
  langs?: SideLangs,
): TrainerTask | null {
  const answerSide = otherSide(promptSide);
  const promptText = getCardText(card, promptSide, schema, true);
  const multiField = textFieldCount(answerSide, schema) > 1;
  const single = multiField ? getCardSingleField(card, answerSide, schema) : null;
  const answerText = single ? single.value : getCardText(card, answerSide, schema, false);
  if (!promptText || !answerText) return null;

  const cleanAnswer = stripIpa(answerText);
  const accepted = acceptableAnswers(answerText);

  return {
    id: `local:${card.id}:recall:${promptSide}`,
    cardId: card.id,
    kind: 'recall',
    prompt: promptText,
    promptLang: langFor(card, promptSide, schema, langs),
    answer: cleanAnswer,
    acceptedAnswers: accepted.length > 0 ? accepted : [cleanAnswer],
    answerLang: langFor(card, answerSide, schema, langs),
    options: null,
    // Первая буква — подсказка, которая стоит рейтинга (см. lib/trainer/rating.ts),
    // а не готовый ответ: помогает вспомнить, а не заменяет вспоминание.
    hint: firstLetterHint(cleanAnswer),
    explanation: null,
    confidence: 1,
    answerLabel: single?.name || undefined,
    promptSide,
    targetSide: targetSide(card, schema, langs),
    local: true,
  };
}

/** listen: услышать изучаемую сторону и записать её — диктант, а не перевод. */
export function buildListenExercise(card: FlashcardResponse, schema?: FieldSchema[], langs?: SideLangs): TrainerTask | null {
  const side = targetSide(card, schema, langs);
  const lang = langFor(card, side, schema, langs);
  // Диктант на русском не учит ничему, что человек и так не умеет.
  if (lang === 'ru') return null;
  const text = stripIpa(getCardText(card, side, schema, false));
  if (!text) return null;
  const accepted = acceptableAnswers(text);

  return {
    id: `local:${card.id}:listen:${side}`,
    cardId: card.id,
    kind: 'listen',
    // Текст задания на слух не показываем до ответа — это и есть упражнение;
    // сюда же кладём то, что нужно озвучить.
    prompt: text,
    promptLang: lang,
    answer: text,
    acceptedAnswers: accepted.length > 0 ? accepted : [text],
    answerLang: lang,
    options: null,
    hint: null,
    explanation: null,
    confidence: 1,
    promptSide: side,
    targetSide: side,
    local: true,
  };
}

/** speak: сказать по-изучаемому то, что написано на другой стороне, — речь, а не чтение вслух. */
export function buildSpeakExercise(card: FlashcardResponse, schema?: FieldSchema[], langs?: SideLangs): TrainerTask | null {
  const side = targetSide(card, schema, langs);
  const lang = langFor(card, side, schema, langs);
  if (lang === 'ru') return null;
  const text = stripIpa(getCardText(card, side, schema, false));
  if (!text) return null;
  const accepted = acceptableAnswers(text);
  const otherText = getCardText(card, otherSide(side), schema, false);

  return {
    id: `local:${card.id}:speak:${side}`,
    cardId: card.id,
    kind: 'speak',
    // Подсказываем по-русски (или на другой стороне), что нужно сказать —
    // иначе просить «произнесите» без контекста бессмысленно.
    prompt: otherText || text,
    promptLang: otherText ? langFor(card, otherSide(side), schema, langs) : lang,
    answer: text,
    acceptedAnswers: accepted.length > 0 ? accepted : [text],
    answerLang: lang,
    options: null,
    hint: null,
    explanation: null,
    confidence: 1,
    promptSide: otherText ? otherSide(side) : side,
    targetSide: side,
    local: true,
  };
}

/**
 * Собрать локальное упражнение нужного вида. Возвращает null, если у карточки
 * не хватает данных (например, пустая сторона или не из чего собрать
 * приманки для recognize) — вызывающий код должен попробовать соседний по
 * лесенке вид упражнения.
 */
export function buildLocalExercise(
  card: FlashcardResponse,
  allCards: FlashcardResponse[],
  kind: LocalExerciseKind,
  promptSide: Side,
  schema?: FieldSchema[],
  langs?: SideLangs,
): TrainerTask | null {
  switch (kind) {
    case 'recognize': return buildRecognizeExercise(card, allCards, promptSide, schema, langs);
    case 'recall': return buildRecallExercise(card, promptSide, schema, langs);
    case 'listen': return buildListenExercise(card, schema, langs);
    case 'speak': return buildSpeakExercise(card, schema, langs);
    default: return null;
  }
}
