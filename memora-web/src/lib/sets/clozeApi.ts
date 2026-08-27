// Клиент тренажёра «слово в контексте».

export interface ClozeItem {
  cardId: string;
  term: string;
  sentence: string;
  translation: string;
  /** saved — сочинено раньше, example — пример карточки, llm — сочинено сейчас. */
  source: string;
}

export interface ClozeBatch {
  items: ClozeItem[];
  studyLanguage: string;
  nativeLanguage: string;
}

export async function fetchCloze(setId: string, cardIds: string[], idToken?: string): Promise<ClozeBatch> {
  const res = await fetch(`/api/sets/${setId}/cloze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ cardIds }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Разбить предложение по слову, чтобы поставить пропуск.
 *
 * Слово ищется как отдельное: внутри другого оно не считается, иначе пропуск
 * съел бы кусок соседнего слова. Возвращает null, если слова в предложении нет —
 * такую карточку в раунд не берём.
 */
export function blankOut(sentence: string, term: string): { before: string; after: string } | null {
  const t = term.trim();
  if (!t) return null;
  const lower = sentence.toLowerCase();
  const needle = t.toLowerCase();
  let from = 0;
  for (;;) {
    const i = lower.indexOf(needle, from);
    if (i < 0) return null;
    const beforeChar = i > 0 ? lower[i - 1] : ' ';
    const afterChar = i + needle.length < lower.length ? lower[i + needle.length] : ' ';
    const isEdge = (c: string) => !/[\p{L}\p{N}]/u.test(c);
    if (isEdge(beforeChar) && isEdge(afterChar)) {
      return { before: sentence.slice(0, i), after: sentence.slice(i + t.length) };
    }
    from = i + 1;
  }
}

/** Три чужих слова для выбора: предпочитаем близкие по длине — так труднее угадать. */
export function distractors(correct: string, pool: string[], count = 3): string[] {
  const others = pool.filter(w => w.toLowerCase() !== correct.toLowerCase());
  const byCloseness = [...new Set(others)].sort(
    (a, b) => Math.abs(a.length - correct.length) - Math.abs(b.length - correct.length),
  );
  // Берём из ближайшей половины, но вразнобой — иначе варианты предсказуемы.
  const near = byCloseness.slice(0, Math.max(count * 3, 9));
  for (let i = near.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [near[i], near[j]] = [near[j], near[i]];
  }
  return near.slice(0, count);
}
