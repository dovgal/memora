// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/trainer/coaching.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { coachingHeading, coachingNextStep, pluralRu } from './coaching';

const base = { accuracy: 100, weakTerms: [], newLeft: 0, dueTomorrow: 0, practice: false };

test('русское множественное число', () => {
  const f: [string, string, string] = ['карточка', 'карточки', 'карточек'];
  assert.equal(pluralRu(1, f), 'карточка');
  assert.equal(pluralRu(3, f), 'карточки');
  assert.equal(pluralRu(5, f), 'карточек');
  assert.equal(pluralRu(11, f), 'карточек');
  assert.equal(pluralRu(21, f), 'карточка');
  assert.equal(pluralRu(14, f), 'карточек');
});

test('заголовок всегда ободряющий', () => {
  assert.match(coachingHeading(95), /Отличн/);
  assert.match(coachingHeading(20), /прошли/);
});

test('при низкой точности совет — начать завтра с трудных слов, а не брать новое', () => {
  const s = coachingNextStep({ ...base, accuracy: 40, weakTerms: ['le chat', 'la maison', 'un chien', 'le pain'], newLeft: 10 });
  assert.match(s, /Не спешите брать новое/);
  assert.match(s, /«le chat», «la maison», «un chien»/);
  assert.doesNotMatch(s, /le pain/, 'не больше трёх слов');
});

test('без ошибок и с новыми в запасе — совет взять следующие слова', () => {
  assert.match(coachingNextStep({ ...base, newLeft: 5 }), /ещё 5 новых карточек/);
});

test('занятие сверх плана — можно отдыхать', () => {
  assert.match(coachingNextStep({ ...base, practice: true }), /отдыхать/);
});

test('без ошибок и без новых — напоминание о завтрашнем повторе', () => {
  assert.match(coachingNextStep({ ...base, dueTomorrow: 2 }), /2 карточки/);
});
