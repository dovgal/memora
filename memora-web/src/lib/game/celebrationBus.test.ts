// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/game/celebrationBus.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { celebrationsFromUpdate, onCelebration, onGameUpdate, emitCelebration, celebrate } from './celebrationBus';
import type { GameUpdate } from './client';

function baseUpdate(overrides: Partial<GameUpdate> = {}): GameUpdate {
  return {
    xp: 100,
    xpGained: 10,
    level: 2,
    leveledUp: false,
    streakDays: 1,
    dailyGoal: 50,
    dailyProgress: 10,
    newAchievements: [],
    ...overrides,
  };
}

test('без level-up и достижений событий нет', () => {
  assert.deepEqual(celebrationsFromUpdate(baseUpdate()), []);
});

test('level-up даёт событие levelUp с новым уровнем', () => {
  const events = celebrationsFromUpdate(baseUpdate({ leveledUp: true, level: 5 }));
  assert.deepEqual(events, [{ kind: 'levelUp', level: 5 }]);
});

test('каждое новое достижение — отдельное событие', () => {
  const a1 = { id: 'a', title: 'A', description: 'd', emoji: '🎉' };
  const a2 = { id: 'b', title: 'B', description: 'd', emoji: '🔥' };
  const events = celebrationsFromUpdate(baseUpdate({ newAchievements: [a1, a2] }));
  assert.deepEqual(events, [
    { kind: 'achievement', achievement: a1 },
    { kind: 'achievement', achievement: a2 },
  ]);
});

test('дневная цель празднуется только при пересечении порога этим событием', () => {
  // Было 45 из 50, +15 → 60: пересекли именно сейчас.
  const crossed = celebrationsFromUpdate(baseUpdate({ dailyGoal: 50, dailyProgress: 60, xpGained: 15 }));
  assert.deepEqual(crossed, [{ kind: 'dailyGoal' }]);

  // Было 55 (цель давно выполнена), +5 → 60: повторно не празднуем.
  const already = celebrationsFromUpdate(baseUpdate({ dailyGoal: 50, dailyProgress: 60, xpGained: 5 }));
  assert.deepEqual(already, []);

  // Ровно на пороге: 40 + 10 = 50 — считается выполненной.
  const exact = celebrationsFromUpdate(baseUpdate({ dailyGoal: 50, dailyProgress: 50, xpGained: 10 }));
  assert.deepEqual(exact, [{ kind: 'dailyGoal' }]);
});

test('событие без XP (лимит, неверный ответ) цель не празднует', () => {
  const events = celebrationsFromUpdate(baseUpdate({ dailyGoal: 50, dailyProgress: 70, xpGained: 0 }));
  assert.deepEqual(events, []);
});

test('все три события могут прийти одновременно, в порядке уровень → достижения → цель', () => {
  const a = { id: 'a', title: 'A', description: 'd', emoji: '🎉' };
  const events = celebrationsFromUpdate(
    baseUpdate({ leveledUp: true, level: 3, newAchievements: [a], dailyGoal: 50, dailyProgress: 55, xpGained: 20 }),
  );
  assert.deepEqual(events.map(e => e.kind), ['levelUp', 'achievement', 'dailyGoal']);
});

test('celebrate() рассылает подписчикам и не повторяет цель на следующих событиях', () => {
  const seen: string[] = [];
  const unsubscribe = onCelebration(e => seen.push(e.kind));

  celebrate(baseUpdate({ dailyGoal: 50, dailyProgress: 30, xpGained: 10 })); // ещё не дотянули
  assert.deepEqual(seen, []);

  celebrate(baseUpdate({ dailyGoal: 50, dailyProgress: 55, xpGained: 25 })); // пересекли
  assert.deepEqual(seen, ['dailyGoal']);

  celebrate(baseUpdate({ dailyGoal: 50, dailyProgress: 60, xpGained: 5 })); // уже выше — молчим
  assert.deepEqual(seen, ['dailyGoal']);

  unsubscribe();
  celebrate(baseUpdate({ leveledUp: true, level: 9 }));
  assert.deepEqual(seen, ['dailyGoal'], 'после отписки новые события не приходят');
});

test('celebrate(null) — тихая операция', () => {
  const seen: string[] = [];
  const raw: number[] = [];
  const off1 = onCelebration(e => seen.push(e.kind));
  const off2 = onGameUpdate(u => raw.push(u.xp));
  celebrate(null);
  assert.deepEqual(seen, []);
  assert.deepEqual(raw, []);
  off1();
  off2();
});

test('onGameUpdate получает КАЖДОЕ событие, даже без праздника', () => {
  const raw: number[] = [];
  const unsubscribe = onGameUpdate(u => raw.push(u.xp));
  celebrate(baseUpdate({ xp: 10, dailyProgress: 5 }));
  celebrate(baseUpdate({ xp: 20, dailyProgress: 10 }));
  assert.deepEqual(raw, [10, 20]);
  unsubscribe();
});

test('emitCelebration напрямую тоже доходит до подписчиков', () => {
  const seen: string[] = [];
  const unsubscribe = onCelebration(e => seen.push(e.kind));
  emitCelebration({ kind: 'levelUp', level: 1 });
  assert.deepEqual(seen, ['levelUp']);
  unsubscribe();
});
