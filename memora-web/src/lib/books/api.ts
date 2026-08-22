// Клиент API читалки: полка, главы, словарь читателя, перевод, карточки.
// Токен берём из next-auth так же, как озвучка: страницы читалки клиентские.

import { getSession } from 'next-auth/react';

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

// ---------- Типы ----------

export interface Book {
  id: string;
  title: string;
  author: string;
  /** Рубрика полки: «Классика», «История», «Наука»… */
  topic: string;
  /** Загрузил ли книгу тот, кто её смотрит: править и удалять может только он. */
  isOwner: boolean;
  language: string;
  targetLanguage: string;
  sourceFormat: string;
  chapterCount: number;
  wordCount: number;
  setId: string | null;
  lastChapter: number;
  lastOffset: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterSummary { position: number; title: string; wordCount: number }
export interface BookDetail { book: Book; chapters: ChapterSummary[] }
export interface ChapterContent { position: number; title: string; content: string; wordCount: number }

/** 0 — новое, 1 — учу, 2 — узнаю, 3 — знаю, 4 — игнорировать. */
export type VocabStatus = 0 | 1 | 2 | 3 | 4;
export interface VocabEntry { word: string; status: VocabStatus; translation: string }

export interface DictionaryMeaning { gloss: string; example?: string }
export interface DictionaryEntry {
  lemma: string;
  pos: string;
  inContext: string;
  meanings: DictionaryMeaning[];
  note?: string;
}

// ---------- Книги ----------

export const listBooks = () => call<Book[]>('/api/books');
export const getBook = (id: string) => call<BookDetail>(`/api/books/${id}`);
export const getChapter = (id: string, position: number) =>
  call<ChapterContent>(`/api/books/${id}/chapters/${position}`);

export const createBook = (payload: {
  title: string; author?: string; topic?: string; language?: string;
  targetLanguage?: string; sourceFormat?: string;
}) => call<{ id: string }>('/api/books', { method: 'POST', body: JSON.stringify(payload) });

export const addChapters = (id: string, chapters: { position: number; title: string; content: string }[]) =>
  call<{ saved: number }>(`/api/books/${id}/chapters`, { method: 'POST', body: JSON.stringify({ chapters }) });

export const finalizeBook = (id: string) =>
  call<Book>(`/api/books/${id}/finalize`, { method: 'POST', body: '{}' });

export const updateBook = (id: string, patch: Partial<{
  title: string; author: string; topic: string; language: string;
  targetLanguage: string; lastChapter: number; lastOffset: number;
}>) => call<Book>(`/api/books/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });

export const deleteBook = (id: string) =>
  call<void>(`/api/books/${id}`, { method: 'DELETE' });

export interface SearchHit { position: number; title: string; headline: string }

/** Поиск по книге: где встречается слово или фраза. */
export const searchBook = (id: string, q: string) =>
  call<{ hits: SearchHit[] }>(`/api/books/${id}/search?q=${encodeURIComponent(q)}`);

// ---------- Словарь ----------

export const getVocab = (id: string) =>
  call<{ language: string; words: VocabEntry[] }>(`/api/books/${id}/vocab`);

export const putVocab = (id: string, words: { word: string; status: VocabStatus; translation?: string }[]) =>
  call<{ saved: number }>(`/api/books/${id}/vocab`, { method: 'PUT', body: JSON.stringify({ words }) });

// ---------- Карточки ----------

export const addCard = (id: string, card: { term: string; definition: string; example?: string }) =>
  call<{ setId: string; cardId: string; cardCount: number }>(
    `/api/books/${id}/cards`, { method: 'POST', body: JSON.stringify(card) },
  );

// ---------- Перевод ----------

export interface TranslateResult { translations: string[]; sourceLang: string; provider: string }

export const translate = (payload: {
  texts: string[]; targetLang: string; sourceLang?: string; context?: string;
}) => call<TranslateResult>('/api/translate', { method: 'POST', body: JSON.stringify(payload) });

export const dictionary = (payload: {
  word: string; sentence?: string; sourceLang: string; targetLang: string;
}) => call<DictionaryEntry>('/api/dictionary', { method: 'POST', body: JSON.stringify(payload) });
