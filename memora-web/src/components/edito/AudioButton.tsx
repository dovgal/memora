'use client';
import { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { speakInworld } from '@/lib/courses/ttsInworld';

interface AudioButtonProps {
  text: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function AudioButton({ text, size = 'sm', className = '' }: AudioButtonProps) {
  const [playing, setPlaying] = useState(false);

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playing || !text.trim()) return;
    setPlaying(true);
    try {
      await speakInworld(text.trim());
    } finally {
      setPlaying(false);
    }
  };

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnSize = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <button
      onClick={handlePlay}
      disabled={playing}
      title={`Произнести: ${text}`}
      className={`${btnSize} rounded-lg text-qz-text-muted hover:text-[#4255ff] hover:bg-[#4255ff]/10 transition-colors disabled:opacity-50 ${className}`}
    >
      {playing
        ? <Loader2 className={`${iconSize} animate-spin`} />
        : <Volume2 className={iconSize} />
      }
    </button>
  );
}
