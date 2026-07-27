// Типы корпуса курса фонетики. Материал — конспекты пяти уроков «Ставим
// произношение»: артикуляционная гимнастика, звуки, минимальные пары,
// фразы-лесенки (фраза наращивается шаг за шагом) и скороговорки.

/** Артикуляционная разминка: движение речевого аппарата, а не звук. */
export interface ArticulationDrill {
  id: string;
  title: string;
  /** Что делать — по шагам. */
  steps: string[];
  /** Зачем это нужно для французского. */
  why: string;
  /** Рекомендуемая длительность, сек. */
  seconds: number;
}

/** Минимальная пара: два слова, различающиеся одним звуком. */
export interface MinimalPair {
  a: string;
  b: string;
  /** Чем различаются — коротко. */
  hint: string;
}

/**
 * Фраза-лесенка: каждая ступень длиннее предыдущей и включает её целиком.
 * Приём из материалов курса — сначала короткое ядро, затем наращивание.
 */
export interface Ladder {
  /** Ступени от короткой к длинной. */
  steps: string[];
  translation?: string;
}

/** Блок работы над одним звуком (или противопоставлением пары звуков). */
export interface SoundDrill {
  id: string;
  /** Номер урока-источника (1–5). */
  lesson: number;
  /** Символ(ы) МФА. */
  ipa: string;
  title: string;
  /** Типичная ошибка русскоязычного — что именно идёт не так. */
  problem: string;
  /** Как ставить звук: положение органов речи. */
  howTo: string;
  /** Когда так читается (буквосочетания и позиции). */
  spellings?: string[];
  /** Слова из материалов урока. */
  words: string[];
  /** Долгий вариант звука (перед /z, r, v, vr, ʒ/) — из урока 2. */
  longWords?: string[];
  pairs?: MinimalPair[];
  /** Отдельные фразы. */
  phrases?: string[];
  ladders?: Ladder[];
  /** Скороговорка (virelangue). */
  twister?: string;
  /** Исключения и подводные камни. */
  exceptions?: string[];
}

/** Урок курса: разминка + звуки. */
export interface PhoneticsLesson {
  n: number;
  title: string;
  subtitle: string;
  articulation: ArticulationDrill[];
  drills: SoundDrill[];
}
