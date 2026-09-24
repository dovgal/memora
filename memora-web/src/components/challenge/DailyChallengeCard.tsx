'use client';
// Карточка «Разговор дня» на главной: что за ситуация сегодня, пять минут,
// сделано или нет. Вечером, если разговор ещё не состоялся, лисёнок один раз
// за день напоминает о нём — мягко, одной фразой.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle, Clock, Check, Flame } from 'lucide-react';
import { getTodayChallenge, type TodayChallenge } from '@/lib/challenge/client';
import { shouldNudgeEvening, localDayKey, pluralRu, TARGET_MINUTES } from '@/lib/challenge/rules';
import { emitFox } from '@/lib/fox/bus';

const NUDGE_KEY = 'memora.challenge.nudged';

function readNudgeDay(): string | null {
  try {
    return localStorage.getItem(NUDGE_KEY);
  } catch {
    return null;
  }
}

function markNudged(day: string): void {
  try {
    localStorage.setItem(NUDGE_KEY, day);
  } catch { /* приватный режим — напомним ещё раз, не беда */ }
}

export function DailyChallengeCard() {
  const [today, setToday] = useState<TodayChallenge | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTodayChallenge().then(t => {
      if (cancelled) return;
      if (!t) { setFailed(true); return; }
      setToday(t);
      const now = new Date();
      if (shouldNudgeEvening(now, t.done, readNudgeDay())) {
        markNudged(localDayKey(now));
        // Небольшая пауза: лисёнок в это время ещё здоровается с человеком,
        // и напоминание поверх приветствия потерялось бы.
        window.setTimeout(() => emitFox({ type: 'say', text: 'Разговор дня ещё ждёт — 5 минут?' }), 3500);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Без сервера карточка молчит: пустая рамка на главной хуже, чем ничего.
  if (failed) return null;

  if (!today) {
    return <div className="h-[132px] rounded-3xl border border-border bg-qz-card animate-pulse" aria-hidden />;
  }

  const { challenge, done, streakDays } = today;

  return (
    <Link href="/challenge" className="block group">
      <div className={`relative overflow-hidden rounded-3xl border p-6 transition-all duration-300 hover:scale-[1.005] ${
        done
          ? 'border-emerald-500/40 bg-gradient-to-br from-emerald-900/30 via-teal-900/10 to-transparent'
          : 'border-[#262c40] bg-gradient-to-br from-rose-900/30 via-orange-900/15 to-transparent hover:border-rose-500/50'
      }`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
          }`}>
            {done ? <Check className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${done ? 'text-emerald-400' : 'text-rose-400'}`}>
                Разговор дня
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-qz-text-muted border border-border rounded-full px-2 py-0.5">
                <Clock className="w-3 h-3" /> {TARGET_MINUTES} минут
              </span>
              <span className="text-[11px] font-semibold text-qz-text-muted border border-border rounded-full px-2 py-0.5">
                {challenge.level}
              </span>
              {streakDays > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-400">
                  <Flame className="w-3 h-3" /> {streakDays} {pluralRu(streakDays, 'день', 'дня', 'дней')} подряд
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-qz-text leading-snug">{challenge.title}</h3>
            <p className="text-sm text-qz-text-muted mt-0.5 line-clamp-2">{challenge.situation}</p>
            <span className={`inline-block mt-3 text-sm font-semibold ${
              done ? 'text-emerald-400' : 'text-rose-300 group-hover:text-rose-200'
            }`}>
              {done ? 'Сегодня уже поговорили ✓' : 'Поговорить →'}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
