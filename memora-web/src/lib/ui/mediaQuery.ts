'use client';
// Медиа-запрос как значение для React.
//
// Разметка знает про ширину и ориентацию из CSS, а расчёты — нет. Там, где от
// раскладки зависит поведение (а не только вид), спрашиваем браузер напрямую.

import { useCallback, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const mq = window.matchMedia?.(query);
    if (!mq) return () => {};
    mq.addEventListener('change', notify);
    return () => mq.removeEventListener('change', notify);
  }, [query]);

  const snapshot = useCallback(() => !!window.matchMedia?.(query).matches, [query]);

  // На сервере экрана нет — считаем, что запрос не выполнен: разметка после
  // подключения поправится сама.
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
