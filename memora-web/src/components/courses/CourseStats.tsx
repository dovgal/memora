'use client';
// Отчёт о прогрессе по курсу: усвоение, прогноз повторений, слабые места, серия дней.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Loader2, Flame, BarChart3, CalendarClock, AlertTriangle, GraduationCap, Target,
} from 'lucide-react';
import type { CoachUnit } from '@/components/courses/CoachSession';
import {
  getCoachReviews, getCoachStats, getCoachRatingStats,
  type CoachReviewEntry, type CoachStats as Stats, type ExerciseRatingStats,
} from '@/lib/courses/customCoursesApi';
import { computeSkillMastery, type SkillStatus } from '@/lib/courses/skillMastery';

interface Props {
  courseId: string;
  courseTitle: string;
  units: CoachUnit[];
  backHref: string;
}

const SKILL_STATUS_STYLE: Record<SkillStatus, { label: string; card: string; badge: string }> = {
  weak: { label: 'слабое место', card: 'bg-amber-500/5 border-amber-500/40', badge: 'bg-amber-500/15 text-amber-500' },
  learning: { label: 'изучается', card: 'bg-qz-card border-border', badge: 'bg-[#4255ff]/15 text-[#4255ff]' },
  new: { label: 'новый', card: 'bg-qz-card border-border', badge: 'bg-muted text-qz-text-muted' },
  mastered: { label: 'усвоен', card: 'bg-emerald-500/5 border-emerald-500/30', badge: 'bg-emerald-500/15 text-emerald-500' },
};

