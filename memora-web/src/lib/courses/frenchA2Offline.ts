// Точечный офлайн-режим для курса A2 (без глобального service worker).
// Контент курса (карточки/диктанты/банк) уже в JS-бандле — доступен офлайн после загрузки.
// Здесь кэшируем саму страницу и её ассеты через Cache Storage API, чтобы курс
// открывался в дороге без сети. Безопасно: не трогает прод-кэширование сайта.

const CACHE_NAME = "memora-a2-offline-v1";
const ROUTES = ["/dashboard/student/courses/french-a2"];

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

/** Скачать страницу курса и связанные ассеты в офлайн-кэш. */
export async function downloadForOffline(): Promise<{ ok: boolean; cached: number }> {
  if (!offlineSupported()) return { ok: false, cached: 0 };
  try {
    const cache = await caches.open(CACHE_NAME);
    // 1) сами маршруты курса
    await cache.addAll(ROUTES);
    // 2) ассеты, уже подгруженные текущей вкладкой (js/css/шрифты Next.js)
    let cached = ROUTES.length;
    const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const assets = entries
      .map((e) => e.name)
      .filter((u) => /\/_next\/static\/.*\.(js|css|woff2?)$/.test(u));
    for (const url of assets) {
      try { await cache.add(url); cached++; } catch { /* пропускаем недоступные */ }
    }
    return { ok: true, cached };
  } catch {
    return { ok: false, cached: 0 };
  }
}

export async function isOfflineReady(): Promise<boolean> {
  if (!offlineSupported()) return false;
  try {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(ROUTES[0]);
    return !!hit;
  } catch { return false; }
}

export async function clearOffline(): Promise<void> {
  if (!offlineSupported()) return;
  try { await caches.delete(CACHE_NAME); } catch { /* ignore */ }
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
