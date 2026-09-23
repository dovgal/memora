// Канал к лисёнку: любой уголок сервиса сообщает о событии одной строкой,
// не зная, где и как лисёнок нарисован. Идёт через событие окна, поэтому
// работает между независимыми частями страницы без общего контекста React.

import type { FoxEvent } from './brain';

const EVENT = 'memora-fox';
const PREF_KEY = 'memora.fox';

export function emitFox(e: FoxEvent): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<FoxEvent>(EVENT, { detail: e }));
}

export function onFox(handler: (e: FoxEvent) => void): () => void {
  const listener = (ev: Event) => handler((ev as CustomEvent<FoxEvent>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/** Включён ли лисёнок. По умолчанию — да; выключают в кабинете. */
export function foxEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setFoxEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    // Спрятанный двойным щелчком лисёнок возвращается, если его включили явно.
    if (on) sessionStorage.removeItem('memora.fox.dismissed');
  } catch { /* приватный режим — просто не запомним */ }
  window.dispatchEvent(new Event('memora-fox-pref'));
}
