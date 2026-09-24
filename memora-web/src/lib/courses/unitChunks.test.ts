// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/courses/unitChunks.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import { collectUnitChunks, normalizeChunkKey, type ChunkSourceUnit } from './unitChunks';
import type { EditoExercise, VocabularyItem } from './edito-a1';

test('нормализация: регистр, пунктуация и апостроф не мешают сравнению', () => {
  assert.equal(normalizeChunkKey("C'est combien ?"), normalizeChunkKey('c’est combien'));
  assert.equal(normalizeChunkKey('Bonjour !'), normalizeChunkKey('bonjour'));
});

test('берёт реплики pronunciation (text → ru)', () => {
  const unit: ChunkSourceUnit = {
    exercises: [
      {
        id: 'ex1', type: 'pronunciation', title: 'Prononciation',
        pronItems: [
          { text: 'Bonjour, comment ça va ?', ru: 'Здравствуйте, как дела?', kind: 'phrase' },
          { text: 'chat', ru: 'кот', kind: 'word' },
        ],
      } as EditoExercise,
    ],
  };
  const chunks = collectUnitChunks(unit);
  assert.deepEqual(chunks, [
    { fr: 'Bonjour, comment ça va ?', ru: 'Здравствуйте, как дела?' },
    { fr: 'chat', ru: 'кот' },
  ]);
});

test('берёт meaning-to-form: answers[0] ← ru', () => {
  const unit: ChunkSourceUnit = {
    exercises: [
      {
        id: 'ex2', type: 'meaning-to-form', title: 'Production',
        productions: [
          { ru: 'Я не работаю в субботу.', answers: ['Je ne travaille pas le samedi.', 'Je travaille pas le samedi.'] },
        ],
      } as EditoExercise,
    ],
  };
  const chunks = collectUnitChunks(unit);
  assert.deepEqual(chunks, [{ fr: 'Je ne travaille pas le samedi.', ru: 'Я не работаю в субботу.' }]);
});

test('берёт лексику юнита только с type "phrase", слова пропускает', () => {
  const vocabulary: VocabularyItem[] = [
    { fr: 'Enchanté !', ru: 'Очень приятно!', type: 'phrase' },
    { fr: 'chat', ru: 'кот', type: 'word' },
    { fr: 'table', ru: 'стол' },
  ];
  const unit: ChunkSourceUnit = { vocabulary, exercises: [] };
  assert.deepEqual(collectUnitChunks(unit), [{ fr: 'Enchanté !', ru: 'Очень приятно!' }]);
});

test('не берёт substitution и transformation — там нет перевода фразы целиком', () => {
  const unit: ChunkSourceUnit = {
    exercises: [
      {
        id: 'ex3', type: 'substitution', title: 'Substitution', frame: 'Il est {}.',
        substitutions: [{ cue: 'ponctuel', cueRu: 'пунктуальный', answers: ['Il est ponctuel.'] }],
      } as EditoExercise,
      {
        id: 'ex4', type: 'transformation', title: 'Transformation',
        transformations: [{ source: 'Il a un casque.', task: 'отрицание', answers: ['Il n’a pas de casque.'] }],
      } as EditoExercise,
    ],
  };
  assert.deepEqual(collectUnitChunks(unit), []);
});

test('пропускает пустые и отсутствующие переводы', () => {
  const unit: ChunkSourceUnit = {
    exercises: [
      {
        id: 'ex5', type: 'pronunciation', title: 'Prononciation',
        pronItems: [
          { text: '  ', ru: 'пусто' },
          { text: 'Salut', ru: '' },
          { text: 'Salut encore', ru: undefined },
        ],
      } as EditoExercise,
      {
        id: 'ex6', type: 'meaning-to-form', title: 'Production',
        productions: [{ ru: 'без ответа', answers: [] }],
      } as EditoExercise,
    ],
  };
  assert.deepEqual(collectUnitChunks(unit), []);
});

test('де-дублирует по нормализованному ключу — оставляет первое вхождение', () => {
  const unit: ChunkSourceUnit = {
    vocabulary: [{ fr: "C'est combien ?", ru: 'Сколько это стоит? (словарь)', type: 'phrase' }],
    exercises: [
      {
        id: 'ex7', type: 'pronunciation', title: 'Prononciation',
        pronItems: [{ text: 'c’est combien', ru: 'Сколько это стоит?' }],
      } as EditoExercise,
    ],
  };
  const chunks = collectUnitChunks(unit);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].fr, "C'est combien ?");
  assert.equal(chunks[0].ru, 'Сколько это стоит? (словарь)');
});

test('порядок: сначала лексика юнита, затем упражнения в своём порядке', () => {
  const unit: ChunkSourceUnit = {
    vocabulary: [{ fr: 'Enchanté !', ru: 'Очень приятно!', type: 'phrase' }],
    exercises: [
      { id: 'ex8', type: 'meaning-to-form', title: 'P', productions: [{ ru: 'ру1', answers: ['fr1'] }] } as EditoExercise,
      {
        id: 'ex9', type: 'pronunciation', title: 'Pr',
        pronItems: [{ text: 'fr2', ru: 'ру2' }],
      } as EditoExercise,
    ],
  };
  const chunks = collectUnitChunks(unit);
  assert.deepEqual(chunks.map(c => c.fr), ['Enchanté !', 'fr1', 'fr2']);
});
