import { test } from 'node:test';
import assert from 'node:assert/strict';
import { react, greeting, sessionSummary, pick } from './brain';

const first = () => 0;

test('верный ответ — прыжок и похвала, серия отмечается только на круглых числах', () => {
  const plain = react({ type: 'correct', combo: 3 }, first)!;
  assert.equal(plain.jump, 'jump');
  assert.equal(plain.mood, 'happy');
  assert.ok(!plain.confetti);

  const five = react({ type: 'correct', combo: 5 }, first)!;
  assert.equal(five.jump, 'spin');
  assert.equal(five.say, 'Серия ×5!');
  assert.equal(react({ type: 'correct', combo: 7 }, first)!.jump, 'jump');
});

test('ошибка огорчает, но без салюта и без прыжков', () => {
  const r = react({ type: 'wrong' }, first)!;
  assert.equal(r.mood, 'sad');
  assert.equal(r.jump, undefined);
  assert.ok(!r.confetti);
});

test('снятие отсчёта и конец записи позы не меняют', () => {
  assert.equal(react({ type: 'answered' }), null);
  assert.equal(react({ type: 'listen_end' }), null);
  assert.equal(react({ type: 'question' }), null);
});

test('приветствие зависит от времени суток', () => {
  assert.match(greeting(8), /утро/);
  assert.match(greeting(14), /день/);
  assert.match(greeting(20), /вечер/);
  assert.match(greeting(2), /Не спится/);
});

test('итог занятия хвалит и за скромный результат', () => {
  assert.match(sessionSummary(10, 10), /Блестяще/);
  assert.match(sessionSummary(7, 10), /Хорошая/);
  assert.match(sessionSummary(2, 10), /позанимались/);
  assert.equal(sessionSummary(0, 0), 'Занятие окончено');
});

test('pick не выходит за границы списка даже при rnd = 1', () => {
  assert.equal(pick(['a', 'b'], () => 1), 'b');
});
