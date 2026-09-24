// Запуск: npx tsc -p tsconfig.tests.json && node --test /tmp/study-test/lib/courses/monologue.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  type ChunkTranscript,
  formatClock, recordingLimits, looksLikeLoop, isPhantomChunk, mergeChunks, pickTranscript,
  refusalReason, normalizeReview, parseReviewBody, foxLine,
} from './monologue';

const chunk = (index: number, offset: number, text: string, extra: Partial<ChunkTranscript> = {}): ChunkTranscript => ({
  index, offset, text,
  words: text.split(' ').filter(Boolean).map((word, i) => ({ word, start: i, end: i + 0.5, probability: 0.9 })),
  noSpeechProb: 0.05, avgLogprob: -0.3, ...extra,
});

const STORY = 'Bonjour je m’appelle Ivan et je suis technicien de portes depuis dix ans';

test('часы и пределы записи', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(65.9), '1:05');
  assert.deepEqual(recordingLimits({}), { min: 30, max: 150 });
  assert.deepEqual(recordingLimits({ minSeconds: 20, maxSeconds: 90 }), { min: 20, max: 90 });
  // Опечатки в данных курса не ломают запись: минимум не больше максимума.
  assert.deepEqual(recordingLimits({ minSeconds: 500, maxSeconds: 10 }), { min: 30, max: 30 });
  assert.deepEqual(recordingLimits({ minSeconds: Number.NaN }), { min: 30, max: 150 });
});

test('зацикливание распознаётся, живая речь — нет', () => {
  assert.ok(looksLikeLoop("Merci d'avoir regardé la vidéo. ".repeat(6)));
  assert.ok(looksLikeLoop('oui '.repeat(25)));
  assert.equal(looksLikeLoop(`${STORY}. J'aime réparer les portes sectionnelles et travailler en équipe.`), false);
});

test('досочинённые куски отбрасываются', () => {
  assert.ok(isPhantomChunk(chunk(0, 0, 'Sous-titres réalisés par la communauté d’Amara.org')));
  assert.ok(isPhantomChunk(chunk(0, 0, '   ')));
  assert.ok(isPhantomChunk(chunk(0, 0, 'Je suis là', { noSpeechProb: 0.9, avgLogprob: -0.9 })));
  assert.ok(isPhantomChunk(chunk(0, 0, 'Je suis là', { avgLogprob: -1.5 })));
  const unsure = chunk(0, 0, 'la la porte');
  unsure.words = unsure.words.map(w => ({ ...w, probability: 0.2 }));
  assert.ok(isPhantomChunk(unsure));
});

test('пауза посреди речи сама по себе не делает кусок выдумкой', () => {
  // На длинной паузе no_speech высокий, но текст правдоподобный — это речь.
  assert.equal(isPhantomChunk(chunk(0, 0, STORY, { noSpeechProb: 0.8, avgLogprob: -0.4 })), false);
});

test('склейка: порядок, сдвиг времени, выброс шума', () => {
  const merged = mergeChunks([
    chunk(2, 40, 'et je cherche un travail'),
    chunk(0, 0, 'Bonjour je suis Ivan'),
    chunk(1, 20, 'Merci d’avoir regardé'),
  ]);
  assert.equal(merged.text, 'Bonjour je suis Ivan et je cherche un travail');
  assert.equal(merged.dropped, 1);
  assert.equal(merged.words[4].start, 40);
  assert.equal(merged.words[4].word, 'et');
});

test('сервис распознал всё — верим ему', () => {
  const p = pickTranscript({ chunks: [chunk(0, 0, STORY)], expected: 1, browserText: 'bonjour je' });
  assert.equal(p.source, 'server');
  assert.equal(p.partial, false);
  assert.ok(p.words.length > 0);
});

test('сервис недоступен — берём браузер', () => {
  const p = pickTranscript({ chunks: [], expected: 3, browserText: STORY });
  assert.equal(p.source, 'browser');
  assert.deepEqual(p.words, []);
});

