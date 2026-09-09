// Проверки подбора вариантов ответа.
//
// Запуск:
//   npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/studyUtils.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDistractors, createMultipleChoiceQuestion } from './studyUtils';

// Форма карточки описана здесь, а не ввозится: путь с псевдонимом «@/» не
// задать в командной строке, а тесту от карточки нужны четыре поля.
type Card = { id: string; term: string; definition: string; orderIndex: number; fieldsData: Record<string, string | boolean | null | undefined> };

const card = (id: string, term: string, definition: string): Card =>
  ({ id, term, definition, orderIndex: 0, fieldsData: {} });

// Настоящий случай из таблицы неправильных глаголов: перевод FRAPPER стоит
// сразу у двух глаголов.
const HIT = card('1', 'HIT', 'FRAPPER');
const STRIKE = card('2', 'STRIKE', 'FRAPPER');
const KEEP = card('3', 'KEEP', 'GARDER');
const PAY = card('4', 'PAY', 'PAYER');

test('приманка, совпавшая с верным ответом, не предлагается', () => {
  const got = generateDistractors(HIT, [HIT, STRIKE, KEEP, PAY], 3, 'definition');
  assert.ok(!got.includes('FRAPPER'), 'вариант «FRAPPER» дублировал бы верный ответ');
  assert.equal(new Set(got).size, got.length, 'повторов быть не должно');
});

test('одинаковые приманки между собой схлопываются', () => {
  const twin = card('5', 'STRIKE2', 'FRAPPER');
  const got = generateDistractors(KEEP, [KEEP, HIT, STRIKE, twin], 3, 'definition');
  assert.equal(got.filter(x => x === 'FRAPPER').length, 1, 'FRAPPER должен остаться один');
});

test('приманок выходит меньше, чем просили, но без повторов', () => {
  // Разных ответов в наборе просто нет — добирать повторами хуже.
  const got = generateDistractors(HIT, [HIT, STRIKE], 3, 'definition');
  assert.deepEqual(got, []);
});

test('пустые ответы в варианты не попадают', () => {
  const empty = card('6', 'X', '');
  const got = generateDistractors(KEEP, [KEEP, empty, PAY], 3, 'definition');
  assert.deepEqual(got, ['PAYER']);
});

test('верный ответ находится по своему месту, а не по совпадению текста', () => {
  const q = createMultipleChoiceQuestion(HIT, [HIT, STRIKE, KEEP, PAY], 'definition');
  assert.equal(q.options[q.correctIndex], 'FRAPPER');
  assert.equal(new Set(q.options).size, q.options.length, 'варианты обязаны быть разными');
});
