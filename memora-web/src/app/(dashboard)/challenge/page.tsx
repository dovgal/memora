'use client';
// «Разговор дня»: пять минут разговора с собеседником-моделью по сегодняшней
// ситуации. Сам разговор — тот же AiTalk, что в курсах (роль, задачи,
// подсказки спрятаны до просьбы). Здесь поверх него — мягкий таймер, счёт
// своих реплик и кнопка «Завершить», которая открывается, когда разговор
// действительно состоялся (4 реплики или 3 минуты — как проверяет сервер).
//
// Таймер стартует с первой своей реплики, а не с открытия страницы: иначе
// «3 минуты» набирались бы, пока человек читает задание или ищет наушники.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Clock, Flame, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import { AiTalk } from '@/components/edito/AiTalk';
import type { EditoExercise } from '@/lib/courses/edito-a1';
import { getTodayChallenge, completeChallenge, type TodayChallenge, type CompleteResult } from '@/lib/challenge/client';
import {
  canFinish, remainingHint, formatClock, timerProgress, praiseFor, pluralRu, TARGET_MINUTES,
} from '@/lib/challenge/rules';
import { celebrate } from '@/lib/game/celebrationBus';
import { emitFox } from '@/lib/fox/bus';

interface Summary {
  result: CompleteResult;
  turns: number;
  minutes: number;
  praise: string;
}

