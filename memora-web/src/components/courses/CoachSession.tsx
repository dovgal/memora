'use client';
// Коуч-режим v2: персональный тренер по курсу.
//
// Что умеет:
// - Стартовый экран с планом на сегодня: повторения по сроку (FSRS), новый материал,
//   лексика, серия дней (streak) и настраиваемая дневная цель.
// - Очередь: сначала просроченные повторения, затем новые упражнения и слова.
// - Автооценка: упражнения сами сообщают долю правильных ответов, тренер ставит
//   рейтинг FSRS автоматически (его можно поменять вручную).
// - ИИ-тьютор «Не понял — объясни» для любого упражнения.
// - После сессии — дополнительная ИИ-практика по слабым местам.

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Brain, Loader2, CheckCircle2, ChevronLeft, Trophy, RotateCcw, Flame,
  HelpCircle, Sparkles, Play, BookOpen, GraduationCap, X,
} from 'lucide-react';
import type { EditoExercise, VocabularyItem, ExerciseResult } from '@/lib/courses/edito-a1';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import { VocabQuiz } from '@/components/courses/VocabQuiz';
import {
  getCoachReviews, recordCoachReview, getCoachStats, explainExercise, generatePractice,
  type CoachReviewEntry, type CoachStats,
} from '@/lib/courses/customCoursesApi';

export interface CoachUnit {
  id: string;
  title: string;
  exercises: EditoExercise[];
  vocabulary?: VocabularyItem[];
}

type Rating = 1 | 2 | 3 | 4;

interface QueueItem {
  unitId: string;
  unitTitle: string;
  kind: 'exercise' | 'vocab';
  exercise?: EditoExercise;
  vocab?: VocabularyItem;
  /** id, под которым элемент трекается в FSRS */
  trackId: string;
  isReview: boolean;
  /** Бонусная ИИ-практика — не записывается в FSRS */
  ephemeral?: boolean;
}

interface Props {
  courseId: string;
  courseTitle: string;
  units: CoachUnit[];
  backHref: string;
  /** Для ИИ-генерации практики */
  language?: string;
  level?: string;
}

const RATings_LABELS: Record<Rating, string> = { 1: 'Снова', 2: 'Трудно', 3: 'Хорошо', 4: 'Легко' };

