'use client';
import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw, RefreshCw } from 'lucide-react';
import { EditoExercise, NumberItem } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function NumberQuiz({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: () => void }) {
  const mode = exercise.mode || 'digit-to-word';
  const allItems = exercise.items as NumberItem[] || [];
  const initialItems = useMemo(() => shuffle(allItems), []);

  const [sessionItems, setSessionItems] = useState(initialItems);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [mistakes, setMistakes] = useState<NumberItem[]>([]);
  const [finished, setFinished] = useState(false);
  const [isRetry, setIsRetry] = useState(false);

  const item = sessionItems[current];

  const options = useMemo(() => {
    if (!item) return [];
    const pool = allItems.filter(it => it.number !== item.number);
    const distractors = shuffle(pool).slice(0, 3);
    return shuffle([item, ...distractors]).map(it => ({
      label: mode === 'digit-to-word' ? it.french : String(it.number),
      correct: it.number === item.number,
    }));
  }, [current, sessionItems, mode]);

  const question = mode === 'digit-to-word' ? String(item?.number) : item?.french;
  const questionLabel = mode === 'digit-to-word' ? 'Как написать по-французски?' : 'Какое число?';

  const handleSelect = (opt: { label: string; correct: boolean }) => {
    if (selected) return;
    setSelected(opt.label);
    setIsCorrect(opt.correct);
    if (opt.correct) {
      setScore(s => s + 1);
      setStreak(s => { const ns = s + 1; setMaxStreak(m => Math.max(m, ns)); return ns; });
    } else {
      setStreak(0);
      setMistakes(m => [...m, item]);
    }
  };

  const handleNext = () => {
    if (current < sessionItems.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
      setIsCorrect(null);
    } else {
      setFinished(true);
      onComplete?.();
    }
  };

  const reset = (items: NumberItem[], retry: boolean) => {
    setSessionItems(shuffle(items));
    setCurrent(0); setSelected(null); setIsCorrect(null);
    setScore(0); setStreak(0); setMaxStreak(0);
    setMistakes([]); setFinished(false); setIsRetry(retry);
  };

  if (finished) {
    const total = sessionItems.length;
    const pct = Math.round((score / total) * 100);
    const uniqueMistakes = [...new Map(mistakes.map(m => [m.number, m])).values()];

    return (
      <div className="bg-qz-card border border-border rounded-2xl p-6">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">{pct >= 90 ? '🏆' : pct >= 70 ? '⭐' : '💪'}</div>
          <h4 className="text-foreground font-bold text-base">{isRetry ? 'Повтор завершён!' : `${exercise.title} — Готово!`}</h4>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5 bg-muted rounded-xl p-3">
          {[
            { val: `${score}/${total}`, label: 'Правильно', color: 'text-blue-400' },
            { val: `${pct}%`, label: 'Результат', color: pct >= 80 ? 'text-emerald-400' : pct >= 60 ? 'text-amber-400' : 'text-red-400' },
            { val: `⚡${maxStreak}`, label: 'Серия', color: 'text-violet-400' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.val}</div>
              <div className="text-qz-text-muted text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Streak bar */}
        {maxStreak >= 3 && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
            <span className="text-xl">⚡</span>
            <div>
              <div className="text-amber-400 font-semibold text-sm">Серия {maxStreak} подряд</div>
              <div className="flex gap-1 mt-1">
                {Array.from({ length: Math.min(maxStreak, 15) }).map((_, i) => (
                  <div key={i} className="w-3 h-3 rounded-sm bg-amber-400/70" />
                ))}
                {maxStreak > 15 && <span className="text-amber-400 text-xs self-center">+{maxStreak - 15}</span>}
              </div>
            </div>
          </div>
        )}

        {/* Mistakes */}
        {uniqueMistakes.length > 0 && (
          <div className="mb-4">
            <h5 className="text-red-400 text-sm font-semibold mb-2 flex items-center gap-2">
              ❌ Числа для повторения
              <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">{uniqueMistakes.length}</span>
            </h5>
            <div className="grid grid-cols-2 gap-1.5">
              {uniqueMistakes.map(m => (
                <div key={m.number} className="flex items-center justify-between dark:bg-red-500/8 bg-red-50 border dark:border-red-500/20 border-red-200 rounded-lg px-3 py-2 gap-2">
                  <span className="text-red-400 font-bold text-lg min-w-[2rem]">{m.number}</span>
                  <span className="text-foreground text-sm font-medium flex-1">{m.french}</span>
                  <AudioButton text={m.french} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={() => reset(allItems, false)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-foreground text-sm hover:bg-muted transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Заново
          </button>
          {uniqueMistakes.length > 0 && (
            <button onClick={() => reset(uniqueMistakes, true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-foreground text-sm hover:bg-red-500 transition-colors font-semibold">
              <RefreshCw className="w-3.5 h-3.5" /> Повторить ошибки ({uniqueMistakes.length})
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-foreground font-semibold text-sm">
          {exercise.title}
          {isRetry && <span className="ml-2 text-red-400 font-normal text-xs">— повтор ошибок</span>}
        </h4>
        <div className="flex gap-3 text-xs">
          <span className="text-blue-400">✓ {score}</span>
          {streak >= 3 && <span className="text-amber-400">⚡{streak}</span>}
          <span className="text-qz-text-muted">{current + 1}/{sessionItems.length}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 bg-muted rounded-full mb-6">
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${(current / sessionItems.length) * 100}%`, background: streak >= 5 ? '#f59e0b' : isRetry ? '#ef4444' : '#4255ff' }} />
      </div>

      {/* Question */}
      <div className="text-center mb-6">
        <p className="text-qz-text-muted text-xs mb-3">{questionLabel}</p>
        <div className="flex items-center justify-center gap-3">
          <span className={`font-bold transition-colors ${
            mode === 'digit-to-word' ? 'text-6xl' : 'text-3xl'
          } ${selected ? (isCorrect ? 'text-emerald-400' : 'text-red-400') : 'dark:text-white text-foreground'}`}>
            {question}
          </span>
          {mode === 'word-to-digit' && item?.french && <AudioButton text={item.french} size="md" />}
        </div>
        {item?.hint && !selected && <p className="text-qz-text-muted text-xs mt-2">💡 {item.hint}</p>}
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {options.map((opt, i) => {
          let cls = 'bg-muted border-border text-foreground hover:border-[#4255ff]/50';
          if (selected) {
            if (opt.correct) cls = 'dark:bg-emerald-500/15 bg-emerald-50 border-emerald-500/50 dark:text-emerald-300 text-emerald-700';
            else if (opt.label === selected) cls = 'dark:bg-red-500/15 bg-red-50 border-red-500/50 dark:text-red-300 text-red-600';
            else cls = 'bg-muted border-border text-qz-text-muted';
          }
          return (
            <button key={i} onClick={() => handleSelect(opt)} disabled={!!selected}
              className={`border rounded-xl px-4 py-3 text-left transition-all flex items-center justify-between gap-2 ${cls} ${!selected ? 'cursor-pointer' : 'cursor-default'}`}>
              <span className={`font-${mode === 'word-to-digit' ? 'bold text-xl' : 'medium text-sm'}`}>{opt.label}</span>
              {mode === 'digit-to-word' && <AudioButton text={opt.label} />}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="space-y-3">
          {item?.explanation && (
            <div className={`flex gap-2 text-sm p-3 rounded-xl ${isCorrect ? 'dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-300 text-emerald-700' : 'dark:bg-red-500/10 bg-red-50 dark:text-qz-text-muted text-foreground'}`}>
              {isCorrect ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />}
              {!isCorrect && <strong className="dark:text-white text-foreground">Правильно: {mode === 'digit-to-word' ? item.french : item.number}. </strong>}
              {item.explanation}
            </div>
          )}
          {!item?.explanation && !isCorrect && (
            <div className="flex gap-2 text-sm p-3 rounded-xl dark:bg-red-500/10 bg-red-50 dark:text-qz-text-muted text-foreground">
              <XCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              Правильно: <strong className="text-foreground ml-1">{mode === 'digit-to-word' ? item.french : item.number}</strong>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handleNext} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
              {current < sessionItems.length - 1 ? 'Далее' : 'Результат'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
