// Общие типы тренажёра карточек.
//
// Держим их отдельно от логики (planner/ladder/rating/relearn), чтобы каждый
// модуль оставался чистыми функциями без побочных эффектов — так их проверяют
// node:test без запуска браузера и без сети. Именно поэтому ExerciseKind здесь
// не импортируется из lib/contracts/trainer.ts (путь с «@/» компилятор тестов
// собрать может, а node в скомпилированном .js — нет): союз продублирован и
// должен вручную оставаться тем же, что в контракте с сервером.
export type ExerciseKind =
  | 'recognize'
  | 'recall'
  | 'listen'
  | 'speak'
  | 'gender'
  | 'conjugate'
  | 'cloze'
  | 'build';

/** Состояние карточки по FSRS: 0=New, 1=Learning, 2=Review, 3=Relearning. */
export type FsrsState = 0 | 1 | 2 | 3;

/** Срез состояния одной карточки, которого достаточно, чтобы спланировать занятие. */
export interface CardSchedule {
  cardId: string;
  state: FsrsState;
  /** ISO-дата следующего повторения; null — карточка ещё не изучалась (новая). */
  due: string | null;
  stability: number;
  lapses: number;
  reps: number;
}

/** Место карточки в лесенке сложности упражнений. */
export type LadderStage = 'new' | 'learning' | 'mature';

/** Карточка, отобранная в занятие, с уже определённой ступенью лесенки. */
export interface PlannedCard {
  cardId: string;
  stage: LadderStage;
  /** Много промахов подряд — леч: лесенка упрощается, показываем мнемонику. */
  leech: boolean;
  isNew: boolean;
  /**
   * Зачем карточка в занятии: пора повторить, новая или «сверх плана» —
   * когда ни повторять, ни учить нечего, а человек всё равно пришёл заниматься.
   */
  reason: 'due' | 'new' | 'practice';
  /** Число для разнообразия упражнений: меняется от занятия к занятию (reps растёт). */
  seed: number;
}

/** Один пункт очереди занятия: какая карточка и каким упражнением её спросить. */
export interface SessionItem {
  cardId: string;
  kind: ExerciseKind;
  /** Первый показ карточки в занятии, или это возврат после промаха. */
  attempt: number;
  /** Сколько раз эту карточку уже показывали неверно в этом занятии. */
  missCount: number;
  /**
   * Второй шаг новой карточки (после узнавания — вспомнить). Его вид задан
   * лесенкой жёстко и не переигрывается, когда с сервера приходят упражнения.
   */
  followUp?: boolean;
}

/** Итог одного ответа — вход для расчёта рейтинга FSRS. */
export interface AnswerOutcome {
  correct: boolean;
  usedHint: boolean;
  /** Ответили заметно быстрее обычного, без подсказки, с первой попытки. */
  fast: boolean;
  /** Ответили заметно медленнее обычного (раздумывали). */
  slow: boolean;
  /**
   * Задание на выбор из вариантов (recognize/gender): узнать легче, чем
   * вспомнить, поэтому даже быстрый ответ не тянет на Easy.
   */
  recognitionOnly?: boolean;
  /** Повтор после промаха в этом же занятии: ответ ещё свежий, Easy был бы самообманом. */
  retry?: boolean;
}

/** Рейтинг FSRS: 1=Again, 2=Hard, 3=Good, 4=Easy. */
export type FsrsRating = 1 | 2 | 3 | 4;

export type AnswerDirection = 'front-to-back' | 'back-to-front' | 'mixed';
export type GradingMode = 'strict' | 'soft';

export interface TrainerSettings {
  sound: boolean;
  direction: AnswerDirection;
  grading: GradingMode;
}

export const DEFAULT_TRAINER_SETTINGS: TrainerSettings = {
  sound: true,
  direction: 'mixed',
  grading: 'strict',
};