test('сервис ответил на часть кусков — берём того, кто услышал больше', () => {
  const partial = pickTranscript({ chunks: [chunk(0, 0, 'Bonjour je suis Ivan')], expected: 3, browserText: STORY });
  assert.equal(partial.source, 'browser');
  const serverMore = pickTranscript({ chunks: [chunk(0, 0, STORY)], expected: 2, browserText: 'bonjour' });
  assert.equal(serverMore.source, 'server');
  assert.equal(serverMore.partial, true);
});

test('сервис счёл тихий голос тишиной, а браузер слышал', () => {
  const p = pickTranscript({
    chunks: [chunk(0, 0, 'Sous-titres réalisés par Amara.org')], expected: 1, browserText: STORY,
  });
  assert.equal(p.source, 'browser');
});

test('никто ничего не услышал', () => {
  const p = pickTranscript({ chunks: [chunk(0, 0, '')], expected: 1, browserText: '' });
  assert.equal(p.source, 'none');
  assert.equal(p.text, '');
});

test('отказ разбирать шум и пустоту', () => {
  assert.match(refusalReason('bonjour', 30, true) ?? '', /не расслышали/);
  assert.match(refusalReason('bonjour', 0, false) ?? '', /напишите/);
  assert.match(refusalReason('oui '.repeat(25), 30, true) ?? '', /шум/);
  // 150 слов за 20 секунд — не речь начинающего.
  const dense = Array.from({ length: 150 }, (_, i) => `mot${i}`).join(' ');
  assert.match(refusalReason(dense, 20, true) ?? '', /помехи/);
  assert.equal(refusalReason(STORY, 40, true), null);
  // Напечатанный ответ темпом не проверяем: время ушло на набор.
  assert.equal(refusalReason(STORY, 1, false), null);
});

test('разбор с пропусками и мусором не роняет экран', () => {
  const r = normalizeReview({
    overall: 'Bien', goalsCovered: [{ goal: 'Имя', covered: 'yes' }, null, { goal: '' }],
    errors: [{ quote: 'je suis 35 ans', correction: "j'ai 35 ans", kind: 'weird' }, { quote: 'x' }],
    usefulPhrases: [{ fr: 'Je suis motivé.', ru: null }, 'junk'],
    scores: { content: 4, grammar: null },
    fluency: { words: 40, wordsPerMinute: null, fillerWords: [{ word: 'euh', count: 2 }] },
  });
  assert.equal(r.goalsCovered.length, 1);
  assert.equal(r.goalsCovered[0].covered, false);
  assert.equal(r.errors.length, 1);
  assert.equal(r.errors[0].kind, 'other');
  assert.deepEqual(r.usefulPhrases, [{ fr: 'Je suis motivé.', ru: '' }]);
  assert.deepEqual(r.scores, { content: 4, grammar: 0, vocabulary: 0, fluency: 0 });
  assert.equal(r.fluency.wordsPerMinute, null);
  assert.equal(r.fluency.longPauses, null);
  assert.equal(r.nextStep, '');
});

test('тело ответа: пробелы перед JSON, ошибка в поле, ошибка статусом', () => {
  const ok = parseReviewBody(200, '     {"overall":"Bravo","betterVersion":"Je suis Ivan."}');
  assert.ok('review' in ok && ok.review.overall === 'Bravo');
  const inBody = parseReviewBody(200, '   {"error":"Проверка сейчас недоступна"}');
  assert.deepEqual(inBody, { error: 'Проверка сейчас недоступна' });
  assert.deepEqual(parseReviewBody(502, '<html>Bad gateway</html>'), { error: 'Проверка не ответила (502).' });
  const limited = parseReviewBody(429, '');
  assert.match('error' in limited ? limited.error : '', /подождите/);
  assert.ok('error' in parseReviewBody(200, '{}'));
});

test('лисёнок хвалит по-разному', () => {
  const base = normalizeReview({ overall: 'x', goalsCovered: [{ goal: 'a', covered: true }] });
  assert.match(foxLine({ ...base, scores: { content: 5, grammar: 4, vocabulary: 4, fluency: 4 } }), /Отличный/);
  assert.match(foxLine(base), /Всё главное/);
  assert.match(foxLine({ ...base, goalsCovered: [], scores: { content: 2, grammar: 2, vocabulary: 2, fluency: 2 } }), /главное/);
});
