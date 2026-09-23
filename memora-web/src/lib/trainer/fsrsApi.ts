// Клиент интервального повторения (FSRS): состояние карточек набора и отправка оценки.
//
// Раньше «Заучивание» вызывало generateLearnQueue с пустым Set() выученных
// карточек и никогда не читало и не писало таблицу fsrs_records — повторение
// попросту не работало. Здесь читаем состояние перед занятием и отправляем
// рейтинг после каждого ответа, чтобы карточка действительно продвигалась.

import type { CardSchedule, FsrsRating } from './types';
// Без токена запрос получит 401, и занятие пойдёт без сохранения прогресса.
import { trainerHeaders as authHeaders } from './authToken';

interface RawFsrsCard {
  id: string;
  state: number;
  due: string | null;
  reps: number;
  lapses: number;
  stability: number;
}

/**
 * GET /api/sets/{id}/fsrs/state — состояние каждой карточки набора для этого
 * человека. Пустой массив, если сервер не ответил: занятие тогда считает все
 * карточки новыми — это хуже, чем настоящее планирование, но не хуже того,
 * что было (когда планирование не работало вовсе), и не роняет тренажёр.
 */
export async function fetchFsrsState(setId: string): Promise<CardSchedule[]> {
  try {
    const res = await fetch(`/api/sets/${setId}/fsrs/state`, { headers: await authHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    const cards: RawFsrsCard[] = Array.isArray(data?.cards) ? data.cards : [];
    return cards.map(c => ({
      cardId: c.id,
      state: (c.state === 0 || c.state === 1 || c.state === 2 || c.state === 3 ? c.state : 0) as CardSchedule['state'],
      due: c.due ?? null,
      stability: typeof c.stability === 'number' ? c.stability : 0,
      lapses: typeof c.lapses === 'number' ? c.lapses : 0,
      reps: typeof c.reps === 'number' ? c.reps : 0,
    }));
  } catch {
    return [];
  }
}

export interface FsrsReviewResult {
  state: number;
  due: string;
  scheduledDays: number;
  elapsedDays: number;
}

/**
 * POST /api/study/fsrs/review — сохраняет рейтинг ответа и получает новый срок.
 * Возвращает null и не бросает при отсутствии сессии/сети: занятие продолжается,
 * просто прогресс в этот раз не долетит до сервера (как и раньше у неавторизованных),
 * а итоговая сводка занятия не будет знать, сколько карточек «на завтра».
 */
export async function submitFsrsReview(flashcardId: string, rating: FsrsRating): Promise<FsrsReviewResult | null> {
  try {
    const res = await fetch('/api/study/fsrs/review', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ flashcardId, rating }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
