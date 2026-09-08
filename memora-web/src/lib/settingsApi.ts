// Настройки человека на сервере: язык и то, что позже переедет из браузера.

import { getSession } from 'next-auth/react';

async function headers(): Promise<Record<string, string>> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const s = await getSession();
    const token = (s as { id_token?: string } | null)?.id_token;
    if (token) h.Authorization = `Bearer ${token}`;
  } catch { /* не вошли — настройки останутся местными */ }
  return h;
}

export async function getSettings(): Promise<Record<string, string>> {
  const r = await fetch('/api/settings', { headers: await headers() });
  if (!r.ok) return {};
  return r.json();
}

export async function putSetting(key: string, value: string): Promise<void> {
  await fetch('/api/settings', {
    method: 'PUT',
    headers: await headers(),
    body: JSON.stringify({ [key]: value }),
  });
}
