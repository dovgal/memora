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
import genre from './genre.json';
import numeros from './numeros.json';

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
  'genre': genre as unknown as EditoUnit,
  'numeros': numeros as unknown as EditoUnit,
};

export const UNIT_ORDER = ['1','2','3','4','5','6','7','8','9','10'];
export const SPECIAL_MODULES = ['genre', 'numeros'];

export interface EditoExercise {
  id: string;
  type: 'theory' | 'grammar-quiz' | 'sentence-builder' | 'gender-quiz' | 'dialogue' | 'fill-blank' | 'number-quiz' | 'listening' | 'video';
  title: string;
  // theory
  content?: string;
  // grammar-quiz
  questions?: GrammarQuestion[];
  // sentence-builder
  sentence?: string;
  words?: string[];
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
  answer: string;
  hint?: string;
}

export interface EditoUnit {
  title: string;
  description: string;
  exercises: EditoExercise[];
}
