// Клиент API читалки: полка, главы, словарь читателя, перевод, карточки.
// Токен берём из next-auth так же, как озвучка: страницы читалки клиентские.

import { getSession } from 'next-auth/react';
import type { Block } from './draft';

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
  /** Уровень адаптации при чтении: пусто — оригинал. */
  level: string;
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
export interface ChapterContent {
  position: number;
  title: string;
  content: string;
  wordCount: number;
  /** Заголовки, списки и картинки. Пусто — глава показывается сплошным текстом. */
  blocks?: Block[];
}

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

/**
 * Кладёт картинку книги и возвращает её постоянный адрес.
 *
 * Отправляем сами байты, без обёртки в текст: в текстовом виде картинка
 * толстеет на треть. Сначала пробуем API напрямую — тем же путём, что и разбор
 * PDF: на многомегабайтных телах прокси уже подводил.
 */
export async function uploadBookImage(bookId: string, file: Blob): Promise<string> {
  const headers = await authHeaders();
  delete headers['Content-Type'];
  const path = `/api/books/${bookId}/images?mime=${encodeURIComponent(file.type || 'image/jpeg')}`;

  const direct = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (direct) {
    try {
      const r = await fetch(`${direct}${path}`, { method: 'POST', headers, body: file });
      if (r.ok) return (await r.json()).url as string;
    } catch { /* уходим на прокси */ }
  }
  const r = await fetch(path, { method: 'POST', headers, body: file });
  return (await ok<{ url: string }>(r)).url;
}

/** Ответ на просьбу забрать картинки: у неудачных вместо адреса причина. */
export interface FetchedImage { src: string; url?: string; error?: string }

/** Просит сервер забрать картинки страницы к себе и вернуть их новые адреса. */
export const fetchBookImages = (bookId: string, urls: string[]) =>
  call<{ images: FetchedImage[] }>(`/api/books/${bookId}/images/fetch`, {
    method: 'POST', body: JSON.stringify({ urls }),
  });

export const listBooks = () => call<Book[]>('/api/books');
export const getBook = (id: string) => call<BookDetail>(`/api/books/${id}`);
export const getChapter = (id: string, position: number) =>
  call<ChapterContent>(`/api/books/${id}/chapters/${position}`);

export const createBook = (payload: {
  title: string; author?: string; topic?: string; language?: string;
  targetLanguage?: string; sourceFormat?: string;
}) => call<{ id: string }>('/api/books', { method: 'POST', body: JSON.stringify(payload) });

export const addChapters = (id: string, chapters: { position: number; title: string; content: string; blocks?: Block[] }[]) =>
  call<{ saved: number }>(`/api/books/${id}/chapters`, { method: 'POST', body: JSON.stringify({ chapters }) });

export const finalizeBook = (id: string) =>
  call<Book>(`/api/books/${id}/finalize`, { method: 'POST', body: '{}' });

export const updateBook = (id: string, patch: Partial<{
  title: string; author: string; topic: string; language: string;
  targetLanguage: string; level: string; lastChapter: number; lastOffset: number;
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

// ---------- Адаптация под уровень ----------

/** Уровни владения языком, под которые умеем переписывать текст. */
export const READING_LEVELS = ['A1.1', 'A1.2', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export interface AdaptResult {
  level: string;
  ready: number;
  total: number;
  done: boolean;
  content: string;
}

/**
 * Глава на выбранном уровне. За один заход сервер переписывает несколько
 * кусков, поэтому зовём повторно, пока не придёт done — иначе длинная глава
 * не уложится в таймаут прокси.
 */
export const adaptChapter = (id: string, position: number, level: string) =>
  call<AdaptResult>(`/api/books/${id}/chapters/${position}/adapt`, {
    method: 'POST',
    body: JSON.stringify({ level }),
  });

// ---------- Разбор PDF на сервере ----------

/**
 * Текстовый слой PDF, вытащенный на сервере.
 *
 * Запасной путь для мобильных: на iOS браузерный pdf.js падает внутри себя, и
 * один и тот же файл на компьютере разбирается, а на телефоне нет.
 */
export async function pdfTextOnServer(file: File): Promise<string[]> {
  const h = await authHeaders();
  const headers = { ...h, 'Content-Type': 'application/octet-stream' };

  // Сначала напрямую в API, затем через прокси Next.
  //
  // Прямой путь короче на один узел, и многомегабайтная книга по нему
  // проходит — проверено. Прокси остаётся запасным: он работает всегда, но
  // именно на нём загрузка с телефона отвечала пятисоткой, причём запрос до
  // сервиса разбора не доходил.
  const direct = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  const targets = [...(direct ? [`${direct}/api/pdf/text`] : []), '/api/pdf/text'];

  let reason = 'сервер не ответил';
  for (const url of targets) {
    try {
      const res = await fetch(url, { method: 'POST', headers, body: file });
      if (res.ok) {
        const data = await res.json() as { pages?: unknown };
        return Array.isArray(data.pages)
          ? data.pages.filter((p): p is string => typeof p === 'string')
          : [];
      }
      // Тело ответа несём в сообщение: голый код состояния ничего не объясняет,
      // а ошибка от прокси и ошибка от API выглядят по-разному.
      const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 140);
      reason = `HTTP ${res.status}${body ? ` — ${body}` : ''}`;
    } catch (e) {
      reason = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(`разбор на сервере не удался · ${reason}`);
}

// ---------- Перевод ----------

export interface TranslateResult { translations: string[]; sourceLang: string; provider: string }

export const translate = (payload: {
  texts: string[]; targetLang: string; sourceLang?: string; context?: string;
}) => call<TranslateResult>('/api/translate', { method: 'POST', body: JSON.stringify(payload) });

export const dictionary = (payload: {
  word: string; sentence?: string; sourceLang: string; targetLang: string;
}) => call<DictionaryEntry>('/api/dictionary', { method: 'POST', body: JSON.stringify(payload) });
