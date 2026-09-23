// Клиент серверного тренажёра: /api/sets/{id}/trainer/prepare, /api/cards/{id}/mnemonic.
//
// Контракт зафиксирован в lib/contracts/trainer.ts. Эндпоинт может отвечать
// 404/429/500 или вовсе быть недоступен по сети (и ограничен пятью вызовами в
// минуту на человека). Ни один из этих случаев не должен ронять тренажёр: он
// обязан продолжить работу на локально собранных упражнениях. Поэтому каждая
// функция здесь ловит любую ошибку и возвращает null, а не бросает.

import type { PreparedSet } from '@/lib/contracts/trainer';
// Не вошли — запрос уйдёт без токена и, скорее всего, получит 401; это тоже
// штатно обрабатывается вызывающим кодом как «сервер недоступен».
import { trainerHeaders as authHeaders } from './authToken';

/**
 * Сколько ждём ответ сервера. Долго — потому что вызов синхронно генерирует
 * LLM-упражнения для `limit` карточек, а тренажёр его не ждёт: занятие уже
 * идёт на локальных упражнениях, серверные подмешиваются по мере прихода.
 * Прокси перед API рвёт соединение около тридцати секунд — дольше ждать незачем.
 */
const PREPARE_TIMEOUT_MS = 28_000;

/**
 * POST /api/sets/{id}/trainer/prepare — профили карточек и проверенные
 * судьёй упражнения. null означает «эндпоинта нет или он не ответил» —
 * вызывающий код должен молча собрать безопасные упражнения локально.
 */
export async function prepareTrainerSet(
  setId: string,
  opts: { cardIds?: string[]; limit?: number } = {},
): Promise<PreparedSet | null> {
  try {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), PREPARE_TIMEOUT_MS);
    const res = await fetch(`/api/sets/${setId}/trainer/prepare`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(opts),
      signal: abort.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const data = (await res.json()) as PreparedSet;
    if (!Array.isArray(data?.profiles) || !Array.isArray(data?.exercises)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * POST /api/cards/{id}/mnemonic — мнемоника для карточки, которую человек
 * теряет второй раз подряд. null — сервер недоступен или мнемоники нет;
 * вызывающий код в этом случае просто показывает пример карточки без неё.
 */
export async function fetchMnemonic(cardId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/cards/${cardId}/mnemonic`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.mnemonic === 'string' && data.mnemonic.trim() ? data.mnemonic : null;
  } catch {
    return null;
  }
}
