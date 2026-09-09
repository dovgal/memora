// Проверки ступеней заучивания и приманок.
//
// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/courses/verbs/steps.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { stepFor, nearMisses, choiceOptions } from './steps';
import type { IrregularVerb } from './types';

const BEGIN: IrregularVerb = { n: 5, inf: 'BEGIN', pret: 'BEGAN', pp: 'BEGUN', fr: 'COMMENCER', page: 1 };
const PUT: IrregularVerb = { n: 80, inf: 'PUT', pret: 'PUT', pp: 'PUT', fr: 'METTRE', page: 4 };
const BE: IrregularVerb = { n: 1, inf: 'BE', pret: 'WAS, WERE', pp: 'BEEN', fr: 'ÊTRE', page: 1 };

test('незнакомый глагол сперва даётся списать', () => {
  assert.equal(stepFor(0, 0), 'copy');
});

test('после первого ответа — выбор, после нескольких верных — с чистого листа', () => {
  assert.equal(stepFor(1, 0), 'choice');
  assert.equal(stepFor(2, 0), 'recall');
  assert.equal(stepFor(5, 0), 'recall');
});

test('промах возвращает на ступень с подсказкой', () => {
  assert.equal(stepFor(3, 1), 'choice', 'ошибался — рано спрашивать с чистого листа');
  assert.equal(stepFor(4, 1), 'recall', 'но не навсегда');
});

test('приманки берутся из форм того же глагола', () => {
  const got = nearMisses(BEGIN, 'pret');
  assert.ok(got.includes('BEGUN'), 'соседняя форма — главная путаница');
  assert.ok(got.includes('BEGIN'));
  assert.ok(!got.includes('BEGAN'), 'верный ответ приманкой быть не может');
  assert.equal(new Set(got).size, got.length, 'повторов быть не должно');
});

test('у глагола с одинаковыми формами приманки не повторяют ответ', () => {
  const got = nearMisses(PUT, 'pp');
  assert.ok(!got.includes('PUT'));
  assert.equal(new Set(got).size, got.length);
});

test('варианты всегда содержат верный ответ и не повторяются', () => {
  for (const [verb, target] of [[BEGIN, 'pret'], [PUT, 'pp'], [BE, 'pp']] as const) {
    const correct = (target === 'pret' ? verb.pret : verb.pp).toUpperCase();
    const opts = choiceOptions(verb, target, false);
    assert.ok(opts.includes(correct), `${verb.inf}: верный ответ обязан быть среди вариантов`);
    assert.equal(new Set(opts).size, opts.length, `${verb.inf}: повторов быть не должно`);
    assert.ok(opts.length >= 2, `${verb.inf}: выбор из одного — не выбор`);
  }
});
