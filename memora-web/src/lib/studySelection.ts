// Часть набора для занятия.
//
// Курс задаёт партию — «с 1 по 20», — и переходя из него к карточкам, человек
// ждёт тех же двадцати глаголов, а не всех ста двадцати пяти. Отбор задаётся
// в адресе, поэтому ссылка из курса открывает нужное сразу, а сам режим
// занятий остаётся общим и ничего не знает ни про какие глаголы.

export interface CardRange {
  /** Место карточки в наборе, считая с единицы. */
  from: number;
  to: number;
}

/** Разбор «1-20». Мусор и вывернутые границы — как будто отбора нет. */
export function parseRange(raw: string | null | undefined): CardRange | null {
  if (!raw) return null;
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const from = Number(m[1]);
  const to = Number(m[2]);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (from < 1 || to < from) return null;
  return { from, to };
}

/**
 * Отбирает карточки по местам в наборе.
 *
 * Считаем по порядку в списке, а не по содержимому: так отбор работает в любом
 * наборе, а не только в глаголах, и не зависит от того, что у карточки внутри.
 */
export function selectCards<T>(cards: T[], range: CardRange | null): T[] {
  if (!range) return cards;
  return cards.slice(range.from - 1, range.to);
}
