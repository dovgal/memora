'use client';
import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { EditoExercise, GenderItem } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

const ARTICLES = ["le", "la", "l'", "un", "une"] as const;
const COLORS: Record<string, string> = {
  "le":  "bg-blue-500/20 border-blue-500/50 text-blue-300",
  "la":  "bg-pink-500/20 border-pink-500/50 text-pink-300",
  "l'":  "bg-teal-500/20 border-teal-500/50 text-teal-300",
  "un":  "bg-violet-500/20 border-violet-500/50 text-violet-300",
  "une": "bg-amber-500/20 border-amber-500/50 text-amber-300",
};
const LABELS: Record<string, string> = {
  "le":  "м.р. опр.",
  "la":  "ж.р. опр.",
  "l'":  "перед гл.",
  "un":  "м.р. неопр.",
  "une": "ж.р. неопр.",
};

export function GenderQuiz({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: (result?: { correct: number; total: number }) => void }) {
  const items = (exercise.items || []) as GenderItem[];
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const item = items[current];
  const isCorrect = selected === item?.article;

  const handleSelect = (art: string) => {
    if (selected) return;
    setSelected(art);
    if (art === item.article) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (current < items.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
      onComplete?.({ correct: score, total: items.length });
    }
  };

  if (finished) {
    const pct = Math.round((score / items.length) * 100);
    return (
      <div className="bg-qz-card border border-border rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">{pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '💪'}</div>
        <h4 className="text-foreground font-bold text-lg mb-1">{exercise.title}</h4>
        <p className="text-qz-text-muted text-sm">{score} / {items.length} · {pct}%</p>
      </div>
    );
  }

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
        <span className="text-qz-text-muted text-xs">{current + 1} / {items.length} · ✓ {score}</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-muted rounded-full mb-6">
        <div className="h-full bg-[#4255ff] rounded-full transition-all duration-300"
          style={{ width: `${(current / items.length) * 100}%` }} />
      </div>

      {/* Word display */}
      <div className="text-center mb-6">
        {item.emoji && <div className="text-5xl mb-3">{item.emoji}</div>}
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-3xl font-bold">
            <span className={`mr-2 ${selected ? COLORS[item.article].split(' ')[2] : 'text-qz-text-muted/60'}`}>
              {selected ? item.article : '___'}
            </span>
            <span className="dark:text-white text-foreground">{item.word}</span>
          </span>
          <AudioButton text={`${item.article} ${item.word}`} size="md" />
        </div>
        {item.ru && <p className="text-qz-text-muted text-sm">{item.ru}</p>}
      </div>

      {/* Article buttons */}
      {!selected && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {ARTICLES.map(art => (
            <button
              key={art}
              onClick={() => handleSelect(art)}
              className={`border rounded-xl px-3 py-2.5 text-left transition-all hover:scale-[1.02] ${COLORS[art]} hover:opacity-90`}
            >
              <div className="font-bold text-base">{art}</div>
              <div className="text-xs opacity-70 mt-0.5">{LABELS[art]}</div>
            </button>
          ))}
        </div>
      )}

      {/* Feedback */}
      {selected && (
        <div className="space-y-3">
          <div className={`flex gap-2 items-start p-3 rounded-xl text-sm ${isCorrect ? 'dark:bg-emerald-500/10 bg-emerald-50' : 'dark:bg-red-500/10 bg-red-50'}`}>
            {isCorrect
              ? <><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span className="dark:text-emerald-300 text-emerald-700 font-semibold">Parfait !</span></>
              : <><XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" /><span className="dark:text-qz-text-muted text-foreground">Правильно: <strong className="dark:text-white text-foreground">{item.article} {item.word}</strong></span></>
            }
          </div>
          {item.hint && <p className="text-qz-text-muted text-sm px-1">💡 {item.hint}</p>}
          <div className="flex justify-end">
            <button onClick={handleNext} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
              {current < items.length - 1 ? 'Следующее' : 'Результат'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