export default function ChallengePage() {
  const [today, setToday] = useState<TodayChallenge | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [turns, setTurns] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [allGoals, setAllGoals] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const notifiedTarget = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getTodayChallenge().then(t => {
      if (cancelled) return;
      if (t) setToday(t); else setLoadFailed(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Тикаем раз в секунду, только пока идёт разговор.
  useEffect(() => {
    if (startedAt === null || summary) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startedAt, summary]);

  const elapsedMs = startedAt === null ? 0 : Math.max(0, now - startedAt);
  const threshold = today ? { minTurns: today.minTurns, minMinutes: today.minMinutes } : undefined;
  const ready = canFinish(turns, elapsedMs, threshold);

  // Пять минут прошли — мягко сказать об этом один раз, но не обрывать.
  useEffect(() => {
    if (notifiedTarget.current || summary) return;
    if (elapsedMs >= TARGET_MINUTES * 60_000) {
      notifiedTarget.current = true;
      emitFox({ type: 'say', text: 'Пять минут! Можно завершать — или поговорить ещё' });
    }
  }, [elapsedMs, summary]);

  const exercise: EditoExercise | null = useMemo(() => {
    if (!today) return null;
    const c = today.challenge;
    return {
      id: `challenge-${c.id}`,
      type: 'ai-talk',
      title: c.title,
      role: c.role,
      situation: c.situation,
      goals: c.goals,
      hints: c.hints,
      talkLevel: c.level,
    };
  }, [today]);

  const onTurn = useCallback(() => {
    setTurns(t => t + 1);
    setStartedAt(s => s ?? Date.now());
    setNow(Date.now());
  }, []);

  const onAllGoals = useCallback(() => setAllGoals(true), []);

  const finish = async () => {
    if (!today || !ready || finishing) return;
    setFinishing(true);
    setFinishError(null);
    const minutes = Math.round((elapsedMs / 60_000) * 10) / 10;
    const r = await completeChallenge({ challengeId: today.challenge.id, turns, minutes });
    setFinishing(false);
    if (!r.ok) { setFinishError(r.error); return; }
    const praise = praiseFor(turns, minutes, allGoals);
    celebrate(r.result.update);
    emitFox({ type: 'session_end', correct: turns, total: turns, say: praise });
    setSummary({ result: r.result, turns, minutes, praise });
  };

  if (loadFailed) {
    return (
      <Shell>
        <p className="text-qz-text-muted text-sm">Не получилось загрузить разговор дня. Обновите страницу чуть позже.</p>
      </Shell>
    );
  }

  if (!today || !exercise) {
    return (
      <Shell>
        <Loader2 className="w-5 h-5 animate-spin text-qz-text-muted" />
      </Shell>
    );
  }

  const c = today.challenge;

  if (summary) {
    const xp = summary.result.update?.xpGained ?? 0;
    const streak = summary.result.streakDays;
    return (
      <Shell>
        <div className="rounded-3xl border border-emerald-500/40 bg-gradient-to-br from-emerald-900/30 via-teal-900/10 to-transparent p-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-qz-text">{summary.praise}</h2>
          <p className="text-sm text-qz-text-muted">
            «{c.title}»: {summary.turns} {pluralRu(summary.turns, 'реплика', 'реплики', 'реплик')}
            {summary.minutes > 0 && <>, {formatClock(summary.minutes * 60_000)} разговора</>}.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap text-sm font-semibold">
            {summary.result.alreadyDone ? (
              <span className="text-qz-text-muted">Сегодняшний разговор уже был засчитан раньше</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#4255ff]"><Sparkles className="w-4 h-4" /> +{xp} XP</span>
            )}
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-orange-400">
                <Flame className="w-4 h-4" /> {streak} {pluralRu(streak, 'день', 'дня', 'дней')} подряд
              </span>
            )}
          </div>
          <p className="text-xs text-qz-text-muted">Завтра будет новая ситуация.</p>
          <Link href="/dashboard" className="inline-block mt-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors">
            На главную
          </Link>
        </div>
      </Shell>
    );
  }

  const progress = timerProgress(elapsedMs);
  const overTarget = elapsedMs >= TARGET_MINUTES * 60_000;
  const hint = remainingHint(turns, elapsedMs, threshold);

  return (
    <Shell>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Разговор дня</span>
        <span className="text-[11px] font-semibold text-qz-text-muted border border-border rounded-full px-2 py-0.5">{c.level}</span>
        {today.streakDays > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400">
            <Flame className="w-3 h-3" /> {today.streakDays} {pluralRu(today.streakDays, 'день', 'дня', 'дней')} подряд
          </span>
        )}
      </div>
      <p className="text-sm text-qz-text-muted">
        Собеседник: <b className="text-qz-text">{c.role}</b>. Говорите голосом или пишите — главное, по-французски.
      </p>

      {today.done && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" /> Сегодня вы уже поговорили. Можно повторить для практики — опыт второй раз не начисляется.
        </div>
      )}

      {/* Мягкий таймер: показывает, сколько идёт разговор, и не обрывает его. */}
      <div className="rounded-2xl border border-border bg-qz-card p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 text-qz-text-muted">
            <Clock className="w-4 h-4" />
            {startedAt === null ? 'Таймер пойдёт с первой вашей реплики' : (
              <><b className="text-qz-text tabular-nums">{formatClock(elapsedMs)}</b> из {TARGET_MINUTES}:00</>
            )}
          </span>
          <span className="inline-flex items-center gap-1.5 text-qz-text-muted">
            <MessageCircle className="w-4 h-4" /> {turns} {pluralRu(turns, 'реплика', 'реплики', 'реплик')}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-qz-bg overflow-hidden">
          <div
            className={`h-full rounded-full transition-[width] duration-1000 ${overTarget ? 'bg-emerald-500' : 'bg-rose-400'}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        {overTarget && <p className="text-xs text-emerald-400">Пять минут позади — можно завершать или продолжить.</p>}
      </div>

      <AiTalk exercise={exercise} onTurn={onTurn} onComplete={onAllGoals} />

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => void finish()}
          disabled={!ready || finishing}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/40 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Завершить
        </button>
        {hint && <span className="text-xs text-qz-text-muted">{hint}</span>}
        {allGoals && <span className="text-xs text-emerald-400">Все задачи выполнены!</span>}
      </div>
      {finishError && <p className="text-red-500 text-sm">{finishError}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-qz-bg text-qz-text">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-8 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl border border-border text-qz-text-muted hover:text-qz-text" aria-label="На главную">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-bold">Разговор дня</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
