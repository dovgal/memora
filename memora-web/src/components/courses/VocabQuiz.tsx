'use client';
// Карточка лексики в коуч-сессии: показывает слово с озвучкой,
// учащийся выбирает перевод из вариантов.

import { useMemo, useState } from 'react';
import { Volume2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import type { VocabularyItem } from '@/lib/courses/edito-a1';
import { speakInworld } from '@/lib/courses/ttsInworld';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Props {
  item: VocabularyItem;
  /** Пул для дистракторов (другие слова курса) */
  pool: VocabularyItem[];
  onComplete?: (result?: { correct: number; total: number }) => void;
}

export function VocabQuiz({ item, pool, onComplete }: Props) {
  const options = useMemo(() => {
    const distractors = shuffle(pool.filter(v => v.ru !== item.ru)).slice(0, 3);
    return shuffle([item, ...distractors]);
  }, [item, pool]);

  const [selected, setSelected] = useState<string | null>(null);
  const isCorrect = selected === item.ru;

  const handleSelect = (ru: string) => {
    if (selected) return;
    setSelected(ru);
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <h4 className="text-foreground font-semibold text-sm mb-4">Лексика: выберите перевод</h4>

      <div className="flex items-center justify-center gap-3 mb-6">
        <span className="text-2xl font-bold text-foreground">{item.fr}</span>
        <button
          type="button"
          onClick={() => speakInworld(item.fr)}
          className="p-2 rounded-full bg-[#4255ff]/15 text-[#4255ff] hover:bg-[#4255ff]/25 transition-colors"
          title="Озвучить"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {options.map(opt => {
          let cls = 'bg-muted border-border text-foreground hover:border-[#4255ff]/50';
          if (selected) {
            if (opt.ru === item.ru) cls = 'dark:bg-emerald-500/15 bg-emerald-50 border-emerald-500/50 dark:text-emerald-300 text-emerald-700';
            else if (opt.ru === selected) cls = 'dark:bg-red-500/15 bg-red-50 border-red-500/50 dark:text-red-300 text-red-600';
            else cls = 'bg-muted border-border text-qz-text-muted';
          }
          return (
            <button
              key={opt.ru}
              onClick={() => handleSelect(opt.ru)}
              disabled={!!selected}
              className={`border rounded-xl px-4 py-3 text-sm text-left transition-all ${cls}`}
            >
              {opt.ru}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="flex items-center justify-between gap-3">
          <span className={`flex items-center gap-1.5 text-sm ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            {isCorrect ? 'Верно!' : <>Правильно: <strong className="text-foreground">{item.ru}</strong></>}
          </span>
          <button
            onClick={() => onComplete?.({ correct: isCorrect ? 1 : 0, total: 1 })}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors"
          >
            Далее <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
