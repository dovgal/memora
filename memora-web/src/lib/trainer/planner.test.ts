// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/trainer/planner.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { interleave, isDueForReview, isNewCard, mostOverdueFirst, newCardsLeft, planSession } from './planner';
import type { CardSchedule } from './types';

const NOW = new Date('2026-09-23T12:00:00Z');

const iso = (daysFromNow: number): string => new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString();

const due = (id: string, daysOverdue: number, extra: Partial<CardSchedule> = {}): CardSchedule => ({
  cardId: id, state: 2, due: iso(-daysOverdue), stability: 10, lapses: 0, reps: 3, ...extra,
});

const fresh = (id: string): CardSchedule => ({ cardId: id, state: 0, due: null, stability: 0, lapses: 0, reps: 0 });

test('новая карточка распознаётся по state 0 или отсутствию повторов', () => {
  assert.equal(isNewCard({ state: 0, reps: 0 }), true);
  assert.equal(isNewCard({ state: 2, reps: 0 }), true);
  assert.equal(isNewCard({ state: 2, reps: 3 }), false);
});

test('due — не новая карточка, чей срок уже наступил (или не задан)', () => {
  assert.equal(isDueForReview(due('a', 1), NOW), true);
  assert.equal(isDueForReview({ cardId: 'b', state: 2, due: iso(5), stability: 10, lapses: 0, reps: 3 }, NOW), false);
  assert.equal(isDueForReview(fresh('c'), NOW), false, 'новая карточка — не due');
  assert.equal(isDueForReview({ cardId: 'd', state: 2, due: null, stability: 10, lapses: 0, reps: 3 }, NOW), true, 'без даты — считаем подошедшей');
});

test('просроченные карточки идут от самой просроченной', () => {
  const schedules = [due('barely', 1), due('very', 10), due('somewhat', 3)];
  const sorted = mostOverdueFirst(schedules, NOW);
  assert.deepEqual(sorted.map(s => s.cardId), ['very', 'somewhat', 'barely']);
});

test('interleave равномерно рассыпает второй список по первому, не теряя элементов', () => {
  const primary = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
  const secondary = ['n1', 'n2'];
  const merged = interleave(primary, secondary);
  assert.equal(merged.length, 8);
  assert.deepEqual(merged.filter(x => x.startsWith('d')), primary, 'порядок due не меняется');
  assert.deepEqual(merged.filter(x => x.startsWith('n')), secondary, 'порядок new не меняется');
  // n1 и n2 не должны оказаться рядом в конце единым блоком — они должны быть рассыпаны.
  assert.notEqual(merged.indexOf('n1'), merged.length - 2);
});

test('interleave с пустым вторым списком возвращает первый без изменений', () => {
  assert.deepEqual(interleave(['a', 'b'], []), ['a', 'b']);
});

test('interleave с пустым первым списком возвращает второй без изменений', () => {
  assert.deepEqual(interleave([], ['a', 'b']), ['a', 'b']);
});

test('planSession: due идут первыми по просроченности, потом до 8 новых', () => {
  const schedules = [
    due('barely', 1), due('very', 20),
    ...Array.from({ length: 10 }, (_, i) => fresh(`new${i}`)),
  ];
  const plan = planSession(schedules, { now: NOW });
  const dueIds = plan.filter(p => !p.isNew).map(p => p.cardId);
  const newIds = plan.filter(p => p.isNew).map(p => p.cardId);
  assert.deepEqual(dueIds, ['very', 'barely'], 'due — сначала самая просроченная');
  assert.equal(newIds.length, 8, 'новых не больше восьми по умолчанию');
});

test('planSession: занятие не превышает заданный предел пунктов', () => {
  const schedules = [
    ...Array.from({ length: 25 }, (_, i) => due(`d${i}`, i + 1)),
    ...Array.from({ length: 10 }, (_, i) => fresh(`n${i}`)),
  ];
  const plan = planSession(schedules, { now: NOW, maxItems: 18, maxNewCards: 8 });
  assert.equal(plan.length, 18);
  // due просрочены и их больше лимита — новые в это занятие не попадают вовсе.
  assert.equal(plan.every(p => !p.isNew), true);
});

test('planSession: при малом числе due остаётся место для новых, и они попадают в план', () => {
  const schedules = [due('d0', 1), due('d1', 2), ...Array.from({ length: 5 }, (_, i) => fresh(`n${i}`))];
  const plan = planSession(schedules, { now: NOW, maxItems: 18, maxNewCards: 8 });
  assert.equal(plan.length, 7);
  assert.equal(plan.filter(p => p.isNew).length, 5);
});

test('planSession: новая карточка стоит двух пунктов — узнать и вспомнить', () => {
  // 10 due + новые: остаётся 8 пунктов → 4 новые карточки (по два пункта).
  const schedules = [
    ...Array.from({ length: 10 }, (_, i) => due(`d${i}`, i + 1)),
    ...Array.from({ length: 10 }, (_, i) => fresh(`n${i}`)),
  ];
  const plan = planSession(schedules, { now: NOW, maxItems: 18, maxNewCards: 8 });
  assert.equal(plan.filter(p => p.isNew).length, 4);
  assert.equal(newCardsLeft(schedules, plan), 6);
});

test('planSession: новые рассыпаны по повторам, а не приклеены в конец', () => {
  const schedules = [
    ...Array.from({ length: 6 }, (_, i) => due(`d${i}`, i + 1)),
    ...Array.from({ length: 3 }, (_, i) => fresh(`n${i}`)),
  ];
  const plan = planSession(schedules, { now: NOW });
  const lastThree = plan.slice(-3).map(p => p.isNew);
  assert.notDeepEqual(lastThree, [true, true, true]);
  assert.equal(plan.every(p => p.reason === (p.isNew ? 'new' : 'due')), true);
});

test('planSession: если повторять и учить нечего — закрепление самых хрупких сверх плана', () => {
  const notYet = (id: string, inDays: number, stability: number): CardSchedule =>
    ({ cardId: id, state: 2, due: iso(inDays), stability, lapses: 0, reps: 4 });
  const schedules = [notYet('later', 10, 30), notYet('soon', 1, 5), notYet('soonFragile', 1, 2)];
  const plan = planSession(schedules, { now: NOW });
  assert.deepEqual(plan.map(p => p.cardId), ['soonFragile', 'soon', 'later']);
  assert.equal(plan.every(p => p.reason === 'practice'), true);
});

test('planSession отмечает ступень лесенки и леч для каждой карточки', () => {
  const leechCard = due('leechy', 1, { lapses: 10, stability: 30 });
  const plan = planSession([leechCard], { now: NOW });
  assert.equal(plan[0].leech, true);
  assert.equal(plan[0].stage, 'mature');
});
