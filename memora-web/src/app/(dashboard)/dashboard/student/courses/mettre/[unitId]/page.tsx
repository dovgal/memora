'use client';
// Прохождение модуля тренажёра «Mettre & Remettre».
// Прогресс хранится на сервере (courseId 'mettre-remettre').

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, CheckCircle2, Loader2, SkipForward } from 'lucide-react';
import { METTRE_UNITS, METTRE_COURSE_ID } from '@/lib/courses/mettre';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import {
  getCourseProgress, recordExerciseProgress, markUnitKnown,
} from '@/lib/courses/customCoursesApi';

export default function MettreUnitPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = use(params);
  const unit = METTRE_UNITS[unitId];
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    getCourseProgress(METTRE_COURSE_ID, idToken).then(entries => {
      if (cancelled) return;
      const persisted: Record<string, boolean> = {};
      for (const e of entries) if (e.unitId === unitId) persisted[e.exerciseId] = true;
      setCompleted(prev => ({ ...persisted, ...prev }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [unitId, idToken]);

  const handleExerciseComplete = useCallback((exerciseId: string) => {
    setCompleted(prev => {
      if (prev[exerciseId]) return prev;
      return { ...prev, [exerciseId]: true };
    });
    recordExerciseProgress(METTRE_COURSE_ID, unitId, exerciseId, idToken);
  }, [unitId, idToken]);

  const [markingKnown, setMarkingKnown] = useState(false);
  const handleMarkKnown = useCallback(async () => {
    if (!unit || !idToken || markingKnown) return;
    if (!confirm('Отметить весь модуль как уже известный? Коуч поставит длинный интервал повторения.')) return;
    setMarkingKnown(true);
    try {
      const ids = [
        ...unit.exercises.filter(e => e.type !== 'theory').map(e => e.id),
        ...(unit.vocabulary ?? []).filter(v => v.fr).map(v => `vocab:${v.fr}`),
      ];
      await markUnitKnown(METTRE_COURSE_ID, unitId, ids, idToken);
      const all: Record<string, boolean> = {};
      for (const e of unit.exercises) if (e.type !== 'theory') all[e.id] = true;
      setCompleted(all);
    } catch { /* ignore */ }
    setMarkingKnown(false);
  }, [unit, idToken, unitId, markingKnown]);

  const completedCount = Object.keys(completed).length;
  const totalInteractive = unit ? unit.exercises.filter(e => e.type !== 'theory').length : 0;
  const pct = totalInteractive > 0 ? Math.round((completedCount / totalInteractive) * 100) : 100;

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Модуль не найден</p>
        <Link href="/dashboard/student/courses/mettre" className="text-rose-400 hover:underline">
          ← Назад к курсу
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="mb-6">
          <Link href="/dashboard/student/courses/mettre"
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> К списку модулей
          </Link>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">{unit.title}</h1>
              <p className="text-qz-text-muted text-sm">{unit.description}</p>
            </div>
            <button
              onClick={handleMarkKnown}
              disabled={markingKnown}
              className="inline-flex items-center gap-1.5 border border-border hover:border-emerald-500/50 text-qz-text-muted hover:text-emerald-400 text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
              title="Коуч пометит материал модуля усвоенным"
            >
              {markingKnown ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SkipForward className="w-3.5 h-3.5" />}
              Я уже это знаю
            </button>
          </div>
        </div>

        {totalInteractive > 0 && (
          <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-medium">Прогресс</span>
              <span className="text-qz-text-muted text-xs">{completedCount} / {totalInteractive} выполнено</span>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && (
              <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Модуль завершён!
              </p>
            )}
          </div>
        )}

        {/* Выражения модуля */}
        {(unit.vocabulary?.length ?? 0) > 0 && (
          <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
            <h2 className="text-foreground text-sm font-semibold mb-3">Выражения модуля</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {unit.vocabulary!.map((v, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-foreground font-medium">{v.fr}</span>
                  <span className="text-qz-text-muted text-xs text-right">{v.ru}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-5">
          {unit.exercises.map((ex) => (
            <div key={ex.id} className="relative">
              {completed[ex.id] && ex.type !== 'theory' && (
                <div className="absolute -top-2 -right-2 z-10 bg-emerald-500 text-foreground text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 shadow-lg">
                  <CheckCircle2 className="w-3 h-3" /> Выполнено
                </div>
              )}
              <ExerciseRenderer exercise={ex} onComplete={handleExerciseComplete} />
            </div>
          ))}
        </div>

        <div className="mt-8 pt-6 border-t border-border flex justify-between items-center flex-wrap gap-3">
          <Link href="/dashboard/student/courses/mettre"
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Все модули
          </Link>
          <div className="flex items-center gap-4">
            <Link href={`/dashboard/student/courses/mettre/exam/${unitId}`}
              className="text-qz-accent hover:underline text-sm font-semibold">
              🎓 Экзамен модуля
            </Link>
            {pct === 100 && (
              <span className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Модуль пройден!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
