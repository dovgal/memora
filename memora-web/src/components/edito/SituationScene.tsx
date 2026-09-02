'use client';
// Сценка: рисунок обстановки с подписанными предметами.
//
// Слово, привязанное к месту на картинке, держится в памяти лучше строчки в
// столбике: у него появляется где. Поэтому подписи можно спрятать и назвать
// всё самому — проверка идёт по той же картинке, а не по списку.

import { useMemo, useState } from 'react';
import { Eye, EyeOff, Volume2 } from 'lucide-react';
import { speakInworld } from '@/lib/courses/ttsInworld';
import type { EditoExercise } from '@/lib/courses/edito-a1';

interface Props {
  exercise: EditoExercise;
  onComplete?: () => void;
}

export function SituationScene({ exercise, onComplete }: Props) {
  const spots = useMemo(() => exercise.spots ?? [], [exercise.spots]);
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [labels, setLabels] = useState(true);
  const [active, setActive] = useState<number | null>(null);

  const open = (i: number) => {
    setActive(i);
    void speakInworld(spots[i].fr);
    setOpened(prev => {
      if (prev.has(i)) return prev;
      const next = new Set(prev);
      next.add(i);
      if (next.size === spots.length) onComplete?.();
      return next;
    });
  };

  if (spots.length === 0) return null;
  const cur = active === null ? null : spots[active];

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
          {exercise.instruction && (
            <p className="text-qz-text-muted text-xs mt-0.5">{exercise.instruction}</p>
          )}
        </div>
        <button
          onClick={() => setLabels(v => !v)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border text-qz-text-muted hover:text-foreground px-3 py-1.5 rounded-lg"
        >
          {labels ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {labels ? 'Скрыть подписи' : 'Показать подписи'}
        </button>
      </div>

      {/* Светлая подложка нужна всегда: рисунок один и тот же в обеих темах. */}
      <div className="relative rounded-xl overflow-hidden border border-border bg-[#faf7f1]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/scenes/${exercise.scene}.svg`} alt={exercise.title ?? 'сценка'} className="w-full h-auto block" />
        {spots.map((s, i) => (
          <button
            key={s.fr}
            onClick={() => open(i)}
            style={{ left: `${s.x}%`, top: `${s.y}%` }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-all ${
              labels
                ? 'px-2 py-0.5 text-[11px] font-bold text-white bg-[#4255ff] shadow-[0_0_0_2px_rgba(255,255,255,0.9)]'
                : `w-6 h-6 border-2 border-[#4255ff] ${opened.has(i) ? 'bg-[#4255ff]' : 'bg-white/85'}`
            }`}
            title={labels ? s.ru : 'Назовите этот предмет'}
          >
            {labels ? s.fr : ''}
          </button>
        ))}
      </div>

      {cur && (
        <div className="border border-border rounded-xl px-3 py-2 flex items-center gap-3">
          <button onClick={() => void speakInworld(cur.fr)} className="p-1.5 rounded-lg border border-border text-qz-text-muted hover:text-foreground">
            <Volume2 className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <p className="text-foreground font-semibold text-sm">{cur.fr}</p>
            <p className="text-qz-text-muted text-xs">
              {cur.ru}{cur.ipa ? ` · [${cur.ipa}]` : ''}
            </p>
          </div>
          <span className="ml-auto text-qz-text-muted text-xs shrink-0">{opened.size}/{spots.length}</span>
        </div>
      )}

      {exercise.phrases && exercise.phrases.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <p className="text-xs uppercase tracking-wider font-bold text-qz-text-muted">Что здесь говорят</p>
          {exercise.phrases.map(p => (
            <button
              key={p.fr}
              onClick={() => void speakInworld(p.fr)}
              className="w-full text-left border border-border rounded-xl px-3 py-2 hover:border-[#4255ff]/50 transition-colors"
            >
              <span className="text-foreground text-sm">{p.fr}</span>
              <span className="block text-qz-text-muted text-xs">{p.ru}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