const RATINGS: Array<{ value: Rating; label: string; hint: string; cls: string }> = [
  { value: 1, label: 'Снова', hint: 'не получилось', cls: 'border-red-500/40 text-red-400 hover:bg-red-500/10' },
  { value: 2, label: 'Трудно', hint: 'с ошибками', cls: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
  { value: 3, label: 'Хорошо', hint: 'почти уверенно', cls: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' },
  { value: 4, label: 'Легко', hint: 'без усилий', cls: 'border-[#4255ff]/40 text-[#4255ff] hover:bg-[#4255ff]/10' },
];

function autoRating(result: ExerciseResult): Rating {
  if (result.total <= 0) return 3;
  const pct = result.correct / result.total;
  if (pct >= 0.999) return 4;
  if (pct >= 0.7) return 3;
  if (pct >= 0.4) return 2;
  return 1;
}

export function CoachSession({ courseId, courseTitle, units, backHref, language, level }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [reviews, setReviews] = useState<CoachReviewEntry[] | null>(null);
  const [stats, setStats] = useState<CoachStats | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'start' | 'session' | 'done'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState({ completed: 0, again: 0 });
  const [attempt, setAttempt] = useState(0);

  // Результат текущего упражнения и предложенная тренером оценка
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  // ИИ-тьютор
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);

  // Доп. практика
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  // Слабые элементы текущей сессии (рейтинг 1-2) — для доп. практики
  const [weakTrackIds, setWeakTrackIds] = useState<Set<string>>(new Set());

  // Дневная цель: сколько нового материала за сессию
  const goalKey = `coach-goal-${courseId}`;
  const [newGoal, setNewGoal] = useState(6);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(goalKey);
      if (saved) setNewGoal(Math.max(0, Math.min(20, parseInt(saved, 10) || 6)));
    } catch { /* приватный режим */ }
  }, [goalKey]);
  const saveGoal = (n: number) => {
    setNewGoal(n);
    try { localStorage.setItem(goalKey, String(n)); } catch { /* ignore */ }
  };

  // Все элементы курса: интерактивные упражнения + лексика
  const allItems = useMemo(() => {
    const list: QueueItem[] = [];
    for (const u of units) {
      for (const ex of u.exercises) {
        if (ex.type !== 'theory') {
          list.push({ unitId: u.id, unitTitle: u.title, kind: 'exercise', exercise: ex, trackId: ex.id, isReview: false });
        }
      }
      for (const v of u.vocabulary ?? []) {
        if (v.fr && v.ru) {
          list.push({ unitId: u.id, unitTitle: u.title, kind: 'vocab', vocab: v, trackId: `vocab:${v.fr}`, isReview: false });
        }
      }
    }
    return list;
  }, [units]);

  const vocabPool = useMemo(() => units.flatMap(u => u.vocabulary ?? []), [units]);

  // Раздельные пулы: к повторению / новое
  const pools = useMemo(() => {
    if (!reviews) return { due: [] as QueueItem[], fresh: [] as QueueItem[] };
    const now = Date.now();
    const byKey = new Map<string, CoachReviewEntry>();
    for (const r of reviews) byKey.set(`${r.unitId}::${r.exerciseId}`, r);

    const due: QueueItem[] = [];
    const fresh: QueueItem[] = [];
    for (const item of allItems) {
      const r = byKey.get(`${item.unitId}::${item.trackId}`);
      if (!r) fresh.push({ ...item, isReview: false });
      else if (new Date(r.due).getTime() <= now) due.push({ ...item, isReview: true });
    }
    return { due, fresh };
  }, [reviews, allItems]);

  useEffect(() => {
    if (!idToken) return;
    Promise.allSettled([
      getCoachReviews(courseId, idToken),
      getCoachStats(courseId, idToken),
    ]).then(([revRes, statRes]) => {
      setReviews(revRes.status === 'fulfilled' ? revRes.value : []);
      if (statRes.status === 'fulfilled') setStats(statRes.value);
      setPhase('start');
    });
  }, [idToken, courseId]);

  const startSession = () => {
    const due = pools.due.slice(0, 30);
    const fresh = pools.fresh.slice(0, newGoal);
    const q = [...due, ...fresh];
    if (q.length === 0) return;
    setQueue(q);
    setIndex(0);
    setSessionStats({ completed: 0, again: 0 });
    setWeakTrackIds(new Set());
    resetItemState();
    setPhase('session');
  };

  const resetItemState = () => {
    setExerciseDone(false);
    setLastResult(null);
    setManualMode(false);
    setExplainOpen(false);
    setExplainText(null);
    setAttempt(a => a + 1);
  };

  const current = queue[index];
  const suggested: Rating | null = lastResult ? autoRating(lastResult) : null;

  const advance = (nextQueue: QueueItem[]) => {
    if (index + 1 >= nextQueue.length) {
      setPhase('done');
      // Обновим серию/статистику после сессии
      if (idToken) getCoachStats(courseId, idToken).then(setStats).catch(() => {});
    } else {
      setIndex(i => i + 1);
      resetItemState();
    }
  };

  const handleRate = async (rating: Rating) => {
    if (!current || submitting) return;
    setSubmitting(true);

    if (!current.ephemeral) {
      try {
        await recordCoachReview(courseId, current.unitId, current.trackId, rating, idToken);
      } catch { /* офлайн — продолжаем */ }
    }

    if (rating <= 2) {
      setWeakTrackIds(prev => new Set(prev).add(`${current.unitId}::${current.trackId}`));
    }

    setSessionStats(s => ({
      completed: s.completed + (rating >= 3 ? 1 : 0),
      again: s.again + (rating === 1 ? 1 : 0),
    }));

    let nextQueue = queue;
    if (rating === 1) {
      nextQueue = [...queue, { ...current }];
      setQueue(nextQueue);
    }

    advance(nextQueue);
    setSubmitting(false);
  };

  const handleExplain = async () => {
    if (!current || explainBusy) return;
    setExplainOpen(true);
    if (explainText) return;
    setExplainBusy(true);
    try {
      const payload = current.kind === 'vocab'
        ? { type: 'vocabulary', word: current.vocab?.fr, translation: current.vocab?.ru }
        : current.exercise;
      const res = await explainExercise(payload, undefined, undefined, idToken);
      setExplainText(res.explanation);
    } catch {
      setExplainText('Не удалось получить объяснение. Попробуйте ещё раз чуть позже.');
    } finally {
      setExplainBusy(false);
    }
  };

  const startPractice = async () => {
    if (!idToken || practiceBusy) return;
    setPracticeBusy(true);
    setPracticeError(null);
    try {
      // Слабые упражнения: из этой сессии + накопленные lapses из reviews
      const lapsedKeys = new Set<string>(weakTrackIds);
      for (const r of reviews ?? []) {
        if (r.lapses > 0) lapsedKeys.add(`${r.unitId}::${r.exerciseId}`);
      }
      const weakExercises = allItems
        .filter(it => it.kind === 'exercise' && lapsedKeys.has(`${it.unitId}::${it.trackId}`))
        .map(it => it.exercise)
        .slice(0, 6);

      if (weakExercises.length === 0) {
        setPracticeError('Слабых мест не найдено — отличная работа!');
        setPracticeBusy(false);
        return;
      }

      const { exercises } = await generatePractice(weakExercises, language, level, 4, idToken);
      const bonus: QueueItem[] = (exercises ?? [])
        .filter(ex => ex && ex.id && ex.type)
        .map(ex => ({
          unitId: 'practice',
          unitTitle: 'Доп. практика',
          kind: 'exercise' as const,
          exercise: ex,
          trackId: ex.id,
          isReview: false,
          ephemeral: true,
        }));

      if (bonus.length === 0) {
        setPracticeError('Не удалось сгенерировать практику. Попробуйте ещё раз.');
        setPracticeBusy(false);
        return;
      }

      setQueue(bonus);
      setIndex(0);
      resetItemState();
      setPhase('session');
    } catch (e) {
      setPracticeError(e instanceof Error ? e.message : 'Ошибка генерации');
    } finally {
      setPracticeBusy(false);
    }
  };

  // Сводное усвоение
  const mastery = useMemo(() => {
    if (!reviews) return { learned: 0, total: allItems.length };
    const learnedKeys = new Set(
      reviews.filter(r => r.state === 2).map(r => `${r.unitId}::${r.exerciseId}`)
    );
    let learned = 0;
    for (const item of allItems) {
      if (learnedKeys.has(`${item.unitId}::${item.trackId}`)) learned++;
    }
    return { learned, total: allItems.length };
  }, [reviews, allItems]);

  // ---------- Рендеринг ----------

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (phase === 'start') {
    const dueCount = pools.due.length;
    const freshCount = pools.fresh.length;
    const planned = Math.min(dueCount, 30) + Math.min(freshCount, newGoal);
    const estMinutes = Math.max(1, Math.round(planned * 1.2));
    const masteryPct = mastery.total > 0 ? Math.round((mastery.learned / mastery.total) * 100) : 0;

    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-6">
            <ChevronLeft className="w-4 h-4" /> {courseTitle}
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
              <Brain className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Тренировка на сегодня</h1>
              <p className="text-qz-text-muted text-sm">Коуч ведёт вас по курсу до полного усвоения</p>
            </div>
          </div>

          {/* Сегодняшний план */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <Flame className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats?.streakDays ?? 0}</p>
              <p className="text-qz-text-muted text-xs">дней подряд</p>
            </div>
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <RotateCcw className="w-5 h-5 text-[#4255ff] mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{dueCount}</p>
              <p className="text-qz-text-muted text-xs">к повторению</p>
            </div>
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <BookOpen className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{Math.min(freshCount, newGoal)}</p>
              <p className="text-qz-text-muted text-xs">нового</p>
            </div>
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <GraduationCap className="w-5 h-5 text-[#ffcd1f] mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{masteryPct}%</p>
              <p className="text-qz-text-muted text-xs">усвоено</p>
            </div>
          </div>

          {/* Цель */}
          <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-semibold">Новых элементов за сессию</span>
              <span className="text-[#4255ff] font-bold">{newGoal}</span>
            </div>
            <input
              type="range" min={0} max={20} value={newGoal}
              onChange={e => saveGoal(parseInt(e.target.value, 10))}
              className="w-full accent-[#4255ff]"
            />
            <p className="text-qz-text-muted text-xs mt-2">
              Сегодня выполнено повторений: {stats?.todayReviews ?? 0}. Примерное время сессии: ~{estMinutes} мин.
            </p>
          </div>

          {planned === 0 ? (
            <div className="text-center py-6">
              <Trophy className="w-10 h-10 text-[#ffcd1f] mx-auto mb-3" />
              <p className="text-foreground font-semibold mb-1">Всё повторено!</p>
              <p className="text-qz-text-muted text-sm mb-4">
                Нет материала к изучению — тренер позовёт вас, когда придёт срок повторения.
              </p>
              <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">← Вернуться к курсу</Link>
            </div>
          ) : (
            <button
              onClick={startSession}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base px-6 py-4 rounded-2xl transition-colors"
            >
              <Play className="w-5 h-5" /> Начать тренировку ({planned})
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const pct = mastery.total > 0 ? Math.round((mastery.learned / mastery.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Сессия завершена!</h1>
          <p className="text-qz-text-muted text-sm mb-2">
            Выполнено уверенно: {sessionStats.completed} · Отправлено на повтор: {sessionStats.again}
          </p>
          {stats && (
            <p className="text-amber-400 text-sm mb-6 flex items-center justify-center gap-1.5">
              <Flame className="w-4 h-4" /> Серия: {stats.streakDays} дн. · Сегодня: {stats.todayReviews} повторений
            </p>
          )}
          <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-medium">Усвоение курса</span>
              <span className="text-qz-text-muted text-xs">{mastery.learned} / {mastery.total}</span>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {practiceError && <p className="text-amber-400 text-sm mb-4">{practiceError}</p>}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startPractice}
              disabled={practiceBusy}
              className="inline-flex items-center gap-2 bg-[#ffcd1f] hover:brightness-110 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              {practiceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {practiceBusy ? 'Генерация…' : 'Ещё практика по слабым местам'}
            </button>
            <button
              onClick={() => { setPhase('start'); if (idToken) getCoachReviews(courseId, idToken).then(setReviews).catch(() => {}); }}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Ещё сессия
            </button>
            <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">К курсу</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Активная сессия ----------

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center justify-between mb-6">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {courseTitle}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
            <Brain className="w-4 h-4" /> Коуч-режим
          </span>
        </div>

        {/* Прогресс сессии */}
        <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground text-sm font-medium flex items-center gap-2">
              {current?.ephemeral
                ? <><Sparkles className="w-4 h-4 text-[#ffcd1f]" /> Доп. практика</>
                : current?.isReview
                  ? <><Flame className="w-4 h-4 text-amber-400" /> Повторение</>
                  : <>Новый материал</>}
              <span className="text-qz-text-muted font-normal text-xs">· {current?.unitTitle}</span>
            </span>
            <span className="text-qz-text-muted text-xs">{index + 1} / {queue.length}</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((index / queue.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* Текущий элемент */}
        {current && current.kind === 'vocab' && current.vocab && (
          <VocabQuiz
            key={`${current.trackId}-${attempt}`}
            item={current.vocab}
            pool={vocabPool}
            onComplete={(result) => { setExerciseDone(true); setLastResult(result ?? null); }}
          />
        )}
        {current && current.kind === 'exercise' && current.exercise && (
          <ExerciseRenderer
            key={`${current.unitId}-${current.trackId}-${attempt}`}
            exercise={current.exercise}
            onComplete={(_id, result) => { setExerciseDone(true); setLastResult(result ?? null); }}
          />
        )}

        {/* ИИ-тьютор */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleExplain}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-[#4255ff] text-xs font-semibold transition-colors"
          >
            <HelpCircle className="w-4 h-4" /> Не понимаю — объясни
          </button>
        </div>
        {explainOpen && (
          <div className="mt-3 bg-[#4255ff]/5 border border-[#4255ff]/30 rounded-2xl p-4 relative">
            <button onClick={() => setExplainOpen(false)} className="absolute top-3 right-3 text-qz-text-muted hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4255ff] mb-2">ИИ-тьютор</p>
            {explainBusy
              ? <p className="text-qz-text-muted text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Готовлю объяснение…</p>
              : <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{explainText}</p>}
          </div>
        )}

        {/* Оценка */}
        <div className="mt-6">
          {exerciseDone ? (
            <div className="bg-qz-card border border-border rounded-2xl p-5">
              {suggested && !manualMode ? (
                <>
                  <p className="text-foreground text-sm font-semibold mb-1">
                    Оценка тренера: <span className={
                      suggested >= 3 ? 'text-emerald-400' : suggested === 2 ? 'text-amber-400' : 'text-red-400'
                    }>{RATings_LABELS[suggested]}</span>
                    {lastResult && <span className="text-qz-text-muted font-normal text-xs"> · {lastResult.correct} из {lastResult.total} верно</span>}
                  </p>
                  <p className="text-qz-text-muted text-xs mb-4">
                    {suggested === 1 && 'Упражнение вернётся ещё раз в этой сессии.'}
                    {suggested === 2 && 'Повторим скоро, чтобы закрепить.'}
                    {suggested === 3 && 'Отлично! Следующее повторение — через несколько дней.'}
                    {suggested === 4 && 'Блестяще! Интервал повторения увеличен.'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRate(suggested)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Далее
                    </button>
                    <button onClick={() => setManualMode(true)} className="text-qz-text-muted hover:text-foreground text-xs underline">
                      Изменить оценку
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-foreground text-sm font-semibold mb-3">Насколько легко далось это упражнение?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {RATINGS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => handleRate(r.value)}
                        disabled={submitting}
                        className={`border rounded-xl px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${r.cls}`}
                      >
                        {r.label}
                        <span className="block text-[10px] font-normal opacity-70">{r.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-qz-text-muted text-xs text-center">Выполните упражнение, чтобы перейти дальше.</p>
          )}
        </div>
      </div>
    </div>
  );
}
