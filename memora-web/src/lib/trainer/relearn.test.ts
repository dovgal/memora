// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/trainer/relearn.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduleRelearn, shouldRelearn, shouldShowMnemonic } from './relearn';
import type { SessionItem } from './types';

const item = (cardId: string, missCount = 0): SessionItem => ({ cardId, kind: 'recall', attempt: 1, missCount });

test('карточка возвращается через 3–5 пунктов после текущей позиции', () => {
  const queue = Array.from({ length: 20 }, (_, i) => item(`c${i}`));
  // rng фиксирован на 0 → берём минимальный зазор (3).
  const withGap3 = scheduleRelearn(queue, 5, item('wrong'), { rng: () => 0 });
  assert.equal(withGap3[5 + 1 + 3].cardId, 'wrong');

  // rng у самой границы 1 (но < 1) → берём максимальный зазор (5).
  const withGap5 = scheduleRelearn(queue, 5, item('wrong'), { rng: () => 0.999 });
  assert.equal(withGap5[5 + 1 + 5].cardId, 'wrong');
});

test('если до конца очереди меньше зазора, карточка уходит в конец', () => {
  const queue = Array.from({ length: 7 }, (_, i) => item(`c${i}`));
  const next = scheduleRelearn(queue, 5, item('wrong'), { rng: () => 0.999 }); // хотел бы +6, длина позволяет только +2
  assert.equal(next.length, queue.length + 1);
  assert.equal(next[next.length - 1].cardId, 'wrong');
});

test('вставленный пункт получает +1 к attempt и +1 к missCount', () => {
  const queue = Array.from({ length: 10 }, (_, i) => item(`c${i}`));
  const next = scheduleRelearn(queue, 2, item('wrong', 1), { rng: () => 0 });
  const reinserted = next.find(x => x.cardId === 'wrong')!;
  assert.equal(reinserted.attempt, 2);
  assert.equal(reinserted.missCount, 2);
});

test('исходная очередь не мутируется', () => {
  const queue = Array.from({ length: 10 }, (_, i) => item(`c${i}`));
  const before = queue.length;
  scheduleRelearn(queue, 2, item('wrong'), { rng: () => 0 });
  assert.equal(queue.length, before);
});

test('мнемоника показывается со второго промаха', () => {
  assert.equal(shouldShowMnemonic({ missCount: 0 }), false);
  assert.equal(shouldShowMnemonic({ missCount: 1 }), false);
  assert.equal(shouldShowMnemonic({ missCount: 2 }), true);
  assert.equal(shouldShowMnemonic({ missCount: 3 }), true);
});

test('после третьего промаха в занятии карточку больше не возвращаем', () => {
  assert.equal(shouldRelearn({ missCount: 0 }), true, 'первый промах — вернётся');
  assert.equal(shouldRelearn({ missCount: 1 }), true, 'второй — тоже');
  assert.equal(shouldRelearn({ missCount: 2 }), false, 'третий — хватит на сегодня');
});
