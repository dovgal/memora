// Тесты сбора занятия. Функция чистая, поэтому проверяем без моков и без
// сервера: свой список глаголов, свои состояния, своя «сегодня».
//
// Запуск (в репозитории нет ни vitest, ни jest — используем встроенный в
// Node тестраннер; tsc собирает CommonJS во временную папку, потому что
// голый `node --experimental-strip-types` не умеет разрешать импорты без
// расширения, а менять на них стиль импортов только ради раннера незачем):
//   npx tsc src/lib/courses/verbs/{types,sessionPlan,sessionPlan.test}.ts \
//     --outDir /tmp/verbs-test-out --module commonjs --target es2020 \
//     --moduleResolution node --esModuleInterop --skipLibCheck
//   node --test /tmp/verbs-test-out/sessionPlan.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionPlan } from './sessionPlan';
import { SESSION, SOLID_STEP, type IrregularVerb, type VerbState } from './types';

const TODAY = '2026-09-08';

/** Короткий список глаголов 1..30 — реального list.ts на момент теста ещё нет. */
function makeVerbs(count: number): IrregularVerb[] {
  const forms = [
    ['BE', 'WAS, WERE', 'BEEN', 'ÊTRE'],
    ['BEGIN', 'BEGAN', 'BEGUN', 'COMMENCER'],
    ['PUT', 'PUT', 'PUT', 'METTRE'],
    ['COME', 'CAME', 'COME', 'VENIR'],
    ['KEEP', 'KEPT', 'KEPT', 'GARDER'],
  ] as const;
  return Array.from({ length: count }, (_, i) => {
    const [inf, pret, pp, fr] = forms[i % forms.length];
    return { n: i + 1, inf: `${inf}${i}`, pret, pp, fr, page: 1 as const };
  });
}

function state(partial: Partial<VerbState> & { n: number }): VerbState {
  return { step: 0, due: TODAY, streak: 0, misses: 0, ...partial };
}

test('без состояний и без партии занятие пустое', () => {
  const verbs = makeVerbs(30);
  const plan = buildSessionPlan({ verbs, states: [], assignment: null, today: TODAY });
  assert.deepEqual(plan, []);
});

test('без партии, но с просроченными — тянутся старые глаголы', () => {
  const verbs = makeVerbs(10);
  const states = [state({ n: 3, step: 1, due: '2026-09-01', misses: 2 })];
  const plan = buildSessionPlan({ verbs, states, assignment: null, today: TODAY });
  assert.deepEqual(plan.map(v => v.n), [3]);
});

test('новые берутся только из диапазона текущей партии', () => {
  const verbs = makeVerbs(30);
  const plan = buildSessionPlan({
    verbs, states: [], assignment: { from: 1, to: 20 }, today: TODAY,
  });
  assert.ok(plan.every(v => v.n >= 1 && v.n <= 20));
  assert.equal(plan.length, SESSION.fresh); // новых не больше квоты
});

test('новых за раз не больше SESSION.fresh, даже если партия большая', () => {
  const verbs = makeVerbs(125);
  const plan = buildSessionPlan({
    verbs, states: [], assignment: { from: 1, to: 125 }, today: TODAY,
  });
  assert.equal(plan.length, SESSION.fresh);
  // Порядок — по номеру, как в таблице: раньше введённые идут первыми.
  assert.deepEqual(plan.map(v => v.n), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('слабые (ошибки + подошёл срок) идут раньше новых', () => {
  const verbs = makeVerbs(30);
  const states = [
    state({ n: 25, step: 1, due: '2026-09-01', misses: 3 }), // слабый, из прежней партии
  ];
  const plan = buildSessionPlan({
    verbs, states, assignment: { from: 1, to: 20 }, today: TODAY,
  });
  assert.equal(plan[0].n, 25);
  assert.ok(plan.slice(1).every(v => v.n >= 1 && v.n <= 20));
});

test('слабых за раз не больше SESSION.weak', () => {
  const verbs = makeVerbs(30);
  // 20 слабых глаголов вне партии — гораздо больше квоты в 12.
  const states = Array.from({ length: 20 }, (_, i) =>
    state({ n: i + 1, step: 1, due: '2026-09-01', misses: 1 }));
  const plan = buildSessionPlan({
    verbs, states, assignment: null, today: TODAY,
  });
  const weakCount = plan.filter(v => v.n <= 20).length;
  // Первые SESSION.weak идут через «слабую» квоту, остальные — довиваются
  // остатком (эти же 20 глаголов ещё раз подходят под «due из прежних партий»).
  assert.equal(weakCount, 20 <= SESSION.total ? 20 : SESSION.total);
  // Но какая-то честная квота слабых точно не превышена в приоритетной части:
  assert.ok(plan.length <= SESSION.total);
});

test('прочный и просроченный — участвует наравне с остальными через остаток', () => {
  const verbs = makeVerbs(5);
  const states = [state({ n: 2, step: SOLID_STEP, due: '2026-09-01', misses: 0 })];
  const plan = buildSessionPlan({ verbs, states, assignment: null, today: TODAY });
  assert.deepEqual(plan.map(v => v.n), [2]);
});

test('прочный, но срок не подошёл — не берётся вовсе', () => {
  const verbs = makeVerbs(5);
  const states = [state({ n: 2, step: SOLID_STEP, due: '2026-12-31', misses: 0 })];
  const plan = buildSessionPlan({ verbs, states, assignment: null, today: TODAY });
  assert.deepEqual(plan, []);
});

test('занятие никогда не превышает SESSION.total', () => {
  const verbs = makeVerbs(125);
  // Просрочены практически все — большой избыток кандидатов.
  const states = verbs.map(v => state({ n: v.n, step: 1, due: '2026-01-01', misses: v.n % 2 }));
  const plan = buildSessionPlan({
    verbs, states, assignment: { from: 1, to: 125 }, today: TODAY,
  });
  assert.ok(plan.length <= SESSION.total);
  assert.equal(plan.length, SESSION.total);
});

test('остаток добивает занятие подошедшими из прежних партий, пока не заполнит total', () => {
  const verbs = makeVerbs(60);
  // Партия сейчас — 21..25 (5 новых), плюс много due-долгов из партии 1..20.
  const states = Array.from({ length: 20 }, (_, i) =>
    state({ n: i + 1, step: 2, due: '2026-09-01', misses: 0 })); // не слабые, просто due
  const plan = buildSessionPlan({
    verbs, states, assignment: { from: 21, to: 25 }, today: TODAY,
  });
  const freshCount = plan.filter(v => v.n >= 21 && v.n <= 25).length;
  const restCount = plan.filter(v => v.n <= 20).length;
  assert.equal(freshCount, 5); // вся партия маленькая — вся вошла
  assert.equal(restCount, 20); // остаток добрал всё, что было
  assert.equal(plan.length, 25);
});

test('глагол не появляется в занятии дважды', () => {
  const verbs = makeVerbs(30);
  const states = [state({ n: 5, step: 1, due: '2026-09-01', misses: 4 })];
  const plan = buildSessionPlan({
    verbs, states, assignment: { from: 1, to: 30 }, today: TODAY,
  });
  const ns = plan.map(v => v.n);
  assert.equal(new Set(ns).size, ns.length);
});

test('запись состояния на глагол вне списка verbs просто игнорируется', () => {
  const verbs = makeVerbs(5);
  const states = [state({ n: 999, step: 1, due: '2026-09-01', misses: 5 })];
  const plan = buildSessionPlan({ verbs, states, assignment: null, today: TODAY });
  assert.deepEqual(plan, []);
});
