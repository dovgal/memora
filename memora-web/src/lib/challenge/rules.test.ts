// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/challenge/rules.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canFinish, remainingHint, formatClock, timerProgress, localDayKey,
  shouldNudgeEvening, praiseFor, pluralRu, MIN_TURNS, MIN_MINUTES,
} from './rules';

const MIN = 60_000;

test('завершать можно после 4 реплик или 3 минут — как на сервере', () => {
  assert.equal(MIN_TURNS, 4);
  assert.equal(MIN_MINUTES, 3);
  assert.equal(canFinish(3, 2.9 * MIN), false);
  assert.equal(canFinish(4, 0), true);
  assert.equal(canFinish(0, 3 * MIN), true);
  assert.equal(canFinish(1, 3 * MIN - 1), false);
});

test('порог можно переопределить значениями с сервера', () => {
  assert.equal(canFinish(2, 0, { minTurns: 2, minMinutes: 10 }), true);
  assert.equal(canFinish(1, 5 * MIN, { minTurns: 2, minMinutes: 10 }), false);
});

test('подсказка показывает ближайшую дорогу и исчезает на пороге', () => {
  assert.equal(remainingHint(3, 0), 'Ещё 1 реплика — и можно завершать');
  assert.equal(remainingHint(0, 0), 'Ещё 4 реплики или 3 минуты разговора');
  assert.equal(remainingHint(0, 2.5 * MIN), 'Ещё 4 реплики или 1 минута разговора');
  assert.equal(remainingHint(4, 0), '');
  assert.equal(remainingHint(0, 3 * MIN), '');
});

test('склонение по-русски', () => {
  assert.equal(pluralRu(1, 'день', 'дня', 'дней'), 'день');
  assert.equal(pluralRu(3, 'день', 'дня', 'дней'), 'дня');
  assert.equal(pluralRu(11, 'день', 'дня', 'дней'), 'дней');
  assert.equal(pluralRu(21, 'день', 'дня', 'дней'), 'день');
  assert.equal(pluralRu(14, 'день', 'дня', 'дней'), 'дней');
});

test('часы таймера', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65_000), '1:05');
  assert.equal(formatClock(5 * MIN), '5:00');
  assert.equal(formatClock(-5), '0:00');
  assert.equal(formatClock(Number.NaN), '0:00');
});

test('полоска таймера упирается в 1 после пяти минут', () => {
  assert.equal(timerProgress(0), 0);
  assert.equal(timerProgress(2.5 * MIN), 0.5);
  assert.equal(timerProgress(9 * MIN), 1);
  assert.equal(timerProgress(-1), 0);
});

test('ключ дня — по местным часам, с нулями', () => {
  assert.equal(localDayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(localDayKey(new Date(2026, 8, 24, 0, 1)), '2026-09-24');
});

test('вечернее напоминание: после 18:00, если не сделано, раз в день', () => {
  const evening = new Date(2026, 8, 24, 18, 30);
  const afternoon = new Date(2026, 8, 24, 17, 59);
  assert.equal(shouldNudgeEvening(evening, false, null), true);
  assert.equal(shouldNudgeEvening(afternoon, false, null), false, 'до шести не напоминаем');
  assert.equal(shouldNudgeEvening(evening, true, null), false, 'разговор уже был');
  assert.equal(shouldNudgeEvening(evening, false, '2026-09-24'), false, 'сегодня уже напоминали');
  assert.equal(shouldNudgeEvening(evening, false, '2026-09-23'), true, 'вчерашнее напоминание не считается');
});

test('похвала зависит от итога, но ругани нет', () => {
  assert.match(praiseFor(4, 3, true), /Все задачи/);
  assert.match(praiseFor(9, 2, false), /Настоящий/);
  assert.match(praiseFor(4, 1, false), /главное/);
});
