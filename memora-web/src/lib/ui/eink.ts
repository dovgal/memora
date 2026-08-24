// Режим для экранов на электронных чернилах.
//
// Выбор человека важнее автоматики: признак `update: slow` поддерживают не все
// браузеры, и на части устройств он молчит. Поэтому сохранённое решение всегда
// перевешивает, а определение работает лишь когда решения ещё нет.

const KEY = 'memora.eink';

/** Кэш примитива: useSyncExternalStore требует стабильного снимка. */
let cache: boolean | null = null;
const listeners = new Set<() => void>();

function detect(): boolean {
  try {
    const pref = window.localStorage.getItem(KEY);
    if (pref === 'on') return true;
    if (pref === 'off') return false;
    return !!window.matchMedia?.('(update: slow)').matches;
  } catch {
    return false;
  }
}

export function subscribeEink(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function einkSnapshot(): boolean {
  if (cache === null) cache = detect();
  return cache;
}

/** На сервере экран неизвестен — считаем обычным. */
export function einkServerSnapshot(): boolean {
  return false;
}

export function setEink(on: boolean): void {
  cache = on;
  try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* приватный режим */ }
  document.documentElement.setAttribute('data-eink', on ? 'on' : 'off');
  listeners.forEach(fn => fn());
}
