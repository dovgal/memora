'use client';
// Прохождение юнита тренажёра уровня B1–C2.

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, CheckCircle2, Loader2, SkipForward, Star } from 'lucide-react';
import { LEVELS } from '@/lib/courses/niveaux';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import {
  getCourseProgress, recordExerciseProgress, markUnitKnown,
} from '@/lib/courses/customCoursesApi';
import { addVocabToPersonalSet } from '@/lib/courses/vocabToSet';

export default function LevelUnitPage({ params }: { params: Promise<{ levelId: string; unitId: string }> }) {
  const { levelId, unitId } = use(params);
  const course = LEVELS[levelId];
  const unit = course?.units[unitId];
  const courseId = course?.courseId ?? '';
  const base = `/dashboard/student/courses/niveau/${levelId}`;

  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [markingKnown, setMarkingKnown] = useState(false);

  useEffect(() => {
    if (!idToken || !courseId) return;
    let cancelled = false;
    getCourseProgress(courseId, idToken).then(entries => {
      if (cancelled) return;
      const persisted: Record<string, boolean> = {};
      for (const e of entries) if (e.unitId === unitId) persisted[e.exerciseId] = true;
      setCompleted(prev => ({ ...persisted, ...prev }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [unitId, idToken, courseId]);

  const handleExerciseComplete = useCallback((exerciseId: string) => {
    setCompleted(prev => {
      if (prev[exerciseId]) return prev;
      return { ...prev, [exerciseId]: true };
    });
    recordExerciseProgress(courseId, unitId, exerciseId, idToken);
  }, [courseId, unitId, idToken]);

  const handleMarkKnown = useCallback(async () => {
    if (!unit || !idToken || markingKnown) return;
    if (!confirm('Отметить весь юнит как уже известный? Коуч поставит длинный интервал повторения.')) return;
    setMarkingKnown(true);
    try {
      const ids = [
        ...unit.exercises.filter(e => e.type !== 'theory').map(e => e.id),
        ...(unit.vocabulary ?? []).filter(v => v.fr).map(v => `vocab:${v.fr}`),
      ];
      await markUnitKnown(courseId, unitId, ids, idToken);
      const all: Record<string, boolean> = {};
      for (const e of unit.exercises) if (e.type !== 'theory') all[e.id] = true;
      setCompleted(all);
    } catch { /* ignore */ }
    setMarkingKnown(false);
  }, [unit, idToken, courseId, unitId, markingKnown]);

  const completedCount = Object.keys(completed).length;
  const totalInteractive = unit ? unit.exercises.filter(e => e.type !== 'theory').length : 0;
  const pct = totalInteractive > 0 ? Math.round((completedCount / totalInteractive) * 100) : 100;

  const [savingVocab, setSavingVocab] = useState(false);
  const [vocabSaved, setVocabSaved] = useState<number | null>(null);
  const handleVocabToSet = useCallback(async () => {
    if (!unit || !idToken || !course || savingVocab) return;
    setSavingVocab(true);
    try {
      const n = await addVocabToPersonalSet(
        `${course.title} — Словарь`,
        `Лексика тренажёра «${course.title}» — пополняется по мере прохождения юнитов.`,
        unit.vocabulary ?? [],
        idToken,
      );
      setVocabSaved(n);
    } catch { setVocabSaved(-1); }
    setSavingVocab(false);
  }, [unit, idToken, course, savingVocab]);

  if (!course || !unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Юнит не найден</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="mb-6">
          <Link href={base}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> {course.title}
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
              title="Коуч пометит материал юнита усвоенным"
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
              <div className="h-full bg-[#4255ff] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            {pct === 100 && (
              <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Юнит завершён!
              </p>
            )}
          </div>
        )}

        {(unit.vocabulary?.length ?? 0) > 0 && (
          <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h2 className="text-foreground text-sm font-semibold">Лексика юнита</h2>
              <button
                onClick={handleVocabToSet}
                disabled={savingVocab}
                className="inline-flex items-center gap-1.5 border border-border hover:border-[#ffcd1f]/50 text-qz-text-muted hover:text-qz-accent text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                title="Добавить слова юнита в личный набор карточек"
              >
                {savingVocab ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                {vocabSaved === null ? 'В личный набор'
                  : vocabSaved === -1 ? 'Ошибка — ещё раз?'
                  : vocabSaved === 0 ? 'Уже в наборе ✓'
                  : `Добавлено: ${vocabSaved} ✓`}
              </button>
            </div>
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
          <Link href={base}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Все юниты
          </Link>
          <div className="flex items-center gap-4">
            <Link href={`${base}/exam/${unitId}`}
              className="text-qz-accent hover:underline text-sm font-semibold">
              🎓 Экзамен юнита
            </Link>
            {pct === 100 && (
              <span className="text-emerald-400 text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Юнит пройден!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
