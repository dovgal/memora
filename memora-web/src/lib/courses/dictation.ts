// Проверка диктанта: детерминированный пословный diff (без LLM).
//
// Нормализация НЕ убирает акценты и апострофы — в французской орфографии это
// и есть предмет проверки (é/è, ou/où, a/à). Снимается только пунктуация по
// краям слова и регистр.

export type DiffOpType = 'ok' | 'wrong' | 'missing' | 'extra';

export interface DiffOp {
  type: DiffOpType;
  /** Слово эталона (для ok/wrong/missing). */
  expected?: string;
  /** Слово учащегося (для ok/wrong/extra). */
  given?: string;
}

export interface DictationCheck {
  ops: DiffOp[];
  /** Правильных слов. */
  correct: number;
  /** Всего слов в эталоне. */
  total: number;
  /** Неверно написанные слова учащегося (для журнала ошибок). */
  wrongGiven: string[];
}

/** Токенизация: по пробелам, срезаем пунктуацию по краям (апострофы и дефисы внутри слова остаются). */
export function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .map(w => w.replace(/^[.,!?;:«»"„“()\[\]…]+|[.,!?;:«»"„“()\[\]…]+$/g, ''))
    .filter(Boolean);
}

function norm(word: string): string {
  // Типографский апостроф → обычный, регистр вниз. Акценты сохраняются.
  return word.toLowerCase().replace(/’/g, "'");
}

/**
 * Пословное сравнение через LCS: совпавшие слова — ok, замены — wrong,
 * пропущенные — missing, лишние — extra. Предложения короткие, DP-таблица дёшева.
 */
export function checkDictation(expectedText: string, givenText: string): DictationCheck {
  const expected = tokenize(expectedText);
  const given = tokenize(givenText);
  const e = expected.map(norm);
  const g = given.map(norm);

  // LCS DP
  const n = e.length, m = g.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = e[i] === g[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // Восстановление пути; несовпавшие пары (missing+extra подряд) сливаем в wrong.
  const ops: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (e[i] === g[j]) {
      ops.push({ type: 'ok', expected: expected[i], given: given[j] });
      i++; j++;
    } else if (dp[i + 1][j + 1] === dp[i + 1][j] && dp[i + 1][j + 1] === dp[i][j + 1]) {
      // Ни пропуск эталона, ни пропуск ввода не выигрывают — это замена (опечатка в слове).
      ops.push({ type: 'wrong', expected: expected[i], given: given[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'missing', expected: expected[i] });
      i++;
    } else {
      ops.push({ type: 'extra', given: given[j] });
      j++;
    }
  }
  while (i < n) { ops.push({ type: 'missing', expected: expected[i] }); i++; }
  while (j < m) { ops.push({ type: 'extra', given: given[j] }); j++; }

  const correct = ops.filter(o => o.type === 'ok').length;
  const wrongGiven = ops
    .filter(o => o.type === 'wrong' || o.type === 'extra')
    .map(o => o.given!)
    .filter(Boolean);

  return { ops, correct, total: expected.length, wrongGiven };
}
