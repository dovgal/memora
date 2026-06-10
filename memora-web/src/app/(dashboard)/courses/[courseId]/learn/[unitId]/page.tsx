'use client';
// Прохождение юнита пользовательского курса.
// Использует те же компоненты упражнений, что и Édito A1 (ExerciseRenderer).

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import {
  getUnit, getCourseProgress, recordExerciseProgress,
  type UnitDetail,
} from '@/lib/courses/customCoursesApi';

export default function CustomUnitPage({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    getUnit(courseId, unitId, idToken)
      .then(u => { if (!cancelled) setUnit(u); })
      .catch(e => { if (!cancelled) setError(e.message); });
    getCourseProgress(courseId, idToken).then(entries => {
      if (cancelled) return;
      const persisted: Record<string, boolean> = {};
      for (const e of entries) if (e.unitId === unitId) persisted[e.exerciseId] = true;
      setCompleted(prev => ({ ...persisted, ...prev }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [courseId, unitId, idToken]);

  const handleExerciseComplete = useCallback((exerciseId: string) => {
    setCompleted(prev => {
      if (prev[exerciseId]) return prev;
      return { ...prev, [exerciseId]: true };
    });
    recordExerciseProgress(courseId, unitId, exerciseId, idToken);
  }, [courseId, unitId, idToken]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">Юнит не найден</p>
        <p className="text-qz-text-muted text-sm mb-4">{error}</p>
        <Link href={`/courses/${courseId}`} className="text-[#4255ff] hover:underline">← Назад к курсу</Link>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const completedCount = Object.keys(completed).length;
  const totalInteractive = unit.exercises.filter(e => e.type !== 'theory').length;
  const pct = totalInteractive > 0 ? Math.round((completedCount / totalInteractive) * 100) : 100;

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="mb-6">
          <Link href={`/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> К списку юнитов
          </Link>
          <h1 className="text-2xl font-bold text-foreground mb-1">{unit.title}</h1>
          <p className="text-qz-text-muted text-sm">{unit.description}</p>
        </div>

        {totalInteractive > 0 && (
          <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-medium">Прогресс</span>
              <span className="text-qz-text-muted text-xs">{completedCount} / {totalInteractive} выполнено</span>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className="h-full bg-[#4255ff] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && (
              <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Юнит завершён!
              </p>
            )}
          </div>
        )}

        {/* Словарь юнита */}
        {unit.vocabulary.length > 0 && (
          <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
            <h2 className="text-foreground text-sm font-semibold mb-3">Лексика юнита</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {unit.vocabulary.map((v, i) => (
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

        <div className="mt-8 pt-6 border-t border-border flex justify-between items-center">
          <Link href={`/courses/${courseId}`}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Все юниты
          </Link>
          {pct === 100 && (
            <span className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Юнит пройден!
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
