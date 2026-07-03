// Клиент API источников («учебники»): загрузка порезанного на главы текста,
// список, полный текст главы, полнотекстовый поиск. Используется страницей
// /sources и редактором юнитов (грунтованная ИИ-генерация).

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) h['Authorization'] = `Bearer ${idToken}`;
  return h;
}

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body?.error) message = body.error;
    } catch { /* нет тела */ }
    throw new Error(message);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

export interface SourceDocument {
  id: string;
  title: string;
  language: string;
  chunkCount: number;
  createdAt: string;
}

export interface SourceChunkSummary {
  id: string;
  position: number;
  title: string;
  chars: number;
}

export interface SourceDetail {
  document: SourceDocument;
  chunks: SourceChunkSummary[];
}

export interface SourceSearchHit {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  chunkTitle: string;
  position: number;
  /** Фрагменты с подсветкой <b>…</b>. */
  headline: string;
}

export interface UploadChunk { title?: string; content: string }

export async function uploadSource(
  payload: { title: string; language?: string; chunks: UploadChunk[] },
  idToken?: string,
): Promise<{ id: string }> {
  return ok(await fetch('/api/sources', {
    method: 'POST', headers: headers(idToken), body: JSON.stringify(payload),
  }));
}

export async function listSources(idToken?: string): Promise<SourceDocument[]> {
  return ok(await fetch('/api/sources', { headers: headers(idToken) }));
}

export async function getSource(id: string, idToken?: string): Promise<SourceDetail> {
  return ok(await fetch(`/api/sources/${id}`, { headers: headers(idToken) }));
}

export async function getChunkContent(
  documentId: string, chunkId: string, idToken?: string,
): Promise<{ title: string; content: string }> {
  return ok(await fetch(`/api/sources/${documentId}/chunks/${chunkId}`, { headers: headers(idToken) }));
}

export async function deleteSource(id: string, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/sources/${id}`, { method: 'DELETE', headers: headers(idToken) }));
}

export async function searchSources(q: string, idToken?: string): Promise<SourceSearchHit[]> {
  return ok(await fetch(`/api/sources/search?q=${encodeURIComponent(q)}`, { headers: headers(idToken) }));
}
