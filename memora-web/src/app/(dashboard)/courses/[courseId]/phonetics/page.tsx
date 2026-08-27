'use client';
// Фонетический коуч курса: карта звуков по урокам с уровнем усвоения,
// вход в блок — постановка звука, разминка, практика с проверкой произношения.

import { use, useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, Waves, Check, Dumbbell } from 'lucide-react';
import { getCourse, getCourseProgress } from '@/lib/courses/customCoursesApi';
import { langMeta } from '@/lib/courses/langMeta';
import { PhoneticsCoach } from '@/components/courses/PhoneticsCoach';
import {
  PHONETICS_LESSONS, drillItems, corpusStats, type SoundDrill,
} from '@/lib/courses/phonetics';
import {
  drillMastery, subscribeProgress, getProgressSnapshot, getServerProgressSnapshot, hydrate,
} from '@/lib/courses/phonetics/mastery';

export default function CoursePhoneticsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [language, setLanguage] = useState('fr');
  const [active, setActive] = useState<SoundDrill | null>(null);
  // Прогресс приходит с сервера, а здесь кэшируется: читаем как внешнее
  // хранилище, чтобы не тянуть его через состояние и эффекты.
  const progress = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getServerProgressSnapshot);

  useEffect(() => {
    if (!idToken) return;
    getCourse(courseId, idToken).then(c => { if (c.language) setLanguage(c.language); }).catch(() => {});
    // Сданные единицы забираем с сервера: карта звуков должна показывать один
    // и тот же уровень усвоения на ноутбуке, телефоне и планшете.
    getCourseProgress(courseId, idToken).then(hydrate).catch(() => {});
  }, [courseId, idToken]);

  const meta = langMeta(language);
  const stats = corpusStats();

  const backToMap = useCallback(() => { setActive(null); }, []);

  if (active) {
    const lesson = PHONETICS_LESSONS.find(l => l.n === active.lesson);
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
          <button onClick={backToMap} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-4">
            <ChevronLeft className="w-4 h-4" /> К карте звуков
          </button>
          <PhoneticsCoach
            key={active.id}
            drill={active}
            articulation={lesson?.articulation}
            voice={meta.voice}
            speechLang={meta.speechLang}
            onExit={backToMap}
            courseId={courseId}
            idToken={idToken}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-3">
          <ChevronLeft className="w-4 h-4" /> К курсу
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-1">
          <Waves className="w-6 h-6 text-[#4255ff]" /> Фонетический коуч
        </h1>
        <p className="text-qz-text-muted text-sm mb-6">
          {stats.drills} блоков звуков из {stats.lessons} уроков · {stats.words} слов, {stats.phrases} фраз,
          {' '}{stats.ladders} лесенок, {stats.pairs} минимальных пар, {stats.twisters} скороговорок.
          Каждый блок закрывается, только когда весь материал произнесён чисто.
        </p>

        <div className="space-y-8">
          {PHONETICS_LESSONS.map(lesson => (
            <section key={lesson.n}>
              <div className="mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted">
                  Урок {lesson.n} · {lesson.title}
                </h2>
                <p className="text-qz-text-muted text-xs mt-0.5">{lesson.subtitle}</p>
                {lesson.articulation.length > 0 && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 inline-flex items-center gap-1">
                    <Dumbbell className="w-3 h-3" /> включена разминка: {lesson.articulation.map(a => a.title).join(' · ')}
                  </p>
                )}
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lesson.drills.map(d => {
                  const totalItems = drillItems(d).length;
                  const m = drillMastery(progress, d.id, totalItems);
                  const done = m >= 1;
                  return (
                    <button key={d.id} onClick={() => setActive(d)}
                      className="text-left bg-qz-card border border-border rounded-2xl p-4 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all h-full flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-[#4255ff]">{d.ipa}</span>
                        {done
                          ? <span className="text-xs text-emerald-500 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> усвоено</span>
                          : <span className="text-xs text-qz-text-muted bg-muted px-2 py-0.5 rounded-full">{totalItems} ед.</span>}
                      </div>
                      <p className="text-foreground font-semibold text-sm mb-1 leading-snug">{d.title}</p>
                      <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-3">{d.problem}</p>
                      <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.round(m * 100)}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
