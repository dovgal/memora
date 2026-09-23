// Превращает состав занятия (PlannedCard[]) в очередь конкретных заданий
// (SessionItem[]): для каждой карточки лесенка выбирает вид упражнения среди
// того, что реально доступно — подготовлено сервером или собирается локально.
//
// Новая карточка получает два пункта: сперва узнать среди вариантов, а через
// несколько других заданий — вспомнить самому. Сразу подряд второй шаг был бы
// бесполезен: ответ ещё висит перед глазами, вспоминать нечего.

import { chooseExerciseKind, followUpKind } from './ladder';
import type { ExerciseKind, PlannedCard, SessionItem } from './types';

/** Через сколько пунктов после узнавания новой карточки просим вспомнить её. */
export const FOLLOW_UP_GAP = 3;

export function buildSessionQueue(
  cards: PlannedCard[],
  availableKinds: (cardId: string) => ReadonlySet<ExerciseKind>,
  opts: { followUpGap?: number } = {},
): SessionItem[] {
  const gap = opts.followUpGap ?? FOLLOW_UP_GAP;
  const out: SessionItem[] = [];
  const waiting: { item: SessionItem; remaining: number }[] = [];

  for (const c of cards) {
    const available = availableKinds(c.cardId);
    const kind = chooseExerciseKind(c.stage, c.leech, available, c.seed);
    out.push({ cardId: c.cardId, kind, attempt: 1, missCount: 0 });

    for (const w of waiting) w.remaining--;
    while (waiting.length > 0 && waiting[0].remaining <= 0) out.push(waiting.shift()!.item);

    const second = followUpKind(c.stage, c.leech, kind, available);
    if (second) {
      waiting.push({ item: { cardId: c.cardId, kind: second, attempt: 1, missCount: 0, followUp: true }, remaining: gap });
    }
  }
  for (const w of waiting) out.push(w.item);
  return out;
}

/**
 * Переигрывает вид упражнения у ещё не показанных первых шагов, когда
 * доступных видов стало больше (сервер дослал упражнения) или меньше
 * (выключили звук, отказались говорить). Показанное, новые карточки и
 * возвраты после промаха не трогаем: у них вид выбран осознанно.
 */
export function repickUpcoming(
  queue: SessionItem[],
  fromIndex: number,
  planned: ReadonlyMap<string, PlannedCard>,
  availableKinds: (cardId: string) => ReadonlySet<ExerciseKind>,
): SessionItem[] {
  let changed = false;
  const next = queue.map((item, i) => {
    if (i < fromIndex || item.followUp || item.attempt > 1) return item;
    const p = planned.get(item.cardId);
    // Новая карточка уже разложена на два шага — узнать и вспомнить; менять
    // первый задним числом значит оставить второй без пары.
    if (!p || p.stage === 'new') return item;
    const kind = chooseExerciseKind(p.stage, p.leech, availableKinds(item.cardId), p.seed);
    if (kind === item.kind) return item;
    changed = true;
    return { ...item, kind };
  });
  return changed ? next : queue;
}
