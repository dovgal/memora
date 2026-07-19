'use client';
// Прохождение юнита пользовательского курса.
// Использует те же компоненты упражнений, что и Édito A1 (ExerciseRenderer).

import { use, useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, CheckCircle2, Loader2, SkipForward, Volume2 } from 'lucide-react';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import { speakInworldLanguage } from '@/lib/courses/ttsInworld';
import {
  getUnit, getCourse, getCourseProgress, recordExerciseProgress, markUnitKnown,
  getTranslatedUnit, type UnitDetail,
} from '@/lib/courses/customCoursesApi';
import { UnitLangToggle } from '@/components/courses/UnitLangToggle';

export default function CustomUnitPage({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [baseUnit, setBaseUnit] = useState<UnitDetail | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [language, setLanguage] = useState('fr');
  const [uiLang, setUiLang] = useState('orig');
  const [translating, setTranslating] = useState(false);
  const transCache = useRef<Record<string, UnitDetail>>({});
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    getUnit(courseId, unitId, idToken)
      .then(u => { if (!cancelled) { setBaseUnit(u); setUnit(u); } })
      .catch(e => { if (!cancelled) setError(e.message); });
    getCourse(courseId, idToken)
      .then(c => { if (!cancelled && c.language) setLanguage(c.language); })
      .catch(() => {});
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

  // Переключение языка интерфейса юнита: 'orig' — как есть, 'fr' — перевод (с кэшем).
  const switchLang = useCallback(async (lang: string) => {
    if (lang === uiLang || !baseUnit) return;
    if (lang === 'orig') { setUiLang('orig'); setUnit(baseUnit); return; }
    setUiLang(lang);
    const cached = transCache.current[lang];
    if (cached) { setUnit(cached); return; }
    setTranslating(true);
    try {
      const t = await getTranslatedUnit(courseId, unitId, lang, idToken);
      transCache.current[lang] = t;
      setUnit(t);
    } catch {
      setUiLang('orig'); setUnit(baseUnit);
      alert('Не удалось перевести юнит. Попробуйте ещё раз.');
    }
    setTranslating(false);
  }, [uiLang, baseUnit, courseId, unitId, idToken]);

  const [markingKnown, setMarkingKnown] = useState(false);
  const handleMarkKnown = useCallback(async () => {
    if (!unit || !idToken || markingKnown) return;
    if (!confirm('Отметить весь юнит как уже известный? Коуч не будет тратить на него время и поставит длинный интервал повторения.')) return;
    setMarkingKnown(true);
    try {
      const ids = [
        ...unit.exercises.filter(e => e.type !== 'theory').map(e => e.id),
        ...unit.vocabulary.filter(v => v.fr).map(v => `vocab:${v.fr}`),
      ];
      await markUnitKnown(courseId, unitId, ids, idToken);
      const all: Record<string, boolean> = {};
      for (const e of unit.exercises) if (e.type !== 'theory') all[e.id] = true;
      setCompleted(all);
    } catch { /* ignore */ }
    setMarkingKnown(false);
  }, [unit, idToken, courseId, unitId, markingKnown]);

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
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">{unit.title}</h1>
              <p className="text-qz-text-muted text-sm">{unit.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <UnitLangToggle uiLang={uiLang} target={language} onSwitch={switchLang} loading={translating} />
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

        {/* Словарь юнита: озвучка по клику + транскрипция МФА */}
        {unit.vocabulary.length > 0 && (
          <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
            <h2 className="text-foreground text-sm font-semibold mb-3">Лексика юнита</h2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {unit.vocabulary.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-sm">
                  <button
                    onClick={() => speakInworldLanguage(v.fr, language)}
                    className="flex items-center gap-1.5 min-w-0 text-left group"
                    title="Прослушать произношение"
                  >
                    <Volume2 className="w-3.5 h-3.5 shrink-0 text-qz-text-muted group-hover:text-[#4255ff] transition-colors" />
                    <span className="text-foreground font-medium group-hover:text-[#4255ff] transition-colors">{v.fr}</span>
                    {v.ipa && <span className="text-qz-text-muted text-xs font-mono shrink-0">[{v.ipa}]</span>}
                  </button>
                  <span className="text-qz-text-muted text-xs text-right shrink-0">{v.ru}</span>
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
