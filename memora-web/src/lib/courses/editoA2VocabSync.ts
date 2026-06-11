// Личный набор «Édito A2 — Словарь»: пополняется словами и фразами юнита,
// как только юнит тренажёра Édito A2 полностью пройден.
// Карточки попадают в обычные наборы memora — со всеми режимами заучивания и FSRS.

import { EDITO_A2_UNITS, A2_UNIT_ORDER, EDITO_A2_COURSE_ID } from './edito-a2';
import { getCourseProgress, type ProgressEntry } from './customCoursesApi';

const SET_TITLE = 'Édito A2 — Словарь';
const SET_DESCRIPTION = 'Слова и ключевые фразы уровня A2 — пополняется автоматически по мере прохождения тренажёра Édito A2.';

const FIELDS_SCHEMA = [
  { id: 'term', name: 'Французский', type: 'text', side: 'front', order: 1, settings: { language: 'fr', ttsEnabled: true } },
  { id: 'definition', name: 'Перевод', type: 'text', side: 'back', order: 1, settings: { language: 'ru' } },
];

interface VocabCard { term: string; definition: string }

function extractUnitCards(unitId: string): VocabCard[] {
  const unit = EDITO_A2_UNITS[unitId];
  if (!unit?.vocabulary) return [];
  const cards: VocabCard[] = [];
  const seen = new Set<string>();
  for (const v of unit.vocabulary) {
    const key = v.fr.trim().toLowerCase();
    if (!v.fr.trim() || !v.ru.trim() || seen.has(key)) continue;
    seen.add(key);
    cards.push({ term: v.fr.trim(), definition: v.ru.trim() });
  }
  return cards;
}

function getCompletedUnitIds(entries: ProgressEntry[]): string[] {
  const doneByUnit: Record<string, Set<string>> = {};
  for (const e of entries) {
    (doneByUnit[e.unitId] ??= new Set()).add(e.exerciseId);
  }
  return A2_UNIT_ORDER.filter(unitId => {
    const unit = EDITO_A2_UNITS[unitId];
    const interactive = unit?.exercises.filter(ex => ex.type !== 'theory') || [];
    const done = doneByUnit[unitId];
    return interactive.length > 0 && done && interactive.every(ex => done.has(ex.id));
  });
}

function headers(idToken: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
}

interface ExistingSet {
  id: string;
  flashcards: Array<{ id: string; term: string; definition: string; fieldsData?: Record<string, unknown> }>;
}

async function findOwnVocabSet(idToken: string): Promise<{ id: string } | null> {
  const r = await fetch('/api/sets', { headers: headers(idToken) });
  if (!r.ok) return null;
  const sets: Array<{ id: string; title: string }> = await r.json();
  const found = sets.find(s => s.title === SET_TITLE);
  return found ? { id: found.id } : null;
}

async function fetchSet(setId: string, idToken: string): Promise<ExistingSet | null> {
  const r = await fetch(`/api/sets/${setId}`, { headers: headers(idToken) });
  if (!r.ok) return null;
  return r.json();
}

// Идемпотентно: добавляет только карточки пройденных юнитов, которых ещё нет в наборе.
export async function syncA2VocabSet(idToken: string): Promise<void> {
  const progress = await getCourseProgress(EDITO_A2_COURSE_ID, idToken);
  const completedUnits = getCompletedUnitIds(progress);
  if (completedUnits.length === 0) return;

  const allCards = completedUnits.flatMap(extractUnitCards);
  if (allCards.length === 0) return;

  const existing = await findOwnVocabSet(idToken);

  if (!existing) {
    await fetch('/api/sets', {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify({
        title: SET_TITLE,
        description: SET_DESCRIPTION,
        isPublic: false,
        fieldsSchema: FIELDS_SCHEMA,
        flashcards: allCards.map(c => ({ term: c.term, definition: c.definition, fieldsData: {} })),
      }),
    });
    return;
  }

  const full = await fetchSet(existing.id, idToken);
  if (!full) return;

  const existingTerms = new Set(full.flashcards.map(f => f.term.trim().toLowerCase()));
  const newCards = allCards.filter(c => !existingTerms.has(c.term.trim().toLowerCase()));
  if (newCards.length === 0) return;

  await fetch(`/api/sets/${existing.id}`, {
    method: 'PUT',
    headers: headers(idToken),
    body: JSON.stringify({
      title: SET_TITLE,
      description: SET_DESCRIPTION,
      isPublic: false,
      fieldsSchema: FIELDS_SCHEMA,
      flashcards: [
        ...full.flashcards.map(f => ({ id: f.id, term: f.term, definition: f.definition, fieldsData: f.fieldsData || {} })),
        ...newCards.map(c => ({ term: c.term, definition: c.definition, fieldsData: {} })),
      ],
    }),
  });
}
