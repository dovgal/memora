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
    units: { '1': U(b2u1), '2': U(b2u2), '3': U(b2u3), '4': U(b2u4), '5': U(b2u5), '6': U(b2u6) },
    order: ['1','2','3','4','5','6'],
  },
  c1: {
    id: 'c1', courseId: 'niveau-c1', title: 'Французский C1', level: 'C1',
    description: 'Свободное владение: модализация, литературные времена, продвинутые коннекторы, регистры, книжный синтаксис.',
    accent: 'amber',
    units: { '1': U(c1u1), '2': U(c1u2), '3': U(c1u3), '4': U(c1u4), '5': U(c1u5) },
    order: ['1','2','3','4','5'],
  },
  c2: {
    id: 'c2', courseId: 'niveau-c2', title: 'Французский C2', level: 'C2',
    description: 'Мастерство: синтез и реформулировка, фигуры речи, идиоматика soutenu, искусство аргументации, грамматические тонкости.',
    accent: 'rose',
    units: { '1': U(c2u1), '2': U(c2u2), '3': U(c2u3), '4': U(c2u4), '5': U(c2u5) },
    order: ['1','2','3','4','5'],
  },
};
