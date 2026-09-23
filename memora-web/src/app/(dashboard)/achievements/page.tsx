'use client';
// Достижения и семейная неделя: уровень, серия с заморозками, цель дня,
// каталог достижений (открытые и ещё нет) и табло семьи по XP за 7 дней.
// Табло по неделе, а не за всё время — так у младших есть шанс обогнать
// старших, которые занимаются дольше; общий зачёт живёт в /family.

import { useEffect, useState } from 'react';
import { Award, Flame, Loader2, Snowflake, Target, Lock, Users } from 'lucide-react';
import {
  getGameState, getFamilyGameBoard,
  type GameState, type FamilyGameMember,
} from '@/lib/game/client';
import { SoundToggle } from '@/components/game/SoundToggle';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'дня';
  return 'дней';
}

export default function AchievementsPage() {
  const [state, setState] = useState<GameState | null>(null);
  const [family, setFamily] = useState<FamilyGameMember[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getGameState().then(s => {
      if (cancelled) return;
      if (s) setState(s); else setFailed(true);
    });
    getFamilyGameBoard().then(f => { if (!cancelled) setFamily(f); });
    return () => { cancelled = true; };
  }, []);

  const unlockedCount = state?.achievements.filter(a => a.unlocked).length ?? 0;
  const xpPct = state && state.xpForNextLevel > 0 ? Math.min(100, (state.xpIntoLevel / state.xpForNextLevel) * 100) : 0;
  const goalPct = state && state.dailyGoal > 0 ? Math.min(100, (state.dailyProgress / state.dailyGoal) * 100) : 0;

  return (
    <div className="min-h-full bg-qz-bg text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#4255ff]/15 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6 text-[#4255ff]" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-qz-text">Достижения</h1>
            <p className="text-qz-text-muted text-sm">Опыт, серия дней и то, что уже получилось</p>
          </div>
          <SoundToggle withLabel className="shrink-0 px-3 py-1.5 rounded-full border border-qz-border text-qz-text-muted hover:text-qz-text transition-colors" />
        </div>

        {!state ? (
          failed ? (
            <p className="text-qz-text-muted text-sm text-center py-10">Не удалось загрузить прогресс. Обновите страницу чуть позже.</p>
          ) : (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-qz-text-muted" /></div>
          )
        ) : (
          <>
            {/* Сводка: уровень, серия, цель дня */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <div className="bg-qz-card border border-qz-border rounded-2xl p-4">
                <p className="text-qz-text-muted text-xs font-medium mb-1">Уровень</p>
                <p className="text-2xl font-bold text-qz-text">{state.level}</p>
                <div className="mt-2 h-2 rounded-full bg-qz-border-light overflow-hidden">
                  <div className="h-full bg-[#4255ff] transition-[width] duration-500" style={{ width: `${xpPct}%` }} />
                </div>
                <p className="text-qz-text-muted text-xs mt-1.5 tabular-nums">
                  {state.xpIntoLevel} / {state.xpForNextLevel} XP до следующего · всего {state.xp.toLocaleString('ru-RU')}
                </p>
              </div>

              <div className="bg-qz-card border border-qz-border rounded-2xl p-4">
                <p className="text-qz-text-muted text-xs font-medium mb-1">Серия</p>
                <p className="text-2xl font-bold text-qz-text flex items-center gap-1.5">
                  <Flame className={`w-6 h-6 ${state.streakDays > 0 ? 'text-amber-500' : 'text-qz-text-muted'}`} />
                  {state.streakDays} <span className="text-base font-semibold">{daysWord(state.streakDays)}</span>
                </p>
                <p className="text-qz-text-muted text-xs mt-1.5 flex items-center gap-1 flex-wrap">
                  <span>рекорд {state.longestStreak}</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-0.5" title="Заморозка спасает серию, если пропущен один день. Даётся за каждые 7 дней подряд, не больше двух.">
                    <Snowflake className="w-3.5 h-3.5 text-sky-500" /> заморозок: {state.freezes}/2
                  </span>
                </p>
              </div>

              <div className="bg-qz-card border border-qz-border rounded-2xl p-4">
                <p className="text-qz-text-muted text-xs font-medium mb-1">Цель дня</p>
                <p className="text-2xl font-bold text-qz-text flex items-center gap-1.5 tabular-nums">
                  <Target className={`w-6 h-6 ${goalPct >= 100 ? 'text-emerald-500' : 'text-[#4255ff]'}`} />
                  {state.dailyProgress}<span className="text-base font-semibold text-qz-text-muted">/{state.dailyGoal} XP</span>
                </p>
                <div className="mt-2 h-2 rounded-full bg-qz-border-light overflow-hidden">
                  <div className={`h-full transition-[width] duration-500 ${goalPct >= 100 ? 'bg-emerald-500' : 'bg-[#4255ff]'}`} style={{ width: `${goalPct}%` }} />
                </div>
                <p className="text-qz-text-muted text-xs mt-1.5">
                  {goalPct >= 100 ? 'На сегодня выполнено' : 'День считается по времени Парижа'}
                </p>
              </div>
            </div>

            {/* Каталог достижений */}
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-lg font-bold text-qz-text">Коллекция</h2>
              <span className="text-qz-text-muted text-sm tabular-nums">{unlockedCount} из {state.achievements.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-8">
              {state.achievements.map(a => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    a.unlocked
                      ? 'bg-qz-card border-amber-500/40'
                      : 'bg-qz-card/60 border-qz-border border-dashed'
                  }`}
                >
                  <span
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                      a.unlocked ? 'bg-amber-500/15' : 'bg-qz-border-light grayscale opacity-50'
                    }`}
                    aria-hidden="true"
                  >
                    {a.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className={`block text-sm font-semibold ${a.unlocked ? 'text-qz-text' : 'text-qz-text-muted'}`}>{a.title}</span>
                    <span className="block text-xs text-qz-text-muted leading-snug">{a.description}</span>
                  </span>
                  {a.unlocked ? (
                    <span className="text-[11px] text-qz-text-muted shrink-0">{formatDate(a.unlockedAt)}</span>
                  ) : (
                    <Lock className="w-4 h-4 text-qz-text-muted shrink-0" aria-label="Ещё не открыто" />
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Семейная неделя */}
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-qz-text-muted" />
          <h2 className="text-lg font-bold text-qz-text">Семья за неделю</h2>
        </div>
        {!family ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-qz-text-muted" /></div>
        ) : family.length === 0 ? (
          <p className="text-qz-text-muted text-sm text-center py-6">Пока никого нет.</p>
        ) : (
          <div className="space-y-2">
            {family.map((m, i) => (
              <div key={m.userId} className="bg-qz-card border border-qz-border rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl w-8 text-center shrink-0">{m.xpThisWeek > 0 ? (MEDALS[i] ?? `${i + 1}.`) : `${i + 1}.`}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-qz-text line-clamp-1">{m.name}</span>
                  <span className="text-qz-text-muted text-xs flex items-center gap-3 mt-0.5">
                    <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-amber-500" />{m.streakDays} {daysWord(m.streakDays)}</span>
                    <span>ур. {m.level}</span>
                  </span>
                </span>
                <span className="text-qz-text font-bold tabular-nums shrink-0">{m.xpThisWeek.toLocaleString('ru-RU')} XP</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-qz-text-muted text-xs mt-6 leading-relaxed">
          Опыт: верный ответ с первой попытки 10 (позже 5) и до +5 за серию верных подряд ·
          хорошее произношение 8 · построенная фраза 15 · упражнение курса 5 ·
          завершённая сессия 20, без ошибок +15. Серия дней держится, если заниматься
          каждый день; один пропуск закрывает заморозка.
        </p>
      </div>
    </div>
  );
}
