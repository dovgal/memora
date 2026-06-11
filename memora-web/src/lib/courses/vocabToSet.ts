// Универсальная выгрузка лексики юнита в личный набор карточек memora.
// Идемпотентно: добавляются только новые термины.

import type { VocabularyItem } from '@/lib/courses/edito-a1';

const FIELDS_SCHEMA = [
  { id: 'term', name: 'Французский', type: 'text', side: 'front', order: 1, settings: { language: 'fr', ttsEnabled: true } },
  { id: 'definition', name: 'Перевод', type: 'text', side: 'back', order: 1, settings: { language: 'ru' } },
];

function headers(idToken: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

interface ExistingSet {
  id: string;
  flashcards: Array<{ id: string; term: string; definition: string; fieldsData?: Record<string, unknown> }>;
}

/**
 * Добавляет слова в личный набор с заголовком setTitle (создаёт набор при отсутствии).
 * Возвращает количество добавленных карточек.
 */
export async function addVocabToPersonalSet(
  setTitle: string,
  description: string,
  vocab: VocabularyItem[],
  idToken: string,
): Promise<number> {
  const cards = vocab
    .filter(v => v.fr?.trim() && v.ru?.trim())
    .map(v => ({ term: v.fr.trim(), definition: v.ru.trim() }));
  if (cards.length === 0) return 0;

  const listR = await fetch('/api/sets', { headers: headers(idToken) });
  if (!listR.ok) throw new Error('Не удалось получить список наборов');
  const sets: Array<{ id: string; title: string }> = await listR.json();
  const found = sets.find(s => s.title === setTitle);

  if (!found) {
    const r = await fetch('/api/sets', {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify({
        title: setTitle,
        description,
        isPublic: false,
        fieldsSchema: FIELDS_SCHEMA,
        flashcards: cards.map(c => ({ term: c.term, definition: c.definition, fieldsData: {} })),
      }),
    });
    if (!r.ok) throw new Error('Не удалось создать набор');
    return cards.length;
  }

  const fullR = await fetch(`/api/sets/${found.id}`, { headers: headers(idToken) });
  if (!fullR.ok) throw new Error('Не удалось открыть набор');
  const full: ExistingSet = await fullR.json();

  const existing = new Set(full.flashcards.map(f => f.term.trim().toLowerCase()));
  const fresh = cards.filter(c => !existing.has(c.term.trim().toLowerCase()));
  if (fresh.length === 0) return 0;

  const r = await fetch(`/api/sets/${found.id}`, {
    method: 'PUT',
    headers: headers(idToken),
    body: JSON.stringify({
      title: setTitle,
      description,
      isPublic: false,
      fieldsSchema: FIELDS_SCHEMA,
      flashcards: [
        ...full.flashcards.map(f => ({ id: f.id, term: f.term, definition: f.definition, fieldsData: f.fieldsData || {} })),
        ...fresh.map(c => ({ term: c.term, definition: c.definition, fieldsData: {} })),
      ],
    }),
  });
  if (!r.ok) throw new Error('Не удалось обновить набор');
  return fresh.length;
}
