'use client';
// Тумблер звука праздников. Одно хранилище (lib/game/sound.ts) на все
// экземпляры — выключил на карточке, и на странице достижений тоже выключено.

import { useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isGameSoundMuted, setGameSoundMuted, subscribeGameSoundMuted } from '@/lib/game/sound';

export function SoundToggle({ className = '', withLabel = false }: { className?: string; withLabel?: boolean }) {
  // На сервере localStorage нет — рендерим «звук включён», клиент поправит.
  const muted = useSyncExternalStore(subscribeGameSoundMuted, isGameSoundMuted, () => false);
  const label = muted ? 'Включить звук праздников' : 'Выключить звук праздников';
  return (
    <button
      type="button"
      onClick={() => setGameSoundMuted(!muted)}
      title={label}
      aria-label={label}
      aria-pressed={muted}
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      {withLabel && <span className="text-xs font-medium">{muted ? 'Звук выключен' : 'Звук включён'}</span>}
    </button>
  );
}
