// Перевод исхода ответа в оценку FSRS.
//
// FSRS понимает только четыре состояния: Again/Hard/Good/Easy — а тренажёр
// знает про ответ куда больше (верно ли, была ли подсказка, долго ли думали).
// Это единственное место, где одно превращается в другое, чтобы правило
// нигде больше не дублировалось и не расходилось.

import type { AnswerOutcome, FsrsRating } from './types';

export const AGAIN: FsrsRating = 1;
export const HARD: FsrsRating = 2;
export const GOOD: FsrsRating = 3;
export const EASY: FsrsRating = 4;

/**
 * Неверно → Again. Верно, но с подсказкой или после долгого раздумья → Hard:
 * ответ дался не сразу, и FSRS должен предложить более короткий следующий
 * интервал, а не поверить, что карточка твёрдо в памяти. Просто верно → Good.
 * Быстро и уверенно, без подсказки → Easy — но только когда слово вспомнили
 * сами и с первого раза: узнать среди четырёх вариантов или ответить через
 * минуту после разбора ошибки легко, и Easy там растянул бы интервал на
 * недели для слова, которое на деле ещё не держится.
 *
 * `fast` и `slow` не бывают истинными одновременно — это решает вызывающий
 * код по порогу времени ответа; здесь порог не знаем и не должны знать.
 */
export function mapOutcomeToRating(outcome: AnswerOutcome): FsrsRating {
  if (!outcome.correct) return AGAIN;
  if (outcome.usedHint || outcome.slow) return HARD;
  if (outcome.fast && !outcome.recognitionOnly && !outcome.retry) return EASY;
  return GOOD;
}

export interface ResponseTiming {
  /** Сколько миллисекунд прошло с показа задания до ответа. */
  responseMs: number;
  /** Ниже этого — ответ «быстрый». */
  fastMs: number;
  /** Выше этого — ответ «медленный». */
  slowMs: number;
}

/**
 * Классифицирует время ответа в fast/slow по порогам, заданным вызывающим
 * кодом (у recall и у speak разумные пороги разные — записывать голосовой
 * ответ дольше, чем нажать один из четырёх вариантов).
 */
export function classifyResponseTime(timing: ResponseTiming): { fast: boolean; slow: boolean } {
  return {
    fast: timing.responseMs <= timing.fastMs,
    slow: timing.responseMs >= timing.slowMs,
  };
}
