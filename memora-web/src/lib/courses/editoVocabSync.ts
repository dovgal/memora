// Личный набор «Edito A1 — Словарь»: пополняется карточками (слова + ключевые фразы)
// по мере того, как студент проходит юниты тренажёра Édito A1.
// Один набор на пользователя — каждый учится в своём темпе всеми режимами memora
// (карточки, заучивание, тест, подбор, блоки, blast).

import { EDITO_A1_UNITS, UNIT_ORDER, GenderItem } from './edito-a1';
import { getCourseProgress, ProgressEntry } from './editoProgressApi';

const SET_TITLE = 'Edito A1 — Словарь';
const SET_DESCRIPTION = 'Слова и ключевые фразы уровня A1 — пополняется автоматически по мере прохождения тренажёра Édito A1.';

const FIELDS_SCHEMA = [
  { id: 'term', name: 'Французский', type: 'text', side: 'front', order: 1, settings: { language: 'fr', ttsEnabled: true } },
  { id: 'definition', name: 'Перевод', type: 'text', side: 'back', order: 1, settings: { language: 'ru' } },
];

// Ключевые фразы из диалогов каждого юнита (в диалогах нет готового перевода реплик,
// поэтому переводы на русский подобраны вручную для самых коммуникативно важных фраз).
const KEY_PHRASES: Record<string, Array<{ fr: string; ru: string }>> = {
  '1': [
    { fr: "Je m'appelle Lucas.", ru: 'Меня зовут Лукас.' },
    { fr: 'Tu es étudiant ?', ru: 'Ты студент?' },
    { fr: 'Enchanté !', ru: 'Очень приятно!' },
  ],
  '2': [
    { fr: "J'ai un frère et une sœur.", ru: 'У меня есть брат и сестра.' },
    { fr: 'Ils ont quel âge ?', ru: 'Сколько им лет?' },
  ],
  '3': [
    { fr: 'Je me lève à sept heures.', ru: 'Я встаю в семь часов.' },
    { fr: 'Je prends le petit-déjeuner.', ru: 'Я завтракаю.' },
  ],
  '4': [
    { fr: 'Je voudrais une salade, s\'il vous plaît.', ru: 'Я хотел бы салат, пожалуйста.' },
    { fr: 'Bon appétit !', ru: 'Приятного аппетита!' },
  ],
  '5': [
    { fr: 'Où est la gare, s\'il vous plaît ?', ru: 'Где вокзал, пожалуйста?' },
    { fr: 'Vous allez tout droit.', ru: 'Идите прямо.' },
    { fr: "C'est loin ?", ru: 'Это далеко?' },
  ],
  '6': [
    { fr: 'Tu es libre ce week-end ?', ru: 'Ты свободен в эти выходные?' },
    { fr: 'Il fait beau.', ru: 'Хорошая погода.' },
  ],
  '7': [
    { fr: 'Je cherche une robe.', ru: 'Я ищу платье.' },
    { fr: "C'est combien ?", ru: 'Сколько это стоит?' },
  ],
  '8': [
    { fr: 'Je suis prêt pour le voyage.', ru: 'Я готов к поездке.' },
    { fr: 'Le vol part à 14h.', ru: 'Рейс вылетает в 14:00.' },
  ],
  '9': [
    { fr: 'Je ne me sens pas bien.', ru: 'Я плохо себя чувствую.' },
    { fr: "J'ai mal à la tête.", ru: 'У меня болит голова.' },
  ],
  '10': [
    { fr: "J'aimerais travailler dans la musique.", ru: 'Я хотел бы работать в музыке.' },
    { fr: 'Mon rêve est de vivre à New York.', ru: 'Моя мечта — жить в Нью-Йорке.' },
  ],
};

interface VocabCard {
  term: string;
  definition: string;
}

function extractUnitCards(unitId: string): VocabCard[] {
  const unit = EDITO_A1_UNITS[unitId];
  if (!unit) return [];

  const cards: VocabCard[] = [];
  const seen = new Set<string>();
  const add = (term: string, definition: string) => {
    const key = term.trim().toLowerCase();
    if (!term.trim() || !definition.trim() || seen.has(key)) return;
    seen.add(key);
    cards.push({ term: term.trim(), definition: definition.trim() });
  };

  for (const ex of unit.exercises) {
    if (ex.type === 'gender-quiz' && ex.items) {
      for (const item of ex.items as GenderItem[]) {
        if ('word' in item && item.word && item.ru) {
          const term = item.article ? `${item.article} ${item.word}` : item.word;
          add(term, item.ru);
        }
      }
    }
  }
  for (const phrase of KEY_PHRASES[unitId] || []) {
    add(phrase.fr, phrase.ru);
  }
  return cards;
}

function getCompletedUnitIds(entries: ProgressEntry[]): string[] {
  const doneByUnit: Record<string, Set<string>> = {};
  for (const e of entries) {
    (doneByUnit[e.unitId] ??= new Set()).add(e.exerciseId);
  }
  return UNIT_ORDER.filter(unitId => {
    const unit = EDITO_A1_UNITS[unitId];
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

// Добавляет в личный набор «Edito A1 — Словарь» карточки тех юнитов, что уже пройдены,
// но ещё отсутствуют в наборе. Идемпотентно — безопасно вызывать многократно.
export async function syncVocabSet(idToken: string): Promise<void> {
  const progress = await getCourseProgress(idToken);
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
