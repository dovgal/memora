// Токен для API тренажёра — один на всех и на минуту.
//
// getSession() каждый раз ходит на /api/auth/session: на одном ответе
// тренажёр делает до пяти запросов (FSRS, игра, прогрев озвучки…), и без
// кэша каждый из них ждал бы лишний круг до сервера. Минуты хватает с
// запасом: токен живёт тридцать дней, а занятие — десять минут.

import { getSession } from 'next-auth/react';

const TTL_MS = 60_000;
let cached: string | null = null;
let cachedAt = 0;
let inflight: Promise<string | null> | null = null;

export async function trainerToken(): Promise<string | null> {
  if (cachedAt && Date.now() - cachedAt < TTL_MS) return cached;
  if (!inflight) {
    inflight = getSession()
      .then(s => (s as { id_token?: string } | null)?.id_token ?? null)
      .catch(() => null)
      .then(token => {
        cached = token;
        cachedAt = Date.now();
        inflight = null;
        return token;
      });
  }
  return inflight;
}

/** Заголовки запроса к API: JSON и, если человек вошёл, Bearer-токен. */
export async function trainerHeaders(json = true): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  const token = await trainerToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}
