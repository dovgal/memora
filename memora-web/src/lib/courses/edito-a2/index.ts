// Тренажёр Édito A2 — юниты по программе уровня A2.
// Использует те же типы и компоненты, что и тренажёр Édito A1.

import type { EditoUnit } from '@/lib/courses/edito-a1';

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
import unite12 from './unite12.json';

export const EDITO_A2_UNITS: Record<string, EditoUnit> = {
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
  '12': unite12 as unknown as EditoUnit,
};

export const A2_UNIT_ORDER = ['1','2','3','4','5','6','7','8','9','10','11','12'];

/** ID курса для прогресса, коуча и статистики. */
export const EDITO_A2_COURSE_ID = 'edito-a2';
