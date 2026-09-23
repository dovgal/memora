// Краткосрочное переучивание внутри занятия.
//
// Промах не откладывается до завтрашнего FSRS-повтора — карточка возвращается
// через 3–5 пунктов очереди, пока ошибка ещё свежа в голове. Это отдельная от
// FSRS механика: FSRS планирует ДНИ, а здесь речь о МИНУТАХ внутри одной сессии.

import type { SessionItem } from './types';

export const MIN_GAP = 3;
export const MAX_GAP = 5;
/**
 * После стольких промахов по карточке в одном занятии больше её не
 * возвращаем: пятый круг по слову, которое сегодня не идёт, учит только
 * тому, что учиться неприятно. FSRS (Again) и так вернёт её завтра.
 */
export const MAX_MISSES_PER_SESSION = 3;

export interface RelearnOptions {
  minGap?: number;
  maxGap?: number;
  /** Источник случайности — подменяется в тестах для детерминизма. */
  rng?: () => number;
}

/**
 * Вставляет карточку обратно в очередь через 3–5 пунктов после текущей
 * позиции (currentIndex — индекс только что отвеченного пункта). Если очередь
 * до конца короче зазора, карточка уходит в самый конец — это lower bound,
 * а не жёсткое требование: лучше поздно, чем никогда в этом занятии.
 *
 * missCount у вставляемого пункта увеличивается на единицу — по нему потом
 * решают, когда показать мнемонику (после 2-го промаха).
 */
export function scheduleRelearn(
  queue: SessionItem[],
  currentIndex: number,
  item: SessionItem,
  opts: RelearnOptions = {},
): SessionItem[] {
  const minGap = opts.minGap ?? MIN_GAP;
  const maxGap = opts.maxGap ?? MAX_GAP;
  const rng = opts.rng ?? Math.random;

  const gap = minGap + Math.floor(rng() * (maxGap - minGap + 1));
  const insertAt = Math.min(currentIndex + 1 + gap, queue.length);

  const reinserted: SessionItem = {
    ...item,
    attempt: item.attempt + 1,
    missCount: item.missCount + 1,
  };

  const next = [...queue];
  next.splice(insertAt, 0, reinserted);
  return next;
}

/** Второй промах подряд по этой карточке в занятии — пора показать мнемонику. */
export function shouldShowMnemonic(item: Pick<SessionItem, 'missCount'>): boolean {
  return item.missCount >= 2;
}

/** Вернуть ли карточку ещё раз после этого промаха (item — пункт, на котором ошиблись). */
export function shouldRelearn(item: Pick<SessionItem, 'missCount'>): boolean {
  return item.missCount + 1 < MAX_MISSES_PER_SESSION;
}
