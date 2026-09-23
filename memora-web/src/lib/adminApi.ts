// Клиент API кабинета администратора: сводка по наборам семьи и полный сброс.

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) h['Authorization'] = `Bearer ${idToken}`;
  return h;
}

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try { const b = await r.json(); if (b?.error) message = b.error; } catch { /* no body */ }
    throw new Error(message);
  }
  return r.json();
}

export interface AdminMe {
  isAdmin: boolean;
}

export const getAdminMe = (idToken?: string) =>
  call<AdminMe>('/api/admin/me', idToken);

export interface OwnerSummary {
  userId: string;
  name: string;
  setsCount: number;
  cardsCount: number;
  setTitles: string[];
}

export interface SetsSummary {
  owners: OwnerSummary[];
  totalSets: number;
  totalCards: number;
}

export const getSetsSummary = (idToken?: string) =>
  call<SetsSummary>('/api/admin/sets/summary', idToken);

export interface DeleteAllSetsResult {
  setsDeleted: number;
  cardsDeleted: number;
}

/** Фраза подтверждения — сверяется побайтово и на сервере, и здесь (для disabled кнопки). */
export const DELETE_ALL_CONFIRM_PHRASE = 'УДАЛИТЬ ВСЕ КАРТОЧКИ';

export async function deleteAllSets(confirm: string, idToken?: string): Promise<DeleteAllSetsResult> {
  const r = await fetch('/api/admin/sets', {
    method: 'DELETE',
    headers: headers(idToken),
    body: JSON.stringify({ confirm }),
  });
  return ok<DeleteAllSetsResult>(r);
}

async function call<T>(path: string, idToken?: string): Promise<T> {
  const r = await fetch(path, { headers: headers(idToken) });
  return ok<T>(r);
}
