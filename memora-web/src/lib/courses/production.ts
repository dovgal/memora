// Сравнение построенной фразы с верными ответами.
//
// Для замены в шаблоне и преобразования ответ однозначен, и модель тут не
// нужна: хватает пословного сравнения. Но оно должно быть снисходительным
// там, где снисходительность не вредит учёбе, — иначе человек, которому язык
// даётся тяжело, получает «неверно» за то, что к делу не относится.

import { checkDictation, type DictationCheck } from './dictation';

export type ProductionVerdict =
  | 'exact'    // верно
  | 'accents'  // верно, но потерян акцент — засчитываем с пометкой
  | 'wrong';

export interface ProductionMatch {
  verdict: ProductionVerdict;
  /** Верный ответ, ближе всего к сказанному, — его и показываем при ошибке. */
  best: string;
  check: DictationCheck;
}

/** Без акцентов: «motivé» и «motive» — одно слово для второго прохода. */
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Лучшее совпадение среди верных ответов.
 *
 * Акцент в отдельности не делает ответ неверным: фраза построена правильно,
 * а это и тренируется. Но и молча его не прощаем — пометка остаётся, чтобы
 * написание подтягивалось со временем.
 */
export function matchProduction(
  answers: string[],
  given: string,
  opts: { spoken?: boolean } = {},
): ProductionMatch {
  const variants = answers.filter(a => a.trim());
  let best = variants[0] ?? '';
  let bestCheck = checkDictation(best, given, opts);
  let bestRatio = ratio(bestCheck);

  for (const a of variants.slice(1)) {
    const c = checkDictation(a, given, opts);
    const r = ratio(c);
    if (r > bestRatio) { best = a; bestCheck = c; bestRatio = r; }
  }

  if (isPerfect(bestCheck)) return { verdict: 'exact', best, check: bestCheck };

  // Второй проход без акцентов: совпало — значит, фраза собрана верно.
  for (const a of variants) {
    const folded = checkDictation(foldAccents(a), foldAccents(given), opts);
    if (isPerfect(folded)) return { verdict: 'accents', best: a, check: checkDictation(a, given, opts) };
  }
  return { verdict: 'wrong', best, check: bestCheck };
}

function ratio(c: DictationCheck): number {
  const denom = Math.max(c.total, 1) + extraCount(c);
  return c.correct / denom;
}

function extraCount(c: DictationCheck): number {
  return c.ops.filter(op => op.type === 'extra').length;
}

function isPerfect(c: DictationCheck): boolean {
  return c.total > 0 && c.correct === c.total && extraCount(c) === 0;
}
