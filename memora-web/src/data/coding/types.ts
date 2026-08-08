// Типы контента раздела «Программирование» (Python + SQL).
// Контент живёт в коде фронтенда (см. python-course.ts / sql-course.ts),
// прогресс — в localStorage (см. lib/coding/progress.ts).

export type TrackId =
  | "python"
  | "sql"
  | "data-analyst"
  | "oop"
  | "statistics"
  | "data-cleaning"
  | "business-metrics"
  | "dataviz";

/** Блок теории: короткое объяснение простым языком, с примером кода. */
export interface TheoryBlock {
  kind: "theory";
  id: string;
  title: string;
  /** Абзацы текста. Поддерживается `код в бэктиках` для подсветки. */
  text: string[];
  /** Необязательный пример кода (только показать, не запускать). */
  code?: string;
  /** Подпись к примеру. */
  codeNote?: string;
}

/** Проверка решения Python-задачи. */
export interface PyCheck {
  /** Точный ожидаемый вывод (сравнение без хвостовых пробелов). */
  expectedOutput?: string;
  /** Вывод должен содержать все эти подстроки. */
  outputContains?: string[];
  /** Исходный код должен содержать все эти подстроки (например, "for "). */
  codeContains?: string[];
}

/** Игровая задача: написать Python-код в песочнице. */
export interface PyTaskBlock {
  kind: "py-task";
  id: string;
  title: string;
  /** Условие задачи — игровая формулировка. */
  story: string[];
  starterCode: string;
  check: PyCheck;
  hints: string[];
  /** Эталонное решение — показывается после 3 неудачных попыток по кнопке. */
  solution: string;
  xp: number;
}

export interface SqlExpectedRows {
  /** Ожидаемые строки результата: массив массивов значений (строками). */
  rows: string[][];
  /** Важен ли порядок строк (для ORDER BY). По умолчанию — нет. */
  orderMatters?: boolean;
  /** Ожидаемые имена колонок (необязательно). */
  columns?: string[];
}

/** Проверка решения SQL-задачи. */
export interface SqlCheck {
  /** Сравнить результат запроса ученика с ожидаемыми строками. */
  expected?: SqlExpectedRows;
  /**
   * Для INSERT/UPDATE/DELETE: после кода ученика выполнить контрольный запрос
   * и сравнить его результат с checkRows.
   */
  checkQuery?: string;
  checkRows?: string[][];
  /** Код ученика должен содержать эти подстроки (без учёта регистра). */
  codeContains?: string[];
}

/** Игровая задача: написать SQL-запрос в песочнице. */
export interface SqlTaskBlock {
  kind: "sql-task";
  id: string;
  title: string;
  story: string[];
  starterCode: string;
  check: SqlCheck;
  hints: string[];
  solution: string;
  xp: number;
}

export interface QuizQuestion {
  question: string;
  /** Вариант может содержать `код`. */
  options: string[];
  correctIndex: number;
  explain: string;
}

/** Мини-викторина в конце урока. */
export interface QuizBlock {
  kind: "quiz";
  id: string;
  title: string;
  questions: QuizQuestion[];
  xp: number;
}

export type LessonBlock = TheoryBlock | PyTaskBlock | SqlTaskBlock | QuizBlock;

export interface Lesson {
  id: string;
  emoji: string;
  title: string;
  /** Короткое описание для карточки урока. */
  subtitle: string;
  blocks: LessonBlock[];
  /**
   * Для SQL-уроков: SQL, который создаёт и наполняет таблицы перед задачами.
   * Выполняется в свежей базе PGlite при открытии каждой задачи.
   */
  seedSql?: string;
}

export interface Track {
  id: TrackId;
  emoji: string;
  title: string;
  tagline: string;
  /** Вступление на странице трека. */
  intro: string[];
  color: "green" | "blue" | "purple" | "orange" | "teal" | "pink" | "cyan" | "amber";
  lessons: Lesson[];
  /** Бейдж за прохождение всего трека. */
  finalBadge: { id: string; emoji: string; title: string };
}
