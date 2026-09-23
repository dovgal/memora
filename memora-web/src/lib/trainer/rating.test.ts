// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/trainer/rating.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { AGAIN, HARD, GOOD, EASY, classifyResponseTime, mapOutcomeToRating } from './rating';

test('неверный ответ — всегда Again, независимо от скорости и подсказок', () => {
  assert.equal(mapOutcomeToRating({ correct: false, usedHint: false, fast: true, slow: false }), AGAIN);
  assert.equal(mapOutcomeToRating({ correct: false, usedHint: true, fast: false, slow: true }), AGAIN);
});

test('верный ответ с подсказкой — Hard: подсказка стоит рейтинга', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: true, fast: false, slow: false }), HARD);
});

test('верный, но медленный ответ без подсказки — тоже Hard', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: false, fast: false, slow: true }), HARD);
});

test('просто верный ответ, без подсказки, не быстрый и не медленный — Good', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: false, fast: false, slow: false }), GOOD);
});

test('быстрый уверенный верный ответ без подсказки — Easy', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: false, fast: true, slow: false }), EASY);
});

test('подсказка перевешивает быстроту: Hard, а не Easy', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: true, fast: true, slow: false }), HARD);
});

test('классификация времени ответа по порогам', () => {
  assert.deepEqual(classifyResponseTime({ responseMs: 500, fastMs: 1000, slowMs: 8000 }), { fast: true, slow: false });
  assert.deepEqual(classifyResponseTime({ responseMs: 9000, fastMs: 1000, slowMs: 8000 }), { fast: false, slow: true });
  assert.deepEqual(classifyResponseTime({ responseMs: 3000, fastMs: 1000, slowMs: 8000 }), { fast: false, slow: false });
});

test('узнавание среди вариантов не тянет на Easy даже быстро', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: false, fast: true, slow: false, recognitionOnly: true }), GOOD);
});

test('повтор после промаха в том же занятии — не Easy, даже быстро', () => {
  assert.equal(mapOutcomeToRating({ correct: true, usedHint: false, fast: true, slow: false, retry: true }), GOOD);
  assert.equal(mapOutcomeToRating({ correct: false, usedHint: false, fast: true, slow: false, retry: true }), AGAIN);
});
