// Ступени заучивания и приманки из форм того же глагола.
//
// Просить с ходу вписать три формы незнакомого слова — это экзамен, а не
// заучивание: ошибка гарантирована, а пользы от неё нет. Поэтому знакомство,
// узнавание и вспоминание разделены, и глагол поднимается по ним сам.

import type { IrregularVerb } from './types';
import { VERBS as VERBS_FOR_VOCAB } from './list';

export type LearnStep =
  | 'copy'    // впервые видим: формы показаны, надо списать
  | 'choice'  // выбрать верную из близких форм того же глагола
  | 'recall'; // вспомнить с чистого листа

/**
 * Ступень выбирается по числу ответов, а не по устойчивости: устойчивость
 * говорит, когда спрашивать, а нам нужно — насколько трудно спрашивать.
 * Два верных ответа подряд достаточно, чтобы перестать подсказывать.
 */
export function stepFor(reps: number, lapses: number): LearnStep {
  if (reps === 0) return 'copy';
  // После промаха возвращаемся на ступень ниже: с чистого листа он уже не смог.
  if (reps < 2 || (lapses > 0 && reps < 4)) return 'choice';
  return 'recall';
}

/** Гласные, которыми и различаются формы: begin — began — begun. */
const VOWELS = ['A', 'E', 'I', 'O', 'U'];

/** Все настоящие формы таблицы — чтобы не подсовывать выдуманных слов. */
function realForms(verbs: IrregularVerb[]): Set<string> {
  const set = new Set<string>();
  for (const v of verbs) {
    for (const raw of [v.inf, v.pret, v.pp]) {
      for (const part of raw.split(',')) set.add(part.trim().toUpperCase());
    }
  }
  return set;
}

/**
 * Близкие формы того же глагола.
 *
 * Приманки из чужих глаголов делают задание пустым: достаточно узнать слово,
 * а не вспомнить форму. Путается же ровно соседнее — began против begun.
 *
 * Подмена гласной даёт и настоящие слова (sing → song), и выдуманные
 * (take → taok). Выдуманное отсеивается с одного взгляда, и задание выходит
 * легче, чем кажется, поэтому берём только те, что есть в самой таблице.
 * Исключение одно — правильная форма на -ED: слова такого нет, но именно эту
 * ошибку и делают, а значит, спрашивать о ней осмысленно.
 */
export function nearMisses(
  verb: IrregularVerb,
  target: 'pret' | 'pp',
  vocabulary?: Set<string>,
): string[] {
  const correct = (target === 'pret' ? verb.pret : verb.pp).toUpperCase();
  const out: string[] = [];
  const add = (v: string) => {
    const t = v.toUpperCase().trim();
    if (t && t !== correct && !out.includes(t)) out.push(t);
  };

  // Соседние формы того же глагола — самая частая путаница.
  add(target === 'pret' ? verb.pp : verb.pret);
  add(verb.inf);

  // Ошибка новичка: неправильный глагол «выпрямили».
  add(verb.inf.replace(/E$/, '') + 'ED');

  // Подмена гласной — только если получилось настоящее слово из таблицы.
  const vocab = vocabulary ?? realForms(VERBS_FOR_VOCAB);
  const base = correct.replace(/,.*$/, '').trim();
  const idx = [...base].findIndex(c => VOWELS.includes(c));
  if (idx >= 0) {
    for (const v of VOWELS) {
      const candidate = base.slice(0, idx) + v + base.slice(idx + 1);
      if (vocab.has(candidate)) add(candidate);
    }
  }

  // У глагола с одинаковыми формами соседних просто нет, и выбор вырождается
  // в «PUT или PUTED» — верный виден без раздумий. Добираем настоящими
  // формами с тем же окончанием: они правдоподобны и заставляют вчитаться.
  if (out.length < 3 && base.length >= 3) {
    const tail = base.slice(-2);
    for (const form of vocab) {
      if (out.length >= 3) break;
      if (form.length >= 3 && form.endsWith(tail)) add(form);
    }
  }

  return out;
}

/**
 * Есть ли смысл предлагать выбор.
 *
 * Выбор из двух — подбрасывание монеты, а не проверка. Не набралось трёх
 * вариантов — спрашиваем вводом.
 */
export function canOfferChoice(
  verb: IrregularVerb,
  target: 'pret' | 'pp',
  vocabulary?: Set<string>,
): boolean {
  return nearMisses(verb, target, vocabulary).length >= 2;
}

/** Варианты для выбора: верный ответ и до трёх близких, вперемешку. */
export function choiceOptions(
  verb: IrregularVerb,
  target: 'pret' | 'pp',
  shuffle = true,
  vocabulary?: Set<string>,
): string[] {
  const correct = (target === 'pret' ? verb.pret : verb.pp).toUpperCase();
  const options = [correct, ...nearMisses(verb, target, vocabulary).slice(0, 3)];
  return shuffle ? [...options].sort(() => 0.5 - Math.random()) : options;
}
