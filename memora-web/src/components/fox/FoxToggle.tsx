'use client';
// Переключатель лисёнка в кабинете. Двойной щелчок по самому лисёнку прячет
// его только до конца сеанса; здесь — насовсем или обратно.

import { useSyncExternalStore } from 'react';
import { foxEnabled, setFoxEnabled } from '@/lib/fox/bus';

function subscribe(cb: () => void) {
  window.addEventListener('memora-fox-pref', cb);
  return () => window.removeEventListener('memora-fox-pref', cb);
}

export default function FoxToggle() {
  // Настройка живёт в localStorage; подписка держит кнопку в согласии с лисёнком,
  // а на сервере считаем его включённым — как и по умолчанию.
  const on = useSyncExternalStore(subscribe, foxEnabled, () => true);
  const toggle = () => setFoxEnabled(!on);

  return (
    <button
      onClick={toggle}
      className="bg-qz-card border border-qz-border-light rounded-xl px-4 py-3 flex items-center gap-3 max-w-md w-full text-left hover:border-[#4255ff]/50 transition-colors"
    >
      <span className="text-2xl" aria-hidden="true">🦊</span>
      <span className="flex-1 min-w-0">
        <span className="block text-foreground text-sm font-semibold">Лисёнок-помощник</span>
        <span className="block text-qz-text-muted text-xs">
          {on ? 'Гуляет по страницам, радуется ответам и подсказывает' : 'Выключен — нажмите, чтобы вернуть'}
        </span>
      </span>
      <span className={`w-11 h-6 rounded-full relative flex-shrink-0 transition-colors ${on ? 'bg-[#4255ff]' : 'bg-zinc-500'}`}>
        <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${on ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
      </span>
    </button>
  );
}
