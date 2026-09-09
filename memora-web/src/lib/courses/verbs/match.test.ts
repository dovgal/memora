// Тесты сравнения ответа с формой из таблицы. Запуск — см. sessionPlan.test.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acceptedForms, isFormCorrect } from './match';

test('обычная форма — регистр и пробелы по краям не важны', () => {
  assert.ok(isFormCorrect('kept', 'KEPT'));
  assert.ok(isFormCorrect('  Kept ', 'KEPT'));
  assert.ok(!isFormCorrect('keept', 'KEPT'));
});

test('запятая — верны обе формы', () => {
  // Принимаем и обе части по отдельности, и полную запись из таблицы.
  assert.deepEqual(acceptedForms('WAS, WERE'), ['WAS, WERE', 'WAS', 'WERE']);
  assert.ok(isFormCorrect('was', 'WAS, WERE'));
  assert.ok(isFormCorrect('were', 'WAS, WERE'));
  assert.ok(!isFormCorrect('is', 'WAS, WERE'));
});

test('слэш — требуется только британский вариант, американский не принимается', () => {
  assert.deepEqual(acceptedForms('BURNT/-ED'), ['BURNT']);
  assert.ok(isFormCorrect('burnt', 'BURNT/-ED'));
  assert.ok(!isFormCorrect('burned', 'BURNT/-ED'));
  assert.ok(!isFormCorrect('-ed', 'BURNT/-ED'));
});

test('внутренние пробелы схлопываются, но не пропадают целиком', () => {
  assert.ok(isFormCorrect('WAS  WERE'.replace('  ', ' '), 'WAS WERE'));
});

test('обе формы вместе — тоже верный ответ, так напечатано в таблице', () => {
  assert.ok(isFormCorrect('was, were', 'WAS, WERE'));
  assert.ok(isFormCorrect('WAS, WERE', 'WAS, WERE'));
  // Пробел после запятой ставят не все.
  assert.ok(isFormCorrect('was,were', 'WAS, WERE'));
  // И каждая по отдельности остаётся верной.
  assert.ok(isFormCorrect('was', 'WAS, WERE'));
  assert.ok(isFormCorrect('were', 'WAS, WERE'));
  // А посторонняя форма — нет.
  assert.ok(!isFormCorrect('been', 'WAS, WERE'));
});
