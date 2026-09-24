// Сеть для рассказа о себе: распознавание кусков записи и разбор рассказа.

import { getSession } from 'next-auth/react';
import { parseReviewBody, type ChunkTranscript, type MonologueReview, type TimedWord } from './monologue';

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const session = await getSession();
    const token = (session as { id_token?: string } | null)?.id_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * 'off' — сервис распознавания явно не настроен (503): дальше не ждём его
 * на каждом куске, а сразу полагаемся на браузер. Временный сбой так не метим.
 */
let serverStt: 'unknown' | 'ok' | 'off' = 'unknown';

export const serverSttOff = () => serverStt === 'off';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Распознать один кусок записи на своём сервисе. null — не вышло: сервис не
 * настроен, не ответил или ответил ошибкой. Куски короткие (до ~25 секунд),
 * поэтому укладываются в тридцатисекундный предел прокси.
 */
export async function transcribeChunk(
  blob: Blob, speechLang: string, index: number, offset: number,
): Promise<ChunkTranscript | null> {
  if (serverStt === 'off') return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 25_000);
  try {
    const res = await fetch(`/api/audio/transcribe?language=${encodeURIComponent(speechLang.slice(0, 2))}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', ...(await authHeaders()) },
      body: blob,
      signal: abort.signal,
    });
    if (res.status === 503) { serverStt = 'off'; return null; }
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    serverStt = 'ok';
    const words: TimedWord[] = Array.isArray(data.words)
      ? (data.words as Record<string, unknown>[])
          .filter(w => w && typeof w.word === 'string' && typeof w.start === 'number' && typeof w.end === 'number')
          .map(w => ({ word: String(w.word), start: num(w.start), end: num(w.end), probability: num(w.probability) }))
      : [];
    return {
      index, offset, words,
      text: typeof data.text === 'string' ? data.text.trim() : '',
      noSpeechProb: num(data.noSpeechProb),
      avgLogprob: num(data.avgLogprob),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface MonologueReviewPayload {
  question: string;
  goals: string[];
  modelAnswer?: string;
  transcript: string;
  durationSeconds: number;
  level: string;
  /** Слова с метками времени — по ним сервер считает паузы. */
  words: { word: string; start: number; end: number }[];
  mode: 'speech' | 'typed';
}

/**
 * Разбор рассказа. Сервер может держать соединение пробелами, пока думает
 * модель, поэтому тело читаем текстом и разбираем сами.
 */
export async function reviewMonologue(payload: MonologueReviewPayload): Promise<MonologueReview> {
  const res = await fetch('/api/ai/course/review-monologue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  const parsed = parseReviewBody(res.status, await res.text());
  if ('error' in parsed) throw new Error(parsed.error);
  return parsed.review;
}