export function CourseStats({ courseId, courseTitle, units, backHref }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [reviews, setReviews] = useState<CoachReviewEntry[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [ratingStats, setRatingStats] = useState<ExerciseRatingStats[]>([]);

  useEffect(() => {
    if (!idToken) return;
    getCoachReviews(courseId, idToken).then(setReviews).catch(() => setReviews([]));
    getCoachStats(courseId, idToken).then(setStats).catch(() => {});
    getCoachRatingStats(courseId, idToken).then(setRatingStats).catch(() => {});
  }, [courseId, idToken]);

  // Карта названий элементов: exercise_id -> title
  const titles = useMemo(() => {
    const map = new Map<string, { title: string; unitTitle: string }>();
    for (const u of units) {
      for (const ex of u.exercises) {
        map.set(`${u.id}::${ex.id}`, { title: ex.title, unitTitle: u.title });
      }
      for (const v of u.vocabulary ?? []) {
        map.set(`${u.id}::vocab:${v.fr}`, { title: `${v.fr} — ${v.ru}`, unitTitle: u.title });
      }
    }
    return map;
  }, [units]);

  const analysis = useMemo(() => {
    if (!reviews) return null;

    // Усвоение по юнитам
    const learnedKeys = new Set(reviews.filter(r => r.state === 2).map(r => `${r.unitId}::${r.exerciseId}`));
    const perUnit = units.map(u => {
      const items = [
        ...u.exercises.filter(e => e.type !== 'theory').map(e => `${u.id}::${e.id}`),
        ...(u.vocabulary ?? []).filter(v => v.fr).map(v => `${u.id}::vocab:${v.fr}`),
      ];
      const learned = items.filter(k => learnedKeys.has(k)).length;
      return { unit: u, learned, total: items.length };
    });
    const totalItems = perUnit.reduce((a, p) => a + p.total, 0);
    const totalLearned = perUnit.reduce((a, p) => a + p.learned, 0);

    // Прогноз: повторения на ближайшие 7 дней
    const now = new Date();
    const forecast: Array<{ label: string; count: number }> = [];
    for (let d = 0; d < 7; d++) {
      const dayStart = new Date(now); dayStart.setDate(now.getDate() + d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart); dayEnd.setDate(dayStart.getDate() + 1);
      const count = reviews.filter(r => {
        const due = new Date(r.due);
        return d === 0 ? due < dayEnd : (due >= dayStart && due < dayEnd);
      }).length;
      const label = d === 0 ? 'Сегодня' : d === 1 ? 'Завтра' : dayStart.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' });
      forecast.push({ label, count });
    }
    const maxForecast = Math.max(1, ...forecast.map(f => f.count));

    // Слабые места
    const weak = [...reviews]
      .filter(r => r.lapses > 0)
      .sort((a, b) => b.lapses - a.lapses)
      .slice(0, 10);

    return { perUnit, totalItems, totalLearned, forecast, maxForecast, weak };
  }, [reviews, units]);

  // Карта навыков: группировка прогресса по rule.skill (пусто, если контент не размечен).
  const skills = useMemo(
    () => reviews ? computeSkillMastery(units, reviews, ratingStats) : [],
    [units, reviews, ratingStats],
  );

  if (!analysis) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const masteryPct = analysis.totalItems > 0 ? Math.round((analysis.totalLearned / analysis.totalItems) * 100) : 0;

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-8">

        <div className="flex items-center justify-between">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {courseTitle}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[#4255ff] text-sm font-semibold">
            <BarChart3 className="w-4 h-4" /> Мой прогресс
          </span>
        </div>

        {/* Сводка */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <GraduationCap className="w-5 h-5 text-[#ffcd1f] mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{masteryPct}%</p>
            <p className="text-qz-text-muted text-xs">усвоено</p>
          </div>
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <Flame className="w-5 h-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.streakDays ?? 0}</p>
            <p className="text-qz-text-muted text-xs">дней подряд</p>
          </div>
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <BarChart3 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.todayReviews ?? 0}</p>
            <p className="text-qz-text-muted text-xs">сегодня</p>
          </div>
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <CalendarClock className="w-5 h-5 text-[#4255ff] mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.totalReviews ?? 0}</p>
            <p className="text-qz-text-muted text-xs">всего повторений</p>
          </div>
        </div>

        {/* Усвоение по юнитам */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Усвоение по юнитам</h2>
          <div className="space-y-2.5">
            {analysis.perUnit.map(({ unit, learned, total }) => {
              const pct = total > 0 ? Math.round((learned / total) * 100) : 0;
              return (
                <div key={unit.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-foreground text-sm line-clamp-1">{unit.title}</span>
                    <span className="text-qz-text-muted text-xs shrink-0 ml-3">{learned} / {total}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : 'bg-[#4255ff]'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Карта навыков (только для размеченного контента: rule.skill) */}
        {skills.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">
              <span className="inline-flex items-center gap-1.5"><Target className="w-4 h-4" /> Карта навыков</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {skills.map(s => {
                const style = SKILL_STATUS_STYLE[s.status];
                return (
                  <div key={s.skill} className={`border rounded-xl px-4 py-3 ${style.card}`}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="text-foreground text-sm font-medium line-clamp-1">{s.point ?? s.skill.replace(/-/g, ' ')}</p>
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-qz-text-muted text-xs">
                      {s.learned} / {s.exercises} усвоено
                      {s.attempts > 0 && <> · ошибок {Math.round(s.errorRate * 100)}%</>}
                      {s.status === 'weak' && (
                        <>
                          {' · '}
                          <Link href={`${backHref}/coach`} className="text-amber-500 hover:underline font-semibold">
                            проработать в коуче →
                          </Link>
                        </>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Прогноз повторений */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Повторения на неделю</h2>
          <div className="bg-qz-card border border-border rounded-2xl p-5">
            <div className="flex items-end justify-between gap-2 h-28">
              {analysis.forecast.map((f, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                  <span className="text-foreground text-xs font-semibold mb-1">{f.count > 0 ? f.count : ''}</span>
                  <div
                    className={`w-full max-w-[36px] rounded-t-lg ${i === 0 ? 'bg-amber-400' : 'bg-[#4255ff]/60'}`}
                    style={{ height: `${Math.max(4, Math.round((f.count / analysis.maxForecast) * 80))}%` }}
                  />
                  <span className="text-qz-text-muted text-[10px] mt-1.5">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Слабые места */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Слабые места</h2>
          {analysis.weak.length === 0 ? (
            <p className="text-qz-text-muted text-sm">Пока нет упражнений с повторными ошибками. Так держать!</p>
          ) : (
            <div className="space-y-2">
              {analysis.weak.map((r, i) => {
                const info = titles.get(`${r.unitId}::${r.exerciseId}`);
                return (
                  <div key={i} className="bg-qz-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm line-clamp-1">{info?.title ?? r.exerciseId}</p>
                      <p className="text-qz-text-muted text-xs">{info?.unitTitle ?? r.unitId}</p>
                    </div>
                    <span className="text-amber-400 text-xs font-semibold shrink-0">{r.lapses} ошиб.</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
