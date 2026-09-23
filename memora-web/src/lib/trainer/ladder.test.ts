// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/trainer/ladder.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseExerciseKind, followUpKind, isLeech, kindSeed, ladderStageFor, LEECH_LAPSES, MATURE_STABILITY_DAYS } from './ladder';

test('новая карточка (state 0) стоит на ступени new', () => {
  assert.equal(ladderStageFor({ state: 0, stability: 0, reps: 0 }), 'new');
});

test('карточка без повторов — new, даже если state почему-то не 0', () => {
  assert.equal(ladderStageFor({ state: 1, stability: 0, reps: 0 }), 'new');
});

test('Review со стабильностью ниже порога — всё ещё learning', () => {
  assert.equal(ladderStageFor({ state: 2, stability: MATURE_STABILITY_DAYS - 1, reps: 3 }), 'learning');
});

test('Review со стабильностью не ниже порога — mature', () => {
  assert.equal(ladderStageFor({ state: 2, stability: MATURE_STABILITY_DAYS, reps: 5 }), 'mature');
});

test('Relearning (state 3) — learning, а не mature, даже при высокой стабильности', () => {
  assert.equal(ladderStageFor({ state: 3, stability: 40, reps: 5 }), 'learning');
});

test('леч определяется числом провалов', () => {
  assert.equal(isLeech({ lapses: LEECH_LAPSES }), true);
  assert.equal(isLeech({ lapses: LEECH_LAPSES - 1 }), false);
});

test('новая карточка начинает с узнавания, а вспоминание — вторым шагом', () => {
  const available = new Set(['recognize', 'recall', 'listen'] as const);
  assert.equal(chooseExerciseKind('new', false, available), 'recognize');
  assert.equal(followUpKind('new', false, 'recognize', available), 'recall');
});

test('если вариантов для узнавания собрать не из чего, новая карточка сразу вспоминается, без второго шага', () => {
  const available = new Set(['recall'] as const);
  assert.equal(chooseExerciseKind('new', false, available), 'recall');
  assert.equal(followUpKind('new', false, 'recall', available), null);
});

test('у не новых карточек второго шага нет', () => {
  const available = new Set(['recognize', 'recall'] as const);
  assert.equal(followUpKind('learning', false, 'recognize', available), null);
  assert.equal(followUpKind('new', true, 'recognize', available), null, 'леч тоже без второго шага');
});

test('learning: вид упражнения меняется с seed, а не всегда первый доступный', () => {
  const available = new Set(['recall', 'listen', 'cloze', 'gender', 'recognize'] as const);
  const kinds = new Set([0, 1, 2, 3].map(seed => chooseExerciseKind('learning', false, available, seed)));
  assert.deepEqual([...kinds].sort(), ['cloze', 'gender', 'listen', 'recall']);
  assert.equal(kinds.has('recognize'), false, 'узнавание для learning — только запасной вариант');
});

test('learning: берутся только доступные виды ступени', () => {
  const available = new Set(['gender'] as const);
  for (const seed of [0, 1, 2, 3, 17]) assert.equal(chooseExerciseKind('learning', false, available, seed), 'gender');
});

test('mature: речь, спряжение и фраза — по seed среди доступных', () => {
  const available = new Set(['speak', 'build', 'recall'] as const);
  const kinds = new Set([0, 1, 2, 3].map(seed => chooseExerciseKind('mature', false, available, seed)));
  assert.deepEqual([...kinds].sort(), ['build', 'speak']);
});

test('леч всегда получает упрощённую лесенку — recognize/recall, даже на ступени mature', () => {
  const available = new Set(['speak', 'recognize', 'recall'] as const);
  assert.equal(chooseExerciseKind('mature', true, available, 3), 'recognize');
});

test('если из лесенки ничего не доступно — безопасный отступ на recall/recognize', () => {
  assert.equal(chooseExerciseKind('mature', false, new Set(['recall', 'recognize'] as const)), 'recall');
  assert.equal(chooseExerciseKind('mature', false, new Set(['recognize'] as const)), 'recognize');
  assert.equal(chooseExerciseKind('learning', false, new Set(['speak'] as const)), 'recall', 'пустой набор — всё равно recall');
});

test('kindSeed стабилен для карточки и меняется с числом повторов', () => {
  assert.equal(kindSeed('abc', 3), kindSeed('abc', 3));
  assert.notEqual(kindSeed('abc', 3), kindSeed('abc', 4));
  assert.ok(kindSeed('abc', 3) >= 0);
});
