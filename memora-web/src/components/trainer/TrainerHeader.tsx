'use client';
// Верхняя панель занятия: закрыть, параметры, прогресс, серия и всплывающий опыт.
// Спокойная: одна тонкая полоса прогресса и счётчик, без мигания и таймеров —
// ребёнку и взрослому, которому трудно, давление временем только мешает.

import { Settings, X, Zap } from 'lucide-react';

export function TrainerHeader({
  position, queueLength, combo, xpFloat, onSettings, onClose,
}: {
  position: number;
  queueLength: number;
  combo: number;
  xpFloat: { amount: number; id: number } | null;
  onSettings: () => void;
  onClose: () => void;
}) {
  const done = Math.max(0, position - 1);
  const pct = queueLength > 0 ? Math.min(100, (done / queueLength) * 100) : 0;

  return (
    <div className="sticky top-0 z-20 bg-qz-bg/95 backdrop-blur-sm" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <header className="flex items-center gap-3 px-4 sm:px-6 py-3 w-full max-w-2xl mx-auto">
        <button
          onClick={onClose}
          aria-label="Закрыть занятие"
          className="p-2.5 -ml-2.5 rounded-xl text-qz-text-muted hover:text-qz-text hover:bg-qz-card transition-colors"
        >
          <X size={22} />
        </button>

        <div
          className="flex-1 h-2.5 bg-qz-card rounded-full overflow-hidden border border-qz-border-light"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={queueLength}
          aria-valuenow={done}
          aria-label="Прогресс занятия"
        >
          <div className="h-full bg-[#4255ff] rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <span className="text-xs font-semibold text-qz-text-muted tabular-nums min-w-[3.5rem] text-right">
          {Math.min(position, queueLength)} / {queueLength}
        </span>

        <div className="relative flex items-center">
          {combo >= 3 && (
            <span className="flex items-center gap-0.5 text-sm font-bold text-amber-500 animate-in fade-in zoom-in duration-200" title="Верно подряд">
              <Zap size={16} className="fill-amber-500" /> {combo}
            </span>
          )}
          {xpFloat && (
            <span
              key={xpFloat.id}
              aria-live="polite"
              className="absolute -top-4 right-0 text-emerald-500 font-bold text-sm pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-500"
            >
              +{xpFloat.amount} XP
            </span>
          )}
        </div>

        <button
          onClick={onSettings}
          aria-label="Параметры"
          className="p-2.5 -mr-2.5 rounded-xl text-qz-text-muted hover:text-qz-text hover:bg-qz-card transition-colors"
        >
          <Settings size={20} />
        </button>
      </header>

    </div>
  );
}
