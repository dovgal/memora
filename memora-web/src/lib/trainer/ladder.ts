// Лесенка упражнений по каждой карточке.
//
// Слово, которое видишь впервые, и слово, которое уже сидит в памяти месяц, —
// не одно и то же занятие: первому нужно узнавание, второму — активная речь.
// Лесенка подбирает вид упражнения под то, что FSRS уже знает о карточке.

import type { CardSchedule, ExerciseKind, LadderStage } from './types';

/** Стабильность (в днях), начиная с которой карточку можно считать выученной. */
export const MATURE_STABILITY_DAYS = 21;

/** Столько провалов подряд — карточка-леч: лесенка упрощается, нужна мнемоника. */
export const LEECH_LAPSES = 4;

/**
 * Виды упражнений каждой ступени.
 *
 * new — последовательность: сперва узнать среди вариантов, затем (вторым
 * пунктом очереди, см. queue.ts) вспомнить самому. learning и mature — набор,
 * из которого берётся один вид, разный от занятия к занятию: если всегда
 * брать первый доступный, карточка годами видела бы одно recall, а listen,
 * cloze и gender так бы и не дождались своей очереди.
 */
export const LADDER: Record<LadderStage, ExerciseKind[]> = {
  new: ['recognize', 'recall'],
  learning: ['recall', 'listen', 'cloze', 'gender'],
  mature: ['speak', 'conjugate', 'build'],
};

/** Упрощённая лесенка для карточек-лечей: только надёжное узнавание и вспоминание. */
export const LEECH_LADDER: ExerciseKind[] = ['recognize', 'recall'];

/** Отступ, когда из лесенки ничего не доступно: эти два строятся из любой карточки. */
const FALLBACK: ExerciseKind[] = ['recall', 'recognize'];

/**
 * Ступень лесенки по состоянию FSRS.
 *
 * Новая карточка (state 0 либо вовсе без повторов) — «new». Зрелая — только
 * state 2 (Review) со стабильностью не ниже порога: одно попадание в Review
 * ничего не доказывает, если срок жизни памяти — пара дней. Всё остальное,
 * включая Relearning (state 3), — «learning»: карточка ещё нетвёрдая.
 */
export function ladderStageFor(schedule: Pick<CardSchedule, 'state' | 'stability' | 'reps'>): LadderStage {
  if (schedule.state === 0 || schedule.reps === 0) return 'new';
  if (schedule.state === 2 && schedule.stability >= MATURE_STABILITY_DAYS) return 'mature';
  return 'learning';
}

/** Карточка-леч: FSRS уже не первый раз её теряет. */
export function isLeech(schedule: Pick<CardSchedule, 'lapses'>): boolean {
  return schedule.lapses >= LEECH_LAPSES;
}

/**
 * Число для выбора вида упражнения: зависит от карточки и от числа её
 * повторов. Внутри занятия стабильно (не мигает при перерисовке), а в
 * следующем занятии reps уже другой — и вид упражнения тоже сменится.
 */
export function kindSeed(cardId: string, reps: number): number {
  let h = 0;
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) | 0;
  return Math.abs(h + reps * 7919);
}

function firstAvailable(kinds: ExerciseKind[], available: ReadonlySet<ExerciseKind>): ExerciseKind | null {
  return kinds.find(k => available.has(k)) ?? null;
}

/**
 * Выбирает вид упражнения для карточки среди реально доступных (подготовлено
 * сервером или безопасно собирается локально).
 *
 * Леч и новая карточка — первый доступный по порядку лесенки (узнавание
 * прежде вспоминания). learning/mature — один из доступных видов ступени по
 * seed. Если на ступени ничего не доступно — отступаем на recall/recognize.
 */
export function chooseExerciseKind(
  stage: LadderStage,
  leech: boolean,
  availableKinds: ReadonlySet<ExerciseKind>,
  seed = 0,
): ExerciseKind {
  if (leech || stage === 'new') {
    const picked = firstAvailable(leech ? LEECH_LADDER : LADDER.new, availableKinds);
    if (picked) return picked;
  } else {
    const candidates = LADDER[stage].filter(k => availableKinds.has(k));
    if (candidates.length > 0) return candidates[Math.abs(seed) % candidates.length];
  }
  // Совсем ничего не доступно — вызывающий код всё равно соберёт recall,
  // если у карточки есть хоть какой-то текст; лесенке дальше отступать некуда.
  return firstAvailable(FALLBACK, availableKinds) ?? 'recall';
}

/**
 * Второй шаг новой карточки в том же занятии: узнал среди вариантов — теперь
 * вспомни сам. null — второго шага нет (карточка не новая, леч, или первый
 * шаг уже был вспоминанием, потому что вариантов собрать не из чего).
 */
export function followUpKind(
  stage: LadderStage,
  leech: boolean,
  first: ExerciseKind,
  availableKinds: ReadonlySet<ExerciseKind>,
): ExerciseKind | null {
  if (stage !== 'new' || leech) return null;
  const idx = LADDER.new.indexOf(first);
  if (idx < 0) return null;
  return firstAvailable(LADDER.new.slice(idx + 1), availableKinds);
}
