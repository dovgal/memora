// Тренажёр «Mettre & Remettre» — устойчивые выражения с глаголами mettre и remettre.
// Использует те же типы и компоненты, что тренажёры Édito A1 / A2.

import type { EditoUnit } from '@/lib/courses/edito-a1';

import unite1 from './unite1.json';
import unite2 from './unite2.json';
import unite3 from './unite3.json';

export const METTRE_UNITS: Record<string, EditoUnit> = {
  '1': unite1 as unknown as EditoUnit,
  '2': unite2 as unknown as EditoUnit,
  '3': unite3 as unknown as EditoUnit,
};

export const METTRE_UNIT_ORDER = ['1', '2', '3'];

/** ID курса для прогресса, коуча и статистики. */
export const METTRE_COURSE_ID = 'mettre-remettre';
