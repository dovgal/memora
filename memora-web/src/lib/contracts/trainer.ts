// Договор между сервером и тренажёром карточек.
//
// Упражнения больше не придумываются на лету под каждую карточку одинаково:
// сервер сначала узнаёт, что на карточке (слово какой части речи, фраза,
// предложение), подбирает подходящие этому виды заданий, а судья отбраковывает
// бессмысленные и неоднозначные. Прошедшие проверку хранятся и переиспользуются.
//
//   POST /api/sets/{id}/trainer/prepare   { cardIds?: string[], limit?: number } → PreparedSet
//   POST /api/cards/{id}/mnemonic          {}                                    → { mnemonic: string }
//   Фраза с выученным словом проверяется существующим /api/ai/course/check-production.

export type CardKind = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase' | 'sentence' | 'other';

export type ExerciseKind =
  | 'recognize'  // выбрать верный перевод из вариантов (options)
  | 'recall'     // вспомнить и написать
  | 'listen'     // услышать и записать
  | 'speak'      // сказать вслух, проверка произношения
  | 'gender'     // род существительного: le / la
  | 'conjugate'  // нужная форма глагола
  | 'cloze'      // вставить слово в пример
  | 'build';     // построить свою фразу с этим словом

export interface CardProfile {
  cardId: string;
  kind: CardKind;
  /** Язык лицевой и оборотной стороны: 'fr', 'ru', 'en'… */
  langFront: string;
  langBack: string;
  lemma?: string | null;
  gender?: 'm' | 'f' | null;
  example?: { text: string; translation: string } | null;
  mnemonic?: string | null;
}

export interface TrainerExercise {
  id: string;
  cardId: string;
  kind: ExerciseKind;
  prompt: string;
  promptLang: string;
  /** Эталон. Без него упражнение не выдаётся — судье нечего сверять. */
  answer: string;
  acceptedAnswers: string[];
  answerLang: string;
  /** Для recognize и gender: варианты, верный среди них ровно один. */
  options?: string[] | null;
  hint?: string | null;
  explanation?: string | null;
  /** Уверенность судьи в том, что задание осмысленно и ответ однозначен (0–1). */
  confidence: number;
}

export interface PreparedSet {
  profiles: CardProfile[];
  exercises: TrainerExercise[];
  /** Сколько карточек ещё без проверенных упражнений — можно дозапросить. */
  pending: number;
}
