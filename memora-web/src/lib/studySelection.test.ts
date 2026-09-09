// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/studySelection.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRange, selectCards } from './studySelection';

test('«1-20» читается как первые двадцать', () => {
  assert.deepEqual(parseRange('1-20'), { from: 1, to: 20 });
  assert.deepEqual(parseRange(' 21 - 40 '), { from: 21, to: 40 });
});

test('мусор и вывернутые границы отбора не задают', () => {
  for (const raw of [null, '', 'всё', '0-5', '20-1', '5', '-3', 'a-b']) {
    assert.equal(parseRange(raw), null, `«${raw}» не должно давать отбора`);
  }
});

test('отбираются те самые места, считая с единицы', () => {
  const cards = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(selectCards(cards, { from: 1, to: 3 }), ['a', 'b', 'c']);
  assert.deepEqual(selectCards(cards, { from: 4, to: 5 }), ['d', 'e']);
  // Хвост за пределами набора — не беда, берём сколько есть.
  assert.deepEqual(selectCards(cards, { from: 4, to: 99 }), ['d', 'e']);
});

test('без отбора набор остаётся целым', () => {
  const cards = ['a', 'b', 'c'];
  assert.equal(selectCards(cards, null), cards);
});
