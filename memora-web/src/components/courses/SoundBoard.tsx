'use client';
// Звуковая таблица: все звуки французского. Клик по звуку → проигрывается
// слово-пример через Inworld TTS (голос курса), чтобы услышать звук в контексте.
// Отдельная кнопка «медленно» произносит пример по слогам-словам.

import { useState } from 'react';
import { Volume2, Turtle } from 'lucide-react';
import { speakInworld } from '@/lib/courses/ttsInworld';
import { FRENCH_SOUNDS, type FrenchSound } from '@/lib/courses/frenchSounds';

export function SoundBoard({ voice = 'Alain' }: { voice?: string }) {
  const [active, setActive] = useState<string | null>(null);

  const play = (s: FrenchSound) => {
    setActive(s.ipa);
    void speakInworld(s.example, voice);
    setTimeout(() => setActive(a => (a === s.ipa ? null : a)), 1200);
  };
  const playSlow = (s: FrenchSound, e: React.MouseEvent) => {
    e.stopPropagation();
    const words = s.example.split(/\s+/).filter(Boolean);
    let i = 0;
    const step = () => { if (i < words.length) { void speakInworld(words[i], voice); i++; setTimeout(step, 1000); } };
    step();
  };

  return (
    <div className="space-y-8">
      <p className="text-qz-text-muted text-sm">
        Нажмите на звук — прозвучит слово-пример. Так вы слышите звук в реальном слове (изолированный звук в отрыве от слова во французском почти не встречается).
      </p>
      {FRENCH_SOUNDS.map(group => (
        <div key={group.title}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">{group.title}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {group.sounds.map(s => (
              <div
                key={s.ipa}
                role="button"
                tabIndex={0}
                onClick={() => play(s)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(s); } }}
                className={`text-left rounded-2xl border p-4 transition-all group cursor-pointer ${
                  active === s.ipa
                    ? 'border-[#4255ff] bg-[#4255ff]/10'
                    : 'border-border bg-qz-card hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5'
                }`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-2xl font-bold text-foreground font-mono">[{s.ipa}]</span>
                  <Volume2 className={`w-4 h-4 mt-1 transition-colors ${active === s.ipa ? 'text-[#4255ff]' : 'text-qz-text-muted group-hover:text-[#4255ff]'}`} />
                </div>
                <p className="text-foreground text-sm font-semibold mt-1">
                  {s.example} <span className="text-qz-text-muted font-mono font-normal">[{s.exampleIpa}]</span>
                </p>
                <p className="text-qz-text-muted text-xs mt-1">{s.spellings}</p>
                <p className="text-qz-text-muted text-xs mt-0.5 italic">{s.note}</p>
                <button
                  onClick={(e) => playSlow(s, e)}
                  className="mt-2 inline-flex items-center gap-1 text-qz-text-muted hover:text-[#4255ff] text-xs transition-colors"
                  title="По словам, медленно"
                >
                  <Turtle className="w-3.5 h-3.5" /> медленно
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
