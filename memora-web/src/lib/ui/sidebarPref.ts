// Состояние бокового меню: развёрнуто или свёрнуто в полоску.
//
// Две настройки, а не одна: на обычных страницах меню нужно, а внутри курса
// или читалки только отнимает ширину — особенно на планшете в альбомной
// ориентации. Поэтому «свёрнутость» помнится отдельно для каждого случая, и
// выбор в одном не навязывается другому.

export type SidebarMode = 'normal' | 'immersive';

export interface SidebarPrefs {
  normal: boolean;
  immersive: boolean;
}

const KEY = 'memora.sidebar';
const DEFAULTS: SidebarPrefs = { normal: false, immersive: true };

/**
 * Кэш обязателен: useSyncExternalStore сравнивает снимки по ссылке, и чтение
 * localStorage на каждый вызов давало бы новый объект — бесконечная перерисовка.
 */
let cache: SidebarPrefs | null = null;
const listeners = new Set<() => void>();

function read(): SidebarPrefs {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SidebarPrefs>) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

export function subscribeSidebar(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function sidebarSnapshot(): SidebarPrefs {
  return read();
}

/** На сервере localStorage нет — отдаём значения по умолчанию. */
export function sidebarServerSnapshot(): SidebarPrefs {
  return DEFAULTS;
}

export function setSidebarCollapsed(mode: SidebarMode, collapsed: boolean): void {
  cache = { ...read(), [mode]: collapsed };
  try { window.localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* приватный режим */ }
  listeners.forEach(fn => fn());
}

/**
 * Страницы, где меню мешает: конкретная книга в читалке, страница курса,
 * встроенные тренажёры. Списки курсов и полка книг сюда НЕ входят — там
 * навигация как раз нужна.
 */
const IMMERSIVE = [
  /^\/books\/[^/]+/,
  /^\/courses\/[^/]+/,
  /^\/dashboard\/[^/]+\/courses\//,
  /^\/coding\/[^/]+/,
  /^\/cube(\/|$)/,
  /^\/vision(\/|$)/,
];

export function isImmersive(pathname: string): boolean {
  return IMMERSIVE.some(re => re.test(pathname));
}
