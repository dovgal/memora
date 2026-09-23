// Шина праздников: любой тренажёр скармливает сюда результат reportStudyEvent,
// а CelebrationOverlay (смонтированный один раз в layout панели) слушает и
// показывает конфетти/карточку/звук. Раздельно от client.ts — там договор с
// сервером, тут только разбор ответа на «что показать» и рассылка подписчикам.

import type { Achievement, GameUpdate } from './client';

export type CelebrationEvent =
  | { kind: 'levelUp'; level: number }
  | { kind: 'achievement'; achievement: Achievement }
  | { kind: 'dailyGoal' };

type Listener = (event: CelebrationEvent) => void;
type UpdateListener = (update: GameUpdate) => void;

const listeners = new Set<Listener>();
// Отдельная, более «сырая» рассылка: GameHud нужны свежие цифры (XP, серия,
// дневной прогресс) после КАЖДОГО события, не только праздничного — иначе
// полоска опыта в шапке обновлялась бы только когда есть что отпраздновать.
const updateListeners = new Set<UpdateListener>();

export function onCelebration(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emitCelebration(event: CelebrationEvent): void {
  for (const listener of listeners) listener(event);
}

export function onGameUpdate(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  return () => { updateListeners.delete(listener); };
}

/**
 * Разбирает GameUpdate на события празднования. Чистая функция — тестируется
 * без DOM и без шины.
 *
 * Дневную цель ловим по переходу «до события было меньше цели → стало не
 * меньше». Прогресс «до» восстанавливаем из самого ответа (dailyProgress −
 * xpGained): сервер начисляет XP в прогресс сегодняшнего дня, а в новый день
 * прогресс начинается с нуля — так что разность и есть «было». Хранить
 * прошлое значение на клиенте было бы хуже: после перезагрузки страницы оно
 * обнулялось бы и цель, выполненная ещё утром, праздновалась бы повторно.
 */
export function celebrationsFromUpdate(update: GameUpdate): CelebrationEvent[] {
  const events: CelebrationEvent[] = [];
  if (update.leveledUp) {
    events.push({ kind: 'levelUp', level: update.level });
  }
  for (const achievement of update.newAchievements ?? []) {
    events.push({ kind: 'achievement', achievement });
  }
  const before = update.dailyProgress - Math.max(0, update.xpGained);
  const justHitGoal = update.dailyGoal > 0
    && update.xpGained > 0
    && before < update.dailyGoal
    && update.dailyProgress >= update.dailyGoal;
  if (justHitGoal) {
    events.push({ kind: 'dailyGoal' });
  }
  return events;
}

/**
 * Точка входа для тренажёров: скормить сюда результат reportStudyEvent.
 * Принимает null (сеть/сессия подвели) — тогда просто ничего не делает, чтобы
 * вызывать можно было цепочкой `reportStudyEvent(e).then(celebrate)`.
 */
export function celebrate(update: GameUpdate | null): void {
  if (!update) return;
  for (const listener of updateListeners) listener(update);
  for (const event of celebrationsFromUpdate(update)) emitCelebration(event);
}
