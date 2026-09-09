// Глаголы как карточки общего сервиса.
//
// Своё расписание повторений (лесенка ступеней) здесь больше не нужно: в
// Memora уже есть настоящий алгоритм со стабильностью, трудностью и журналом
// ответов, и он вдумчивее любой лесенки. Заодно набор становится обычным
// набором — с ним начинают работать все девять режимов занятий, а не только
// наш тренажёр.
//
// Карточка глагола несёт больше двух полей, поэтому пользуемся настраиваемой
// схемой набора: спереди значок из школьной таблицы и инфинитив, сзади — три
// оставшихся столбца.

import { getSettings, putSetting } from '@/lib/settingsApi';
import type { FieldSchema, FlashcardResponse, SetResponse } from '@/types/schema';
import { VERBS } from './list';
import { LADDER_DAYS, type VerbState } from './types';

export const VERB_SET_TITLE = 'Неправильные глаголы · таблица 3ème';
const SETTING_KEY = 'verbsSetId';

/** Ключ настройки хранит опознаватель набора: у каждого он свой. */
export const verbIconSrc = (n: number) => `/verbs/${String(n).padStart(3, '0')}.webp`;

export function verbFieldsSchema(): FieldSchema[] {
  return [
    { id: 'icon', name: 'ЗНАЧОК', type: 'image', side: 'front', order: 1, settings: {} },
    { id: 'term', name: 'INFINITIF', type: 'text', side: 'front', order: 2, settings: { language: 'en' } },
    { id: 'pret', name: 'PRÉTÉRIT', type: 'text', side: 'back', order: 1, settings: { language: 'en' } },
    { id: 'definition', name: 'PARTICIPE PASSÉ', type: 'text', side: 'back', order: 2, settings: { language: 'en' } },
    { id: 'fr', name: 'TRADUCTION', type: 'text', side: 'back', order: 3, settings: { language: 'fr' } },
  ];
}

/** Номер глагола хранится в карточке: по нему задаются партии «с 1 по 20». */
export function verbNumberOf(card: FlashcardResponse): number {
  const raw = card.fieldsData?.n;
  return typeof raw === 'string' ? Number(raw) : 0;
}

async function headers(): Promise<Record<string, string>> {
  const { getSession } = await import('next-auth/react');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const s = await getSession();
    const token = (s as { id_token?: string } | null)?.id_token;
    if (token) h.Authorization = `Bearer ${token}`;
  } catch { /* не вошли */ }
  return h;
}

/**
 * Возвращает набор глаголов, создавая его при первом обращении.
 *
 * Опознаватель храним в настройках человека, а не ищем набор по названию:
 * название можно переименовать, а перепутать чужой набор со своим — беда,
 * которую потом не распутать.
 */
export async function ensureVerbSet(): Promise<SetResponse> {
  const settings = await getSettings();
  const known = settings[SETTING_KEY];

  if (known) {
    const r = await fetch(`/api/sets/${known}`, { headers: await headers() });
    if (r.ok) return r.json();
    // Набор удалили — заведём заново, прогресс по нему всё равно потерян.
  }

  const r = await fetch('/api/sets', {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      title: VERB_SET_TITLE,
      description: '125 неправильных глаголов из школьной таблицы: формы, перевод и значки.',
      isPublic: false,
      fieldsSchema: verbFieldsSchema(),
      flashcards: VERBS.map(v => ({
        term: v.inf,
        definition: v.pp,
        fieldsData: {
          n: String(v.n),
          pret: v.pret,
          fr: v.fr,
          icon: verbIconSrc(v.n),
        },
      })),
    }),
  });
  if (!r.ok) throw new Error('Не удалось завести набор карточек');
  const created: SetResponse = await r.json();
  await putSetting(SETTING_KEY, created.id);
  return created;
}

export interface CardState {
  id: string;
  /** 0 — новая, 1 — учится, 2 — на повторении, 3 — переучивается. */
  state: number;
  /** Когда спросить снова; пусто у новой. */
  due: string | null;
  reps: number;
  lapses: number;
  stability: number;
}

export async function fetchCardStates(setId: string): Promise<CardState[]> {
  const r = await fetch(`/api/sets/${setId}/fsrs/state`, { headers: await headers() });
  if (!r.ok) return [];
  const data = await r.json() as { cards?: CardState[] };
  return data.cards ?? [];
}

/**
 * Ответ по карточке.
 *
 * Из четырёх оценок алгоритма берём две крайние: «снова» и «хорошо». Просить
 * подростка оценивать, насколько ему было трудно, — лишний вопрос поверх
 * задания; он и так только что показал это ответом.
 */
export async function reviewVerbCard(flashcardId: string, correct: boolean): Promise<void> {
  await fetch('/api/study/fsrs/review', {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ flashcard_id: flashcardId, rating: correct ? 3 : 1 }),
  });
}

/**
 * Состояние карточек — в тот вид, что понимает сбор занятия.
 *
 * Переходник, а не переписывание: правило отбора (слабые вперёд, новых не
 * больше горстки, прочные не мешаются) от смены расписания не меняется, и
 * шестнадцать проверок на него остаются в силе.
 *
 * Новой считается карточка без единого ответа: записи о ней просто нет, и
 * тогда сбор занятия видит её как «ещё не спрашивали».
 */
export function toVerbStates(cards: FlashcardResponse[], states: CardState[]): VerbState[] {
  const nById = new Map(cards.map(c => [c.id, verbNumberOf(c)]));
  const out: VerbState[] = [];

  for (const s of states) {
    const n = nById.get(s.id);
    if (!n) continue;
    if (s.reps === 0) continue;   // ещё не спрашивали — это «новая»

    out.push({
      n,
      // Ступень выводим из устойчивости: она и есть мера прочности у
      // настоящего алгоритма, а карте прогресса нужны те же четыре цвета.
      step: strengthStep(s.stability),
      due: (s.due ?? new Date().toISOString()).slice(0, 10),
      streak: s.reps,
      misses: s.lapses,
    });
  }
  return out;
}

/** Устойчивость в днях → ступень 0…6 по той же шкале, что была у лесенки. */
export function strengthStep(stability: number): number {
  let step = 0;
  for (let i = 0; i < LADDER_DAYS.length; i++) {
    if (stability >= LADDER_DAYS[i]) step = i;
  }
  return step;
}
