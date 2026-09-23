// Планировщик занятия: какие карточки войдут и в каком порядке.
//
// Правило простое и намеренно не хитрое: сперва то, что уже пора повторить
// (просроченное — раньше свежепросроченного), затем немного нового — ровно
// столько, чтобы не захлебнуться, — и всё это перемешано, а не блоком
// «сначала все повторы, потом всё новое»: занятие должно ощущаться живым, а
// не как две разные домашки подряд.

import { isLeech, kindSeed, ladderStageFor } from './ladder';
import type { CardSchedule, PlannedCard } from './types';

export const DEFAULT_MAX_NEW_CARDS = 8;
/** Предел пунктов очереди без учёта возвратов после промахов: 15–20 — минут десять. */
export const DEFAULT_MAX_ITEMS = 18;
/** Новая карточка занимает два пункта: узнать, затем вспомнить (см. queue.ts). */
export const ITEMS_PER_NEW_CARD = 2;
/** Занятие «сверх плана» короче обычного: это закрепление, а не обязательная работа. */
export const DEFAULT_MAX_PRACTICE = 12;

/** Карточка новая: FSRS о ней ещё ничего не знает. */
export function isNewCard(schedule: Pick<CardSchedule, 'state' | 'reps'>): boolean {
  return schedule.state === 0 || schedule.reps === 0;
}

/** Карточка подошла к повтору: не новая и срок (due) уже наступил или не задан. */
export function isDueForReview(schedule: CardSchedule, now: Date): boolean {
  if (isNewCard(schedule)) return false;
  if (!schedule.due) return true;
  return new Date(schedule.due).getTime() <= now.getTime();
}

/**
 * Просроченные карточки — от самой просроченной к едва подошедшей.
 * Без даты (due отсутствует, но карточка не новая — гость из старых данных)
 * считаем самой просроченной: её и так пропустили неизвестно насколько.
 */
export function mostOverdueFirst(schedules: CardSchedule[], now: Date): CardSchedule[] {
  const overdueMs = (s: CardSchedule): number => {
    if (!s.due) return Number.POSITIVE_INFINITY;
    return now.getTime() - new Date(s.due).getTime();
  };
  return [...schedules].sort((a, b) => overdueMs(b) - overdueMs(a));
}

/**
 * Сливает два списка так, чтобы secondary был равномерно рассыпан по primary,
 * а не приклеен одним куском в конец. Порядок внутри каждого списка не
 * меняется — только чередование между ними.
 */
export function interleave<T>(primary: T[], secondary: T[]): T[] {
  if (secondary.length === 0) return [...primary];
  if (primary.length === 0) return [...secondary];

  const result: T[] = [];
  const ratio = primary.length / secondary.length;
  let sIdx = 0;
  primary.forEach((item, i) => {
    result.push(item);
    const shouldHaveInserted = Math.floor((i + 1) / ratio);
    while (shouldHaveInserted > sIdx && sIdx < secondary.length) {
      result.push(secondary[sIdx]);
      sIdx++;
    }
  });
  while (sIdx < secondary.length) result.push(secondary[sIdx++]);
  return result;
}

export interface PlanSessionOptions {
  now?: Date;
  maxNewCards?: number;
  maxItems?: number;
  maxPractice?: number;
}

function toPlanned(s: CardSchedule, reason: PlannedCard['reason']): PlannedCard {
  return {
    cardId: s.cardId,
    stage: ladderStageFor(s),
    leech: isLeech(s),
    isNew: isNewCard(s),
    reason,
    seed: kindSeed(s.cardId, s.reps),
  };
}

/**
 * Собирает состав занятия: due-карточки (просроченные раньше) плюс горстка
 * новых, суммарно не больше maxItems пунктов очереди (новая стоит двух).
 * Due всегда в приоритете — если их уже больше лимита, новые в это занятие
 * не попадают вовсе: до нового не так срочно, а забытое — срочно.
 *
 * Если ни повторять, ни учить нечего, человека не выгоняем с пустым экраном:
 * даём закрепление сверх плана — карточки, чей срок подойдёт раньше всех
 * (при равенстве — с наименьшей стабильностью, то есть самые хрупкие).
 */
export function planSession(schedules: CardSchedule[], opts: PlanSessionOptions = {}): PlannedCard[] {
  const now = opts.now ?? new Date();
  const maxNewCards = opts.maxNewCards ?? DEFAULT_MAX_NEW_CARDS;
  const maxItems = opts.maxItems ?? DEFAULT_MAX_ITEMS;
  const maxPractice = opts.maxPractice ?? DEFAULT_MAX_PRACTICE;

  const due = mostOverdueFirst(schedules.filter(s => isDueForReview(s, now)), now).slice(0, maxItems);
  const room = Math.max(0, maxItems - due.length);
  const newSlots = Math.min(maxNewCards, Math.floor(room / ITEMS_PER_NEW_CARD));
  const fresh = schedules.filter(isNewCard).slice(0, newSlots);

  if (due.length === 0 && fresh.length === 0) {
    const dueTime = (s: CardSchedule) => (s.due ? new Date(s.due).getTime() : 0);
    return schedules
      .filter(s => !isNewCard(s))
      .sort((a, b) => dueTime(a) - dueTime(b) || a.stability - b.stability)
      .slice(0, maxPractice)
      .map(s => toPlanned(s, 'practice'));
  }

  return interleave(
    due.map(s => toPlanned(s, 'due')),
    fresh.map(s => toPlanned(s, 'new')),
  );
}

/** Сколько новых карточек осталось за бортом занятия — для совета «что дальше». */
export function newCardsLeft(schedules: CardSchedule[], planned: PlannedCard[]): number {
  const plannedNew = planned.filter(p => p.isNew).length;
  return Math.max(0, schedules.filter(isNewCard).length - plannedNew);
}
