// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/trainer/queue.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionQueue, repickUpcoming } from './queue';
import type { ExerciseKind, PlannedCard } from './types';

const planned = (cardId: string, stage: PlannedCard['stage'], extra: Partial<PlannedCard> = {}): PlannedCard => ({
  cardId, stage, leech: false, isNew: stage === 'new', reason: stage === 'new' ? 'new' : 'due', seed: 0, ...extra,
});

const all: ReadonlySet<ExerciseKind> = new Set(['recognize', 'recall', 'listen', 'speak']);

test('новая карточка: узнавание сейчас, вспоминание — через несколько пунктов', () => {
  const cards = [planned('n1', 'new'), planned('d1', 'learning'), planned('d2', 'learning'), planned('d3', 'learning'), planned('d4', 'learning')];
  const q = buildSessionQueue(cards, () => all, { followUpGap: 3 });
  assert.equal(q.length, 6);
  assert.deepEqual(q[0], { cardId: 'n1', kind: 'recognize', attempt: 1, missCount: 0 });
  const followIdx = q.findIndex(i => i.cardId === 'n1' && i.followUp);
  assert.equal(q[followIdx].kind, 'recall');
  assert.equal(followIdx, 4, 'после трёх других заданий');
});

test('вторые шаги, не успевшие дождаться своей очереди, идут в конец', () => {
  const q = buildSessionQueue([planned('a', 'new'), planned('b', 'new')], () => all, { followUpGap: 3 });
  assert.deepEqual(q.map(i => `${i.cardId}:${i.kind}`), ['a:recognize', 'b:recognize', 'a:recall', 'b:recall']);
});

test('без вариантов для узнавания новая карточка — один пункт recall', () => {
  const q = buildSessionQueue([planned('a', 'new')], () => new Set(['recall']));
  assert.deepEqual(q.map(i => i.kind), ['recall']);
});

test('repickUpcoming переигрывает вид только у ещё не показанных первых шагов не новых карточек', () => {
  const cards = [planned('d1', 'learning'), planned('d2', 'learning'), planned('n1', 'new')];
  const map = new Map(cards.map(c => [c.cardId, c]));
  const q = buildSessionQueue(cards, () => new Set(['recall', 'recognize']));
  assert.deepEqual(q.map(i => i.kind), ['recall', 'recall', 'recognize', 'recall']);

  // Сервер дослал gender — теперь для learning доступен только он из лесенки,
  // кроме recall; seed 0 выбирает первый из доступных в порядке лесенки.
  const onlyGender = () => new Set<ExerciseKind>(['gender']);
  const next = repickUpcoming(q, 1, map, onlyGender);
  assert.equal(next[0].kind, 'recall', 'показанный пункт не трогаем');
  assert.equal(next[1].kind, 'gender');
  assert.equal(next[2].kind, 'recognize', 'новая карточка остаётся как была');
  assert.equal(next[3].kind, 'recall', 'второй шаг новой карточки не трогаем');
});

test('repickUpcoming возвращает ту же очередь, если ничего не поменялось', () => {
  const cards = [planned('d1', 'learning')];
  const map = new Map(cards.map(c => [c.cardId, c]));
  const q = buildSessionQueue(cards, () => all);
  assert.equal(repickUpcoming(q, 0, map, () => all), q);
});
