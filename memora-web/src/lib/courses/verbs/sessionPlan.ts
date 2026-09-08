// Сбор занятия из неправильных глаголов: чистая функция без побочных
// эффектов — весь ввод приходит параметрами, весь вывод возвращается.
//
// Порядок отбора закреплён в types.ts (SESSION) и в задаче тренажёра:
//  1. слабые — были ошибки и подошёл срок повторения;
//  2. новые из текущей партии — те, кого ещё не спрашивали вовсе;
//  3. остаток — подошедшие по сроку глаголы из прежних партий, включая
//     слабых, не поместившихся в свою квоту.
// Прочные (ступень ≥ SOLID_STEP), чей срок ещё не подошёл, не попадают
// никуда — им незачем мешаться под ногами у тех, кто ещё не выучен.

import { SESSION, SOLID_STEP, type IrregularVerb, type VerbState } from './types';

export interface SessionPlanInput {
  /** Полная таблица глаголов — источник истины по составу и номерам. */
  verbs: IrregularVerb[];
  /** Состояния повторения, какие успели накопиться. Не по всем есть запись. */
  states: VerbState[];
  /** Текущая партия учителя: «с 1 по 20». Нет партии — нет новых карточек. */
  assignment: { from: number; to: number } | null;
  /** Сегодняшняя дата в том же виде, что и VerbState.due — «2026-09-11». */
  today: string;
}

/** Срок подошёл, если дата повторения сегодня или раньше — сравнение строк
 * работает, потому что даты всегда в формате YYYY-MM-DD одной длины. */
function isDue(state: VerbState, today: string): boolean {
  return state.due <= today;
}

/** Глагол прочно выучен и повторять его рано. Единственный случай, когда
 * глагол не попадает в занятие вовсе, а не просто теряет приоритет. */
function isRestingSolid(state: VerbState, today: string): boolean {
  return state.step >= SOLID_STEP && !isDue(state, today);
}

export function buildSessionPlan(input: SessionPlanInput): IrregularVerb[] {
  const { verbs, states, assignment, today } = input;

  const verbByN = new Map(verbs.map(v => [v.n, v]));
  const stateByN = new Map(states.map(s => [s.n, s]));

  const picked = new Set<number>();
  const session: IrregularVerb[] = [];

  const take = (n: number) => {
    const verb = verbByN.get(n);
    if (!verb || picked.has(n)) return false;
    picked.add(n);
    session.push(verb);
    return true;
  };

  // ---------- 1. Слабые: были ошибки, срок подошёл ----------
  //
  // Сортируем по тому, насколько просрочен повтор (самые старые долги —
  // вперёд), а внутри одного дня — по числу ошибок: тому, кто ошибался чаще,
  // нужнее лишний прогон.
  const weak = states
    .filter(s => s.misses > 0 && isDue(s, today) && verbByN.has(s.n))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (b.misses - a.misses) || (a.n - b.n)));

  for (const s of weak) {
    if (session.length >= SESSION.weak) break;
    take(s.n);
  }

  // ---------- 2. Новые из текущей партии ----------
  //
  // Только те, кого ещё не спрашивали вовсе (нет записи состояния): партия
  // «с 1 по 20» вводится за несколько занятий, не за одно.
  if (assignment) {
    const fresh = verbs
      .filter(v => v.n >= assignment.from && v.n <= assignment.to && !stateByN.has(v.n))
      .sort((a, b) => a.n - b.n);

    let freshTaken = 0;
    for (const v of fresh) {
      if (freshTaken >= SESSION.fresh || session.length >= SESSION.total) break;
      if (take(v.n)) freshTaken++;
    }
  }

  // ---------- 3. Остаток: подошедшие по сроку из прежних партий ----------
  //
  // Сюда же попадают слабые, не поместившиеся в свою квоту (12) — они всё
  // равно подошли по сроку и заслуживают места, если оно осталось. Условие
  // isDue само по себе исключает «отдыхающих» прочных: isRestingSolid верна
  // только когда срок ещё НЕ подошёл, а значит с isDue не пересекается —
  // явная проверка ниже оставлена как документация этого инварианта.
  const rest = states
    .filter(s => !picked.has(s.n) && isDue(s, today) && !isRestingSolid(s, today) && verbByN.has(s.n))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : (a.step - b.step) || (a.n - b.n)));

  for (const s of rest) {
    if (session.length >= SESSION.total) break;
    take(s.n);
  }

  return session.slice(0, SESSION.total);
}
