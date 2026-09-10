// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/courses/heardCheck.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { heardSomething } from './heardCheck';

const good = { noSpeechProb: 0.02, avgLogprob: -0.3 };

test('настоящий случай: сказано два слова — распознано шесть', () => {
  // «la téléréalité» → «Il est quelle heure le week-end». Модель уверена в
  // каждом слове, и по уверенности такое не отличить — только по длине.
  assert.equal(
    heardSomething('la téléréalité', 'Il est quelle heure le week-end', 0.9, good),
    false,
  );
});

test('верный ответ засчитывается', () => {
  assert.ok(heardSomething('la téléréalité', 'la téléréalité', 0.9, good));
  assert.ok(heardSomething('il écoute', 'il écoute', 0.8, good));
});

test('обычная ошибка произношения остаётся ошибкой, а не «не расслышал»', () => {
  // Длина та же — значит, человек говорил, просто неточно. Это надо оценивать.
  assert.ok(heardSomething('ma mémé', 'ma mémère', 0.8, good));
});

test('модель сама говорит, что речи не было', () => {
  assert.equal(heardSomething('la télé', 'la télé', 0.9, { noSpeechProb: 0.85, avgLogprob: -0.3 }), false);
});

test('неправдоподобный кусок не засчитывается', () => {
  assert.equal(heardSomething('la télé', 'la télé', 0.9, { noSpeechProb: 0.1, avgLogprob: -1.8 }), false);
});

test('низкая уверенность по словам — по-прежнему повод не засчитывать', () => {
  assert.equal(heardSomething('la télé', 'la télé', 0.3, good), false);
});

test('одно лишнее слово прощается', () => {
  // Микрофон мог прихватить вздох или «эм» — придираться не за что.
  assert.ok(heardSomething('la télé', 'la télé euh', 0.8, good));
});
