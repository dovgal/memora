import unite1 from './unite1.json';
import unite2 from './unite2.json';
import unite3 from './unite3.json';
import unite4 from './unite4.json';
import unite5 from './unite5.json';
import unite6 from './unite6.json';
import unite7 from './unite7.json';
import unite8 from './unite8.json';
import unite9 from './unite9.json';
import unite10 from './unite10.json';
import unite11 from './unite11.json';
import genre from './genre.json';
import numeros from './numeros.json';
import phonetique from './phonetique.json';
import delf from './delf.json';

export const EDITO_A1_UNITS: Record<string, EditoUnit> = {
  '1': unite1 as unknown as EditoUnit,
  '2': unite2 as unknown as EditoUnit,
  '3': unite3 as unknown as EditoUnit,
  '4': unite4 as unknown as EditoUnit,
  '5': unite5 as unknown as EditoUnit,
  '6': unite6 as unknown as EditoUnit,
  '7': unite7 as unknown as EditoUnit,
  '8': unite8 as unknown as EditoUnit,
  '9': unite9 as unknown as EditoUnit,
  '10': unite10 as unknown as EditoUnit,
  '11': unite11 as unknown as EditoUnit,
  'genre': genre as unknown as EditoUnit,
  'numeros': numeros as unknown as EditoUnit,
  'phonetique': phonetique as unknown as EditoUnit,
  'delf': delf as unknown as EditoUnit,
};

export const UNIT_ORDER = ['1','2','3','4','5','6','7','8','9','10','11'];
export const SPECIAL_MODULES = ['genre', 'numeros', 'phonetique', 'delf'];

/**
 * Типизированный ответ упражнения (Subject Packs, фаза 1).
 * `kind` задаёт стратегию проверки; поля зависят от kind (errorIndex/correction
 * для error-hunt, correctOption для mcq и т.д.). Старые упражнения без `answer`
 * продолжают работать по `type` — обратная совместимость обязательна.
 */
export interface ExerciseAnswer {
  kind: 'error-hunt' | 'mcq' | 'cloze' | 'short-text' | 'ordering' | 'numeric' | 'symbolic' | 'reaction' | 'open-rubric';
  [key: string]: unknown;
}

export interface ExerciseRule {
  id?: string;
  skill?: string;
  point?: string;
  trap?: string;
  examplesCorrect?: string[];
  /** Уровень правила (CEFR для языков, класс для школьных предметов). */
  level?: string;
  /** Legacy-алиас level для старого контента — читать через ruleLevel(). */
  cefr?: string;
}

/** Уровень правила с фолбэком на legacy-поле cefr. */
export function ruleLevel(ex: EditoExercise): string | undefined {
  return ex.rule?.level ?? ex.rule?.cefr;
}

export interface EditoExercise {
  id: string;
  type: 'theory' | 'grammar-quiz' | 'sentence-builder' | 'gender-quiz' | 'dialogue' | 'fill-blank' | 'number-quiz' | 'listening' | 'video' | 'error-hunt' | 'dictation' | 'numeric' | 'ordering' | 'symbolic';
  title: string;
  // symbolic (математика): ответ — выражение; эквивалентность проверяет CAS-сервис
  // (POST /api/check/symbolic): «2(x+1)» засчитывается как «2x+2».
  expectedExpression?: string;
  // numeric (STEM): задача с числовым ответом. Проверка детерминированная —
  // допуск (tolerance) + единицы измерения (unit / acceptedUnits с множителями).
  prompt?: string;
  numericAnswer?: number;
  tolerance?: number;
  unit?: string;
  acceptedUnits?: Record<string, number>;
  // ordering (история/этапы решения): элементы в ПРАВИЛЬНОМ порядке; ученику показываются перемешанными.
  orderItems?: string[];
  // dictation (dictée): фраза озвучивается (sentence), учащийся печатает на слух,
  // проверка — детерминированный пословный diff. translation — перевод для итогового экрана.
  translation?: string;
  // error-hunt (какография, метод Voltaire): найти ошибочное слово в предложении
  // sentence уже объявлен ниже (sentence-builder). errorIndex=null → ошибки нет.
  errorIndex?: number | null;
  correction?: string;
  explanation?: string;
  /** Типизированный ответ (новый формат) — опционален, старый контент живёт без него. */
  answer?: ExerciseAnswer;
  // Метаданные правила и политика регенерации варианта на повторе (Voltaire).
  rule?: ExerciseRule;
  variantPolicy?: { regenerateOnRepeat?: boolean; format?: 'error-hunt' | 'preserve'; avoidLastN?: number };
  // theory
  content?: string;
  // grammar-quiz
  questions?: GrammarQuestion[];
  // sentence-builder
  sentence?: string;
  words?: string[];
  sentences?: Array<{ words: string[]; ru: string }>;
  // gender-quiz
  items?: GenderItem[] | NumberItem[];
  // dialogue
  context?: string;
  exchanges?: DialogueExchange[];
  // fill-blank
  text?: string;
  blanks?: BlankItem[];
  // number-quiz
  mode?: 'digit-to-word' | 'word-to-digit';
  // listening
  audioFile?: string;
  source?: string;
  transcript?: string;
  // video
  videoFile?: string;
  description?: string;
}

export interface GrammarQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface GenderItem {
  word: string;
  article: string;
  ru?: string;
  emoji?: string;
  hint?: string;
}

export interface NumberItem {
  number: number;
  french: string;
  explanation?: string;
  hint?: string;
}

export interface DialogueExchange {
  speaker: string;
  side: 'left' | 'right';
  text?: string;
  isBlank?: boolean;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
}

export interface BlankItem {
  correctAnswer: string;
  answer?: string; // legacy alias
  options?: string[];
  hint?: string;
  explanation?: string;
}

/** Результат выполнения упражнения: сколько ответов правильно с первой попытки. */
export interface ExerciseResult {
  correct: number;
  total: number;
  /** Неверные ответы учащегося (для умных дистракторов в генерации практики). */
  wrongAnswers?: string[];
}

export interface VocabularyItem {
  fr: string;
  ru: string;
  type?: string; // 'word' | 'phrase'
  /** Фонетическая транскрипция МФА (без квадратных скобок), напр. "bɔ̃ʒuʁ". */
  ipa?: string;
}

export interface EditoUnit {
  title: string;
  description: string;
  vocabulary?: VocabularyItem[];
  exercises: EditoExercise[];
}
