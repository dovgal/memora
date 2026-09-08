// Клиент API тренажёра неправильных глаголов: партия и состояния повторения.
// Токен из next-auth берём так же, как в читалке книг — страницы тренажёра
// тоже клиентские.

import { getSession } from 'next-auth/react';
import type { VerbState } from './types';

let cachedToken: string | null = null;
let cachedAt = 0;

async function authHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (!cachedToken || now - cachedAt > 60_000) {
    try {
      const session = await getSession();
      cachedToken = (session as { id_token?: string } | null)?.id_token ?? null;
      cachedAt = now;
    } catch {
      cachedToken = null;
    }
  }
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cachedToken) h.Authorization = `Bearer ${cachedToken}`;
  return h;
}

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body?.error) message = body.error;
    } catch { /* пустое тело */ }
    throw new Error(message);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  return ok<T>(await fetch(url, { ...init, headers: await authHeaders() }));
}

export interface VerbsStateResponse {
  assignment: { from: number; to: number } | null;
  states: VerbState[];
}

export const getVerbsState = () => call<VerbsStateResponse>('/api/verbs/state');

export const putVerbsAssignment = (from: number, to: number) =>
  call<void>('/api/verbs/assignment', { method: 'PUT', body: JSON.stringify({ from, to }) });

export const postVerbReview = (n: number, correct: boolean) =>
  call<VerbState>('/api/verbs/review', { method: 'POST', body: JSON.stringify({ n, correct }) });
