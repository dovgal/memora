// Тренажёры уровней B1–C2. Один формат (EditoUnit), общие компоненты,
// у каждого уровня свой courseId для прогресса/коуча/статистики.

import type { EditoUnit } from '@/lib/courses/edito-a1';

import b1u1 from './b1/unite1.json'; import b1u2 from './b1/unite2.json';
import b1u3 from './b1/unite3.json'; import b1u4 from './b1/unite4.json';
import b1u5 from './b1/unite5.json'; import b1u6 from './b1/unite6.json';
import b2u1 from './b2/unite1.json'; import b2u2 from './b2/unite2.json';
import b2u3 from './b2/unite3.json'; import b2u4 from './b2/unite4.json';
import b2u5 from './b2/unite5.json'; import b2u6 from './b2/unite6.json';
import c1u1 from './c1/unite1.json'; import c1u2 from './c1/unite2.json';
import c1u3 from './c1/unite3.json'; import c1u4 from './c1/unite4.json';
import c1u5 from './c1/unite5.json';
import c2u1 from './c2/unite1.json'; import c2u2 from './c2/unite2.json';
import c2u3 from './c2/unite3.json'; import c2u4 from './c2/unite4.json';
import c2u5 from './c2/unite5.json';
import b2u7 from './b2/unite7.json';
import c1u6 from './c1/unite6.json';
import c2u6 from './c2/unite6.json';
import pr1 from './presse/unite1.json'; import pr2 from './presse/unite2.json';
import pr3 from './presse/unite3.json';
import ph1 from './phonetique/unite1.json'; import ph2 from './phonetique/unite2.json';
import c2u7 from './c2/unite7.json'; import c2u8 from './c2/unite8.json';
import le1 from './lecture/unite1.json'; import le2 from './lecture/unite2.json';
import le3 from './lecture/unite3.json'; import le4 from './lecture/unite4.json';

const U = (m: unknown) => m as EditoUnit;

export interface LevelCourse {
  id: string;            // 'b1' | 'b2' | 'c1' | 'c2'
  courseId: string;      // для прогресса/коуча
  title: string;
  level: string;         // 'B1'…
  description: string;
  accent: string;        // tailwind-цвет акцента
  units: Record<string, EditoUnit>;
  order: string[];
}

export const LEVELS: Record<string, LevelCourse> = {
  b1: {
    id: 'b1', courseId: 'niveau-b1', title: 'Французский B1', level: 'B1',
    description: 'Пороговый уровень: рассказ о прошлом, мнение и субжонктив, гипотезы, местоимения, пассив, косвенная речь.',
    accent: 'sky',
    units: { '1': U(b1u1), '2': U(b1u2), '3': U(b1u3), '4': U(b1u4), '5': U(b1u5), '6': U(b1u6) },
    order: ['1','2','3','4','5','6'],
  },
  b2: {
    id: 'b2', courseId: 'niveau-b2', title: 'Французский B2', level: 'B2',
    description: 'Продвинутый уровень: все времена прошлого, выбор режима, гипотезы и сожаления, уступка, причастия, mise en relief.',
    accent: 'violet',
    units: { '1': U(b2u1), '2': U(b2u2), '3': U(b2u3), '4': U(b2u4), '5': U(b2u5), '6': U(b2u6), '7': U(b2u7) },
    order: ['1','2','3','4','5','6','7'],
  },
  c1: {
    id: 'c1', courseId: 'niveau-c1', title: 'Французский C1', level: 'C1',
    description: 'Свободное владение: модализация, литературные времена, продвинутые коннекторы, регистры, книжный синтаксис.',
    accent: 'amber',
    units: { '1': U(c1u1), '2': U(c1u2), '3': U(c1u3), '4': U(c1u4), '5': U(c1u5), '6': U(c1u6) },
    order: ['1','2','3','4','5','6'],
  },
  c2: {
    id: 'c2', courseId: 'niveau-c2', title: 'Французский C2', level: 'C2',
    description: 'Мастерство: синтез и реформулировка, фигуры речи, идиоматика soutenu, искусство аргументации, грамматические тонкости.',
    accent: 'rose',
    units: { '1': U(c2u1), '2': U(c2u2), '3': U(c2u3), '4': U(c2u4), '5': U(c2u5), '6': U(c2u6), '7': U(c2u7), '8': U(c2u8) },
    order: ['1','2','3','4','5','6','7','8'],
  },
  presse: {
    id: 'presse', courseId: 'niveau-presse', title: 'Язык прессы', level: 'B1–C1',
    description: 'Французский новостей: заголовки и их грамматика, лексика экономики и общества, глаголы цитирования и источники.',
    accent: 'cyan',
    units: { '1': U(pr1), '2': U(pr2), '3': U(pr3) },
    order: ['1','2','3'],
  },
  phonetique: {
    id: 'phonetique', courseId: 'niveau-phonetique', title: 'Фонетика B1–B2', level: 'B1–B2',
    description: 'Звучать естественно: ритмические группы и интонация, факультативные liaisons, выпадение e caduc, стиль и беглость.',
    accent: 'teal',
    units: { '1': U(ph1), '2': U(ph2) },
    order: ['1','2'],
  },
  lecture: {
    id: 'lecture', courseId: 'niveau-lecture', title: 'Lecture suivie — чтение книг', level: 'A2–B2',
    description: 'Компаньон к адаптированным книгам: план чтения по главам, проверка понимания сюжета, словарь книги — в личный набор. Читайте и слушайте ваше издание, проверяйте себя здесь.',
    accent: 'orange',
    units: { '1': U(le1), '2': U(le2), '3': U(le3), '4': U(le4) },
    order: ['1','2','3','4'],
  },
};
