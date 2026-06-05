'use client';
import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SentenceBuilder({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: () => void }) {
  const correct = (exercise.sentence || '').trim();
  const words = useMemo(() => shuffle(exercise.words || correct.split(' ')), []);

  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<Array<{ word: string; id: number }>>(
    () => words.map((w, i) => ({ word: w, id: i }))
  );
  const [checked, setChecked] = useState(false);

  const built = selected.join(' ');
  const isCorrect = built.toLowerCase().trim() === correct.toLowerCase().trim();

  const addWord = (item: { word: string; id: number }) => {
    if (checked) return;
    setSelected(s => [...s, item.word]);
    setAvailable(a => a.filter(w => w.id !== item.id));
  };

  const removeWord = (idx: number) => {
    if (checked) return;
    const word = selected[idx];
    const removed = words.map((w, i) => ({ word: w, id: i })).find(w => w.word === word && !available.some(a => a.id === w.id));
    if (removed) setAvailable(a => [...a, removed].sort((x, y) => x.id - y.id));
    setSelected(s => s.filter((_, i) => i !== idx));
  };

  const handleCheck = () => {
    if (!selected.length) return;
    setChecked(true);
    if (isCorrect) onComplete?.();
  };

  const handleReset = () => {
    setSelected([]);
    setAvailable(words.map((w, i) => ({ word: w, id: i })));
    setChecked(false);
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
        <AudioButton text={correct} size="md" />
      </div>

      <p className="text-qz-text-muted text-xs mb-4">Составьте предложение из слов ниже</p>

      {/* Drop zone */}
      <div className={`min-h-[56px] bg-muted border-2 rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-2 items-center transition-colors ${
        checked ? (isCorrect ? 'border-emerald-500/50' : 'border-red-500/50') : 'border-border'
      }`}>
        {selected.length === 0 && (
          <span className="text-qz-text-muted/40 text-sm select-none">Нажмите на слова ниже...</span>
        )}
        {selected.map((word, i) => (
          <button key={i} onClick={() => removeWord(i)} disabled={checked}
            className="bg-[#4255ff]/20 border border-[#4255ff]/40 dark:text-white text-foreground text-sm px-3 py-1 rounded-lg hover:bg-red-500/20 hover:border-red-500/40 transition-all disabled:cursor-default">
            {word}
          </button>
        ))}
      </div>

      {/* Available words */}
      <div className="flex flex-wrap gap-2 mb-5">
        {available.map(item => (
          <button key={item.id} onClick={() => addWord(item)} disabled={checked}
            className="bg-muted border border-border text-foreground text-sm px-3 py-1.5 rounded-lg hover:border-[#4255ff]/50 hover:bg-[#4255ff]/10 transition-all disabled:opacity-50">
            {item.word}
          </button>
        ))}
      </div>

      {/* Action */}
      {!checked ? (
        <div className="flex gap-2 justify-end">
          <button onClick={handleReset} disabled={!selected.length}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-foreground text-sm hover:bg-muted transition-colors disabled:opacity-40">
            <RotateCcw className="w-3.5 h-3.5" /> Сброс
          </button>
          <button onClick={handleCheck} disabled={!selected.length}
            className="px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors disabled:opacity-50">
            Проверить
          </button>
        </div>
      ) : (
        <div className={`flex gap-2 items-start p-3 rounded-xl text-sm ${isCorrect ? 'dark:bg-emerald-500/10 bg-emerald-50' : 'dark:bg-red-500/10 bg-red-50'}`}>
          {isCorrect
            ? <><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /><span className="dark:text-emerald-300 text-emerald-700 font-semibold">Отлично! <AudioButton text={correct} /></span></>
            : (
              <div className="w-full">
                <div className="flex gap-2 items-center mb-2">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span className="dark:text-qz-text-muted text-foreground">Правильный вариант:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium">{correct}</span>
                  <AudioButton text={correct} />
                </div>
                <button onClick={handleReset} className="mt-3 inline-flex items-center gap-1.5 text-xs text-qz-text-muted hover:text-foreground transition-colors">
                  <RotateCcw className="w-3 h-3" /> Попробовать ещё раз
                </button>
              </div>
            )
          }
        </div>
      )}
    </div>
  );
}
