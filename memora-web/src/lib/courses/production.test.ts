// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/courses/production.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { matchProduction, foldAccents } from './production';

test('верная фраза засчитывается', () => {
  assert.equal(matchProduction(['Je suis ponctuel.'], 'Je suis ponctuel.').verdict, 'exact');
});

test('заглавные, финальная точка и апостроф не мешают', () => {
  assert.equal(matchProduction(["Il n'a pas de casque."], 'il n’a pas de casque').verdict, 'exact');
});

test('потерянный акцент — верно, но с пометкой', () => {
  const m = matchProduction(['Je suis motivé.'], 'Je suis motive');
  assert.equal(m.verdict, 'accents');
});

test('другое слово — ошибка, и показываем ближайший верный ответ', () => {
  const m = matchProduction(['Je suis ponctuel.'], 'Je suis sérieux.');
  assert.equal(m.verdict, 'wrong');
  assert.equal(m.best, 'Je suis ponctuel.');
});

test('из нескольких верных ответов выбирается тот, что сказан', () => {
  const m = matchProduction(['Je ne travaille pas le samedi.', 'Je travaille pas le samedi.'], 'je travaille pas le samedi');
  assert.equal(m.verdict, 'exact');
  assert.equal(m.best, 'Je travaille pas le samedi.');
});

test('лишнее слово не проходит как верное', () => {
  assert.equal(matchProduction(['Je suis ponctuel.'], 'Je suis très ponctuel.').verdict, 'wrong');
});

test('пропущенное слово — ошибка, а не «почти»', () => {
  assert.equal(matchProduction(["Il n'a pas de casque."], "Il n'a pas casque.").verdict, 'wrong');
});

test('снятие акцентов работает на французских буквах', () => {
  assert.equal(foldAccents('élève à côté, garçon'), 'eleve a cote, garcon');
});
