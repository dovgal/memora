// Корпус курса фонетики: пять уроков + производные выборки для тренажёра.

import type { PhoneticsLesson, SoundDrill } from './corpusTypes';
import { LESSON_1, LESSON_2, LESSON_3 } from './lessons1to3';
import { LESSON_4, LESSON_5 } from './lessons4to5';

export * from './corpusTypes';

export const PHONETICS_LESSONS: PhoneticsLesson[] = [LESSON_1, LESSON_2, LESSON_3, LESSON_4, LESSON_5];

/** Все блоки звуков подряд, в порядке уроков — это и есть маршрут курса. */
export const ALL_DRILLS: SoundDrill[] = PHONETICS_LESSONS.flatMap(l => l.drills);

export function drillById(id: string): SoundDrill | undefined {
  return ALL_DRILLS.find(d => d.id === id);
}

export function lessonByNumber(n: number): PhoneticsLesson | undefined {
  return PHONETICS_LESSONS.find(l => l.n === n);
}

/**
 * Материал блока, разложенный по ступеням сложности: отдельные слова →
 * минимальные пары → фразы → ступени лесенок → скороговорка. Тренажёр ведёт
 * ученика ровно в этом порядке — от простого к сложному.
 */
export type StageKind = 'word' | 'pair' | 'phrase' | 'ladder' | 'twister';

export interface DrillItem {
  kind: StageKind;
  /** Что произносить. */
  text: string;
  /** Для минимальных пар — второе слово; произносятся подряд. */
  second?: string;
  hint?: string;
  /** Для лесенки: номер ступени и всего ступеней. */
  ladderStep?: { i: number; of: number };
}

export function drillItems(d: SoundDrill): DrillItem[] {
  const items: DrillItem[] = [];
  for (const w of d.words) items.push({ kind: 'word', text: w });
  for (const w of d.longWords ?? []) items.push({ kind: 'word', text: w, hint: 'долгий вариант звука' });
  for (const p of d.pairs ?? []) items.push({ kind: 'pair', text: p.a, second: p.b, hint: p.hint });
  for (const ph of d.phrases ?? []) items.push({ kind: 'phrase', text: ph });
  for (const l of d.ladders ?? []) {
    l.steps.forEach((s, i) => items.push({
      kind: 'ladder',
      text: s,
      hint: i === 0 ? l.translation : undefined,
      ladderStep: { i: i + 1, of: l.steps.length },
    }));
  }
  if (d.twister) items.push({ kind: 'twister', text: d.twister, hint: 'скороговорка — читайте сначала медленно' });
  return items;
}

/** Сколько всего материала в курсе — для обзорного экрана. */
export function corpusStats() {
  const drills = ALL_DRILLS.length;
  let words = 0, phrases = 0, ladders = 0, twisters = 0, pairs = 0;
  for (const d of ALL_DRILLS) {
    words += d.words.length + (d.longWords?.length ?? 0);
    phrases += d.phrases?.length ?? 0;
    ladders += d.ladders?.length ?? 0;
    pairs += d.pairs?.length ?? 0;
    if (d.twister) twisters += 1;
  }
  const articulation = PHONETICS_LESSONS.reduce((n, l) => n + l.articulation.length, 0);
  return { lessons: PHONETICS_LESSONS.length, drills, words, phrases, ladders, pairs, twisters, articulation };
}
