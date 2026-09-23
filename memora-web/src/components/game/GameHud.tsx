'use client';
// Компактная плашка игрового слоя в шапке: уровень + полоска опыта, серия
// дней огоньком, кольцо дневной цели. Сама тянет /api/game/me при монтаже
// и дальше обновляется «на лету» из шины (onGameUpdate) — без неё полоска
// отставала бы от только что начисленного опыта до следующей перезагрузки.
// Клик ведёт на страницу достижений.
//
// На телефоне шапка и так тесная (поиск + переключатели), поэтому там
// остаются только уровень и огонёк; полоска и кольцо — с sm и шире.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import { getGameState, type GameState } from '@/lib/game/client';
import { onGameUpdate } from '@/lib/game/celebrationBus';

/** Кольцо прогресса дневной цели — маленький SVG, без сторонних зависимостей. */
function GoalRing({ progress, goal }: { progress: number; goal: number }) {
  const pct = goal > 0 ? Math.min(1, progress / goal) : 0;
  const r = 12;
  const c = 2 * Math.PI * r;
  const met = goal > 0 && progress >= goal;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" className="shrink-0" aria-hidden="true">
      <circle cx="15" cy="15" r={r} fill="none" strokeWidth="3.5" className="stroke-border" />
      <circle
        cx="15" cy="15" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
        className={`${met ? 'stroke-emerald-500' : 'stroke-[#4255ff]'} transition-[stroke-dasharray] duration-500`}
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 15 15)"
      />
    </svg>
  );
}

export function GameHud() {
  const [state, setState] = useState<GameState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => getGameState().then(s => { if (!cancelled && s) setState(s); });
    refresh();
    const unsubscribe = onGameUpdate(update => {
      // Уровень не сменился — переносим свежие цифры из ответа прямо тут, без
      // лишнего похода на сервер (события идут на каждый ответ). Сменился —
      // порог следующего уровня другой, его знает только сервер: перечитываем.
      if (update.leveledUp) { refresh(); }
      setState(prev => prev && ({
        ...prev,
        xp: update.xp,
        level: update.level,
        xpIntoLevel: prev.level === update.level ? prev.xpIntoLevel + update.xpGained : 0,
        streakDays: update.streakDays,
        longestStreak: Math.max(prev.longestStreak, update.streakDays),
        dailyGoal: update.dailyGoal,
        dailyProgress: update.dailyProgress,
      }));
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  if (!state) return null;

  const xpPct = state.xpForNextLevel > 0 ? Math.min(1, state.xpIntoLevel / state.xpForNextLevel) : 0;
  const goalPct = state.dailyGoal > 0 ? Math.min(100, Math.round((state.dailyProgress / state.dailyGoal) * 100)) : 0;
  const summary = `Уровень ${state.level} (${state.xpIntoLevel}/${state.xpForNextLevel} XP) · серия ${state.streakDays} дн. · цель дня ${state.dailyProgress}/${state.dailyGoal} XP`;

  return (
    <Link
      href="/achievements"
      title={summary}
      aria-label={`${summary}. Открыть достижения`}
      className="shrink-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1 rounded-full bg-secondary/60 border border-border hover:border-[#4255ff]/50 transition-colors"
    >
      {/* Уровень + полоска опыта */}
      <span className="flex items-center gap-1.5">
        <span className="w-6 h-6 rounded-full bg-[#4255ff] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
          {state.level}
        </span>
        <span className="hidden sm:block w-14 h-1.5 rounded-full bg-border overflow-hidden">
          <span className="block h-full bg-[#4255ff] transition-[width] duration-500" style={{ width: `${xpPct * 100}%` }} />
        </span>
      </span>

      {/* Серия дней */}
      <span className="flex items-center gap-0.5">
        <Flame className={`w-4 h-4 ${state.streakDays > 0 ? 'text-amber-500' : 'text-qz-text-muted'}`} />
        <span className="text-xs font-semibold text-foreground tabular-nums">{state.streakDays}</span>
      </span>

      {/* Дневная цель */}
      <span className="hidden sm:flex relative items-center justify-center">
        <GoalRing progress={state.dailyProgress} goal={state.dailyGoal} />
        <span className="absolute text-[8px] font-bold text-foreground tabular-nums">{goalPct}</span>
      </span>
    </Link>
  );
}
