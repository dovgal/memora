'use client';
// Коуч-режим: персональный тренер по курсу.
// Алгоритм: сначала упражнения, у которых подошло время повторения (FSRS),
// затем новые — до тех пор, пока весь материал не будет усвоен (state=Review).
// После каждого упражнения учащийся оценивает, насколько легко далось:
// Снова / Трудно / Хорошо / Легко — это управляет интервалом следующего повторения.

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Brain, Loader2, CheckCircle2, ChevronLeft, Trophy, RotateCcw, Flame,
} from 'lucide-react';
import type { EditoExercise } from '@/lib/courses/edito-a1';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import {
  getCoachReviews, recordCoachReview,
  type CoachReviewEntry,
} from '@/lib/courses/customCoursesApi';

export interface CoachUnit {
  id: string;
  title: string;
  exercises: EditoExercise[];
}

interface QueueItem {
  unitId: string;
  unitTitle: string;
  exercise: EditoExercise;
  isReview: boolean;
}

interface Props {
  courseId: string;
  courseTitle: string;
  units: CoachUnit[];
  backHref: string;
  sessionLimit?: number;
}

const RATINGS: Array<{ value: 1 | 2 | 3 | 4; label: string; hint: string; cls: string }> = [
  { value: 1, label: 'Снова', hint: 'не получилось', cls: 'border-red-500/40 text-red-400 hover:bg-red-500/10' },
  { value: 2, label: 'Трудно', hint: 'с ошибками', cls: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
  { value: 3, label: 'Хорошо', hint: 'почти уверенно', cls: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' },
  { value: 4, label: 'Легко', hint: 'без усилий', cls: 'border-[#4255ff]/40 text-[#4255ff] hover:bg-[#4255ff]/10' },
];

export function CoachSession({ courseId, courseTitle, units, backHref, sessionLimit = 12 }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [reviews, setReviews] = useState<CoachReviewEntry[] | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'session' | 'empty' | 'done'>('loading');
  const [exerciseDone, setExerciseDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState({ completed: 0, again: 0 });
  // Ключ перемонтирования упражнения (для «Снова» — упражнение вернётся в конец очереди)
  const [attempt, setAttempt] = useState(0);

  // Все интерактивные упражнения курса (теория не оценивается тренером)
  const allInteractive = useMemo(() => {
    const list: Array<{ unitId: string; unitTitle: string; exercise: EditoExercise }> = [];
    for (const u of units) {
      for (const ex of u.exercises) {
        if (ex.type !== 'theory') list.push({ unitId: u.id, unitTitle: u.title, exercise: ex });
      }
    }
    return list;
  }, [units]);

  const buildQueue = useCallback((revs: CoachReviewEntry[]) => {
    const now = Date.now();
    const byKey = new Map<string, CoachReviewEntry>();
    for (const r of revs) byKey.set(`${r.unitId}::${r.exerciseId}`, r);

    const due: QueueItem[] = [];
    const fresh: QueueItem[] = [];
    for (const item of allInteractive) {
      const r = byKey.get(`${item.unitId}::${item.exercise.id}`);
      if (!r) {
        fresh.push({ ...item, isReview: false });
      } else if (new Date(r.due).getTime() <= now) {
        due.push({ ...item, isReview: true });
      }
    }
    // Сначала повторения (по сроку), затем новый материал по порядку курса.
    return [...due, ...fresh].slice(0, sessionLimit);
  }, [allInteractive, sessionLimit]);

  useEffect(() => {
    if (!idToken) return;
    getCoachReviews(courseId, idToken)
      .then(revs => {
        setReviews(revs);
        const q = buildQueue(revs);
        setQueue(q);
        setPhase(q.length === 0 ? 'empty' : 'session');
      })
      .catch(() => {
        // Без записей коуч всё равно работает: всё считается новым.
        setReviews([]);
        const q = buildQueue([]);
        setQueue(q);
        setPhase(q.length === 0 ? 'empty' : 'session');
      });
  }, [idToken, courseId, buildQueue]);

  const current = queue[index];

  const handleRate = async (rating: 1 | 2 | 3 | 4) => {
    if (!current || submitting) return;
    setSubmitting(true);
    try {
      await recordCoachReview(courseId, current.unitId, current.exercise.id, rating, idToken);
    } catch { /* офлайн — продолжаем сессию */ }

    setSessionStats(s => ({
      completed: s.completed + (rating >= 3 ? 1 : 0),
      again: s.again + (rating === 1 ? 1 : 0),
    }));

    let nextQueue = queue;
    if (rating === 1) {
      // «Снова» — вернуть упражнение в конец очереди этой же сессии.
      nextQueue = [...queue, { ...current }];
      setQueue(nextQueue);
    }

    if (index + 1 >= nextQueue.length) {
      setPhase('done');
    } else {
      setIndex(i => i + 1);
      setExerciseDone(false);
      setAttempt(a => a + 1);
    }
    setSubmitting(false);
  };

  // Сводная статистика усвоения
  const mastery = useMemo(() => {
    if (!reviews) return { learned: 0, total: allInteractive.length };
    const learnedKeys = new Set(
      reviews.filter(r => r.state === 2).map(r => `${r.unitId}::${r.exerciseId}`)
    );
    let learned = 0;
    for (const item of allInteractive) {
      if (learnedKeys.has(`${item.unitId}::${item.exercise.id}`)) learned++;
    }
    return { learned, total: allInteractive.length };
  }, [reviews, allInteractive]);

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <Trophy className="w-12 h-12 text-[#ffcd1f] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Всё повторено!</h1>
          <p className="text-qz-text-muted text-sm mb-6">
            Сейчас нет упражнений к повторению — тренер позовёт вас, когда придёт время.
            Усвоено {mastery.learned} из {mastery.total} упражнений курса.
          </p>
          <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">← Вернуться к курсу</Link>
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
          <p className="text-qz-text-muted text-sm mb-6">
            Выполнено уверенно: {sessionStats.completed} · Отправлено на повтор: {sessionStats.again}
          </p>
          <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-medium">Усвоение курса</span>
              <span className="text-qz-text-muted text-xs">{mastery.learned} / {mastery.total}</span>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-qz-text-muted text-xs mt-2">
              Упражнение считается усвоенным, когда FSRS переводит его в долговременное повторение.
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => window.location.reload()}
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
              {current?.isReview
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

        {/* Текущее упражнение */}
        {current && (
          <ExerciseRenderer
            key={`${current.unitId}-${current.exercise.id}-${attempt}`}
            exercise={current.exercise}
            onComplete={() => setExerciseDone(true)}
          />
        )}

        {/* Оценка */}
        <div className="mt-6">
          {exerciseDone ? (
            <div className="bg-qz-card border border-border rounded-2xl p-5">
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
              <p className="text-qz-text-muted text-xs mt-3">
                Оценка определяет, когда тренер предложит это упражнение снова: «Снова» — сразу в этой сессии, «Легко» — через несколько дней.
              </p>
            </div>
          ) : (
            <p className="text-qz-text-muted text-xs text-center">Выполните упражнение, чтобы оценить его и перейти дальше.</p>
          )}
        </div>
      </div>
    </div>
  );
}
