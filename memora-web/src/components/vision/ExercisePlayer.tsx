'use client';
// Экран одного упражнения: анимированная цель или таймер, крупный обратный
// отсчёт и шаги простыми словами. Рассчитан на ребёнка: минимум текста на
// экране во время выполнения, всё управление — двумя большими кнопками.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, ChevronRight, TriangleAlert } from 'lucide-react';
import { EyeTarget } from './EyeTarget';
import type { VisionExercise } from '@/data/vision/exercises';

export function ExercisePlayer({ ex, onDone, onNext }: {
  ex: VisionExercise;
  onDone: (id: string) => void;
  onNext?: () => void;
}) {
  const total = ex.kind === 'reps' ? (ex.reps ?? 10) : (ex.seconds ?? 30);
  // Состояние стартует от самого упражнения; при переходе к следующему
  // родитель пересоздаёт компонент через key={ex.id}, поэтому сбрасывать
  // счётчик эффектом не нужно — он инициализируется заново сам.
  const [left, setLeft] = useState(total);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (tick.current) { clearInterval(tick.current); tick.current = null; }
  }, []);

  useEffect(() => {
    if (!running) { stop(); return; }
    tick.current = setInterval(() => {
      setLeft(v => {
        if (v <= 1) {
          stop();
          setRunning(false);
          setFinished(true);
          onDone(ex.id);
          return 0;
        }
        return v - 1;
      });
    }, ex.kind === 'reps' ? 5000 : 1000);   // на повторы даём по 5 секунд
    return stop;
  }, [running, ex.kind, ex.id, onDone, stop]);

  const pct = total > 0 ? ((total - left) / total) * 100 : 0;
  const unit = ex.kind === 'reps' ? 'раз' : 'сек';

  return (
    <div className="bg-qz-card border border-border rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-4xl">{ex.emoji}</span>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{ex.title}</h2>
          <p className="text-qz-text-muted text-sm">{ex.short}</p>
        </div>
      </div>

      {/* Сцена: цель для слежения либо большой круг-таймер */}
      <div className="my-5 rounded-2xl bg-[#0b1020] p-4 flex items-center justify-center min-h-[260px]">
        {ex.kind === 'track' && ex.path ? (
          <EyeTarget path={ex.path} speed={ex.speed} running={running} />
        ) : (
          <div className="text-center">
            <div
              className={`mx-auto rounded-full flex items-center justify-center transition-all ${running ? 'animate-pulse' : ''}`}
              style={{
                width: 190, height: 190,
                background: `conic-gradient(#ffd43b ${pct * 3.6}deg, rgba(255,255,255,.08) 0deg)`,
              }}
            >
              <div className="rounded-full bg-[#0b1020] flex flex-col items-center justify-center" style={{ width: 158, height: 158 }}>
                <span className="text-5xl font-bold text-white tabular-nums">{left}</span>
                <span className="text-white/60 text-sm">{unit}</span>
              </div>
            </div>
            <p className="text-white/70 text-sm mt-3 max-w-sm mx-auto">{ex.short}</p>
          </div>
        )}
      </div>

      {ex.kind === 'track' && (
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="text-3xl font-bold text-foreground tabular-nums">{left}</span>
          <span className="text-qz-text-muted text-sm">{unit} осталось</span>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap justify-center mb-5">
        <button
          onClick={() => (finished ? (setLeft(total), setFinished(false), setRunning(true)) : setRunning(r => !r))}
          className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold px-6 py-3 rounded-2xl text-base transition-colors"
        >
          {finished ? <><RotateCcw className="w-5 h-5" /> Ещё раз</>
            : running ? <><Pause className="w-5 h-5" /> Пауза</>
            : <><Play className="w-5 h-5" /> Поехали!</>}
        </button>
        {finished && onNext && (
          <button onClick={onNext}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-2xl transition-colors">
            Дальше <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <button onClick={() => { setRunning(false); setLeft(total); setFinished(false); }}
          className="inline-flex items-center gap-2 border border-border text-qz-text-muted hover:text-foreground font-semibold px-4 py-3 rounded-2xl">
          <RotateCcw className="w-4 h-4" /> Сброс
        </button>
      </div>

      {finished && (
        <p className="text-center text-emerald-500 font-bold mb-4">Отлично! Упражнение сделано ⭐</p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-2">Как делать</p>
          <ol className="list-decimal pl-5 space-y-1">
            {ex.steps.map((s, i) => <li key={i} className="text-sm text-qz-text-muted leading-relaxed">{s}</li>)}
          </ol>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-2">Зачем это</p>
          <p className="text-sm text-qz-text-muted leading-relaxed">{ex.why}</p>
          {ex.care && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" /> {ex.care}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
