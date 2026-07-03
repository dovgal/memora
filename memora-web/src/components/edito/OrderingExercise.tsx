'use client';
// Упорядочивание (хронология, этапы решения): элементы показываются перемешанными,
// ученик собирает последовательность кликами. Проверка детерминированная —
// попозиционное сравнение с эталонным порядком.

import { useMemo, useState } from 'react';
import { CheckCircle2, RotateCcw, X } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function OrderingExercise({ exercise, onComplete }: {
  exercise: EditoExercise;
  onComplete?: (result?: { correct: number; total: number }) => void;
}) {
  const items = useMemo(() => exercise.orderItems ?? [], [exercise.orderItems]);
  // Перемешанный банк: гарантируем НЕ-правильный стартовый порядок (иначе нечего решать).
  const [bank, setBank] = useState<string[]>(() => {
    if (items.length < 2) return [...items];
    let s = shuffle(items);
    let guard = 0;
    while (s.every((v, i) => v === items[i]) && guard++ < 10) s = shuffle(items);
    return s;
  });
  const [picked, setPicked] = useState<string[]>([]);
  const [checked, setChecked] = useState(false);

  const pick = (item: string) => {
    if (checked) return;
    setPicked(p => [...p, item]);
    setBank(b => {
      const i = b.indexOf(item);
      return i < 0 ? b : [...b.slice(0, i), ...b.slice(i + 1)];
    });
  };

  const unpick = (index: number) => {
    if (checked) return;
    const item = picked[index];
    setPicked(p => p.filter((_, i) => i !== index));
    setBank(b => [...b, item]);
  };

  const handleCheck = () => {
    if (picked.length !== items.length || checked) return;
    setChecked(true);
    const correct = picked.filter((v, i) => v === items[i]).length;
    onComplete?.({ correct, total: items.length });
  };

  const handleRetry = () => {
    setPicked([]);
    setBank(shuffle(items));
    setChecked(false);
  };

  const correctCount = picked.filter((v, i) => v === items[i]).length;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <h4 className="text-foreground font-semibold text-sm mb-3">{exercise.title}</h4>
      {exercise.prompt && <p className="text-foreground text-base leading-relaxed mb-4">{exercise.prompt}</p>}

      {/* Собранная последовательность */}
      <div className="space-y-1.5 mb-4">
        {picked.map((item, i) => {
          const ok = checked && item === items[i];
          const bad = checked && item !== items[i];
          return (
            <div
              key={`${item}-${i}`}
              className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm ${
                ok ? 'border-emerald-500/50 dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-300 text-emerald-700'
                  : bad ? 'border-red-500/50 dark:bg-red-500/10 bg-red-50 dark:text-red-300 text-red-700'
                  : 'border-border bg-qz-bg text-foreground'
              }`}
            >
              <span className="text-qz-text-muted text-xs w-5 shrink-0">{i + 1}.</span>
              <span className="flex-1">{item}</span>
              {bad && <span className="text-xs shrink-0">→ {items[i]}</span>}
              {!checked && (
                <button onClick={() => unpick(i)} className="text-qz-text-muted hover:text-foreground shrink-0" title="Убрать">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {picked.length === 0 && (
          <p className="text-qz-text-muted text-xs py-2">Нажимайте на элементы ниже в правильном порядке.</p>
        )}
      </div>

      {/* Банк */}
      {bank.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {bank.map((item, i) => (
            <button
              key={`${item}-${i}`}
              onClick={() => pick(item)}
              className="px-3 py-2 rounded-xl border border-border bg-muted text-foreground text-sm hover:border-[#4255ff]/60 transition-colors text-left"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {!checked ? (
        <div className="flex justify-end">
          <button
            onClick={handleCheck}
            disabled={picked.length !== items.length}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] disabled:opacity-40 text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Проверить
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-foreground text-sm font-semibold">
            {correctCount} / {items.length} на своих местах {correctCount === items.length && '🏆'}
          </p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-foreground text-sm hover:opacity-80 transition-opacity"
          >
            <RotateCcw className="w-4 h-4" /> Ещё раз
          </button>
        </div>
      )}
      {checked && exercise.explanation && correctCount < items.length && (
        <p className="text-qz-text-muted text-sm mt-3">{exercise.explanation}</p>
      )}
    </div>
  );
}
