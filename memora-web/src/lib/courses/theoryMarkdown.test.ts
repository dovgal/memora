import { test } from 'node:test';
import assert from 'node:assert/strict';
import { theoryToHtml } from './theoryMarkdown';

test('готовый HTML не трогаем', () => {
  const html = "<p style='margin:0'>Уже <b>HTML</b></p>";
  assert.equal(theoryToHtml(html), html);
});

test('жирный и абзацы', () => {
  const out = theoryToHtml('**être** — быть.\n\nВторой абзац');
  assert.equal(out, '<p style="margin:0.6rem 0"><b>être</b> — быть.</p><p style="margin:0.6rem 0">Второй абзац</p>');
});

test('перенос строки внутри абзаца сохраняется', () => {
  assert.match(theoryToHtml('je suis · tu es\nil est'), /je suis · tu es<br>il est/);
});

test('нумерованный список и маркированный', () => {
  const out = theoryToHtml('Лесенка:\n1. **Замена**\n2. Преобразование\n\n- раз\n- два');
  assert.match(out, /<ol[^>]*><li><b>Замена<\/b><\/li><li>Преобразование<\/li><\/ol>/);
  assert.match(out, /<ul[^>]*><li>раз<\/li><li>два<\/li><\/ul>/);
});

test('угловые скобки в тексте экранируются, а не становятся тегами', () => {
  assert.match(theoryToHtml('a < b и **c**'), /a &lt; b и <b>c<\/b>/);
});

test('французские кавычки и тире не ломаются', () => {
  assert.match(theoryToHtml('«Je **ne** parle **pas**» — отрицание'), /«Je <b>ne<\/b> parle <b>pas<\/b>» — отрицание/);
});
