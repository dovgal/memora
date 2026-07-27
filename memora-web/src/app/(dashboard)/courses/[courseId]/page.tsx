'use client';
// Страница курса (плеер): список юнитов с прогрессом + вход в коуч-режим.

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronLeft, Pencil, Loader2, Brain, CheckCircle2, MessagesSquare, BookOpenText, BarChart3, GraduationCap, AudioLines, Layers, BookOpenCheck, Waves } from 'lucide-react';
import {
  getCourse, getCourseProgress, exportVocabularySet,
  type CourseDetail, type ProgressEntry,
} from '@/lib/courses/customCoursesApi';

export default function CustomCoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [progress, setProgress] = useState<ProgressEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    getCourse(courseId, idToken).then(setCourse).catch(e => setError(e.message));
    getCourseProgress(courseId, idToken).then(setProgress).catch(() => {});
  }, [courseId, idToken]);

  // Лексика всех юнитов → личный набор «Лексика · {курс}» (study/FSRS).
  const handleExportVocabulary = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const r = await exportVocabularySet(courseId, idToken);
      alert(r.added > 0
        ? `Добавлено ${r.added} карточек (всего в наборе: ${r.total}). Открываю набор.`
        : `Все слова курса уже в наборе (${r.total} карточек). Открываю набор.`);
      router.push(`/set/${r.setId}`);
    } catch (e) {
      alert(`Не удалось создать набор: ${e instanceof Error ? e.message : e}`);
    }
    setExporting(false);
  }, [courseId, idToken, exporting, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">Не удалось открыть курс</p>
        <p className="text-qz-text-muted text-sm mb-4">{error}</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const completedByUnit: Record<string, number> = {};
  for (const p of progress) completedByUnit[p.unitId] = (completedByUnit[p.unitId] ?? 0) + 1;

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/courses" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> К каталогу
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">{course.title}</h1>
              <p className="text-qz-text-muted max-w-xl">{course.description}</p>
              <div className="flex items-center gap-2 mt-3">
                {course.level && <span className="text-xs bg-muted text-qz-text-muted px-2 py-0.5 rounded-full">Уровень {course.level}</span>}
                <span className="text-xs bg-muted text-qz-text-muted px-2 py-0.5 rounded-full">{course.units.length} юнит(ов)</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/courses/${courseId}/coach`}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <Brain className="w-4 h-4" /> Коуч-режим
              </Link>
              <Link
                href={`/courses/${courseId}/talk`}
                className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <MessagesSquare className="w-4 h-4" /> Разговор
              </Link>
              <Link
                href={`/courses/${courseId}/reading`}
                className="inline-flex items-center gap-2 border border-border hover:border-[#ffcd1f]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <BookOpenText className="w-4 h-4" /> Чтение
              </Link>
              <Link
                href={`/courses/${courseId}/shadow`}
                className="inline-flex items-center gap-2 border border-border hover:border-emerald-500/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <AudioLines className="w-4 h-4" /> Shadowing
              </Link>
              <Link
                href={`/courses/${courseId}/lecture`}
                className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <BookOpenCheck className="w-4 h-4" /> Чтение вслух
              </Link>
              <Link
                href={`/courses/${courseId}/phonetics`}
                className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <Waves className="w-4 h-4" /> Фонетический коуч
              </Link>
              <Link
                href={`/courses/${courseId}/sounds`}
                className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <AudioLines className="w-4 h-4" /> Звуки
              </Link>
              <Link
                href={`/courses/${courseId}/stats`}
                className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
              >
                <BarChart3 className="w-4 h-4" /> Прогресс
              </Link>
              <button
                onClick={handleExportVocabulary}
                disabled={exporting}
                title="Собрать слова и фразы всех юнитов в набор карточек для повторения"
                className="inline-flex items-center gap-2 border border-border hover:border-[#ffcd1f]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />} Слова на повторение
              </button>
              {course.isOwner && (
                <Link
                  href={`/courses/${courseId}/edit`}
                  className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Pencil className="w-4 h-4" /> Редактор
                </Link>
              )}
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Юниты</h2>
          {course.units.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center text-qz-text-muted text-sm">
              В курсе пока нет юнитов.
              {course.isOwner && <> Добавьте их в <Link href={`/courses/${courseId}/edit`} className="text-[#4255ff] hover:underline">редакторе</Link>.</>}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {course.units.map((u, idx) => {
                const done = completedByUnit[u.id] ?? 0;
                const isComplete = u.exerciseCount > 0 && done >= u.exerciseCount;
                return (
                  <Link key={u.id} href={`/courses/${courseId}/learn/${u.id}`}>
                    <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all cursor-pointer group h-full flex flex-col">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-[#4255ff]/20 flex items-center justify-center text-[#4255ff] font-bold text-sm shrink-0">
                          {idx + 1}
                        </div>
                        {isComplete
                          ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Пройден</span>
                          : <span className="text-xs text-qz-text-muted bg-muted px-2 py-0.5 rounded-full">{u.exerciseCount} упр.</span>}
                      </div>
                      <h3 className="text-foreground font-semibold text-sm mb-1 line-clamp-1">{u.title}</h3>
                      <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-2">{u.description}</p>
                      {u.exerciseCount > 0 && (
                        <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#4255ff] rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.round((done / u.exerciseCount) * 100))}%` }}
                          />
                        </div>
                      )}
                      {u.exerciseCount > 0 && (
                        <span
                          role="link"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/courses/${courseId}/exam/${u.id}`; }}
                          className="mt-2.5 inline-flex items-center gap-1 text-qz-accent hover:underline text-xs font-semibold w-max"
                        >
                          <GraduationCap className="w-3.5 h-3.5" /> Экзамен юнита
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
