'use client';
// Переключатель режима для электронных чернил.

import { useSyncExternalStore } from 'react';
import { Contrast } from 'lucide-react';
import { einkServerSnapshot, einkSnapshot, setEink, subscribeEink } from '@/lib/ui/eink';

export function EinkToggle() {
  const on = useSyncExternalStore(subscribeEink, einkSnapshot, einkServerSnapshot);

  return (
    <button
      onClick={() => setEink(!on)}
      title={on
        ? 'Режим для электронных чернил включён: без анимаций, размытия и теней. Нажмите, чтобы вернуть обычный вид.'
        : 'Режим для электронных чернил: убирает анимации, размытие и тени — на медленных экранах отклик становится заметно бодрее.'}
      aria-label="Режим для электронных чернил"
      aria-pressed={on}
      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
        on
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-qz-text-muted hover:text-foreground'
      }`}
    >
      <Contrast className="w-4 h-4" />
    </button>
  );
}
