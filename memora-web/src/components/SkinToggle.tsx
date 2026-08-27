'use client';
// Выбор оформления приложения.

import { useSyncExternalStore } from 'react';
import { Blocks } from 'lucide-react';
import { setSkin, skinServerSnapshot, skinSnapshot, subscribeSkin } from '@/lib/ui/skin';

export function SkinToggle() {
  const skin = useSyncExternalStore(subscribeSkin, skinSnapshot, skinServerSnapshot);
  const pixel = skin === 'pixel';

  return (
    <button
      onClick={() => setSkin(pixel ? 'default' : 'pixel')}
      title={pixel
        ? 'Блочное оформление включено. Нажмите, чтобы вернуть обычное.'
        : 'Блочное оформление: рубленые углы и землистые цвета, в духе кубических игр.'}
      aria-label="Оформление приложения"
      aria-pressed={pixel}
      className={`w-9 h-9 rounded-full border flex items-center justify-center transition-colors ${
        pixel ? 'border-foreground bg-foreground text-background' : 'border-border text-qz-text-muted hover:text-foreground'
      }`}
    >
      <Blocks className="w-4 h-4" />
    </button>
  );
}
