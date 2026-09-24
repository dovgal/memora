// «Разговор дня»: договор с сервером (memora-api/src/handlers/challenge.rs).
//
// Разговор на сегодня выбирает сервер — детерминированно по человеку и
// парижской дате, так что на телефоне и на ноутбуке он один и тот же.
// Засчитывает тоже сервер: проверяет, что разговор сегодняшний и что человек
// действительно говорил, и сам начисляет XP через игровой слой. Ответ несёт
// обычный GameUpdate — его отдают в celebrate(), как в любом тренажёре.

import { authHeaders, type GameUpdate } from '@/lib/game/client';

export type ChallengeTrack = 'work' | 'general';

export interface DailyChallenge {
  id: string;
  kind: ChallengeTrack;
  level: string;
  title: string;
  /** Кого играет собеседник. */
  role: string;
  situation: string;
  goals: string[];
  /** Французские фразы на случай ступора; №i помогает с задачей №i. */
  hints: string[];
}

export interface TodayChallenge {
  challenge: DailyChallenge;
  done: boolean;
  /** Сколько дней подряд был разговор дня (своя серия, не общая). */
  streakDays: number;
  track: ChallengeTrack;
  /** Парижская дата, к которой относится разговор, «2026-09-24». */
  date: string;
  minTurns: number;
  minMinutes: number;
}

export interface CompleteResult {
  /** Засчитано раньше (второе устройство, двойной тап) — XP повторно нет. */
  alreadyDone: boolean;
  update: GameUpdate | null;
  streakDays: number;
}

/** Разговор на сегодня. null — нет сессии или сервер недоступен. */
export async function getTodayChallenge(track?: ChallengeTrack): Promise<TodayChallenge | null> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return null;
    const qs = track ? `?track=${track}` : '';
    const res = await fetch(`/api/challenge/today${qs}`, { headers, cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as TodayChallenge;
  } catch {
    return null;
  }
}

/**
 * Засчитать разговор. В отличие от reportStudyEvent ошибку не глотаем:
 * здесь человек сам нажал «Завершить» и должен увидеть, почему не вышло
 * (например, «поговорите ещё немного» или «обновите страницу» после полуночи).
 */
export async function completeChallenge(
  body: { challengeId: string; turns: number; minutes: number },
): Promise<{ ok: true; result: CompleteResult } | { ok: false; error: string }> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return { ok: false, error: 'Сессия истекла — войдите снова' };
    const res = await fetch('/api/challenge/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error || 'Не получилось засчитать разговор' };
    }
    return { ok: true, result: (await res.json()) as CompleteResult };
  } catch {
    return { ok: false, error: 'Нет связи с сервером' };
  }
}
