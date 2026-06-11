'use client';
// Каталог курсов: встроенные тренажёры + пользовательские курсы.
// Любой пользователь может создать свой курс и опубликовать его.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BookOpen, Plus, Pencil, Globe2, Lock, Loader2, GraduationCap } from 'lucide-react';
import { listCourses, createCourse, type CourseSummary } from '@/lib/courses/customCoursesApi';

const BUILTIN_COURSES = [
  {
    href: '/dashboard/student/courses/edito-a1',
    title: 'Тренажер Édito A1',
    description: '10 юнитов с теорией, грамматикой, диалогами и озвучкой по учебнику Édito A1.',
    badge: 'Французский · A1',
    emoji: '🇫🇷',
  },
  {
    href: '/dashboard/student/courses/french-a1',
    title: 'Французский A1',
    description: 'Базовый курс французского с карточками и упражнениями.',
    badge: 'Французский · A1',
    emoji: '📘',
  },
  {
    href: '/dashboard/student/courses/edito-a2',
    title: 'Тренажер Édito A2',
    description: '12 юнитов уровня A2: прошедшие времена, субжонктив, местоимения — с коучем и экзаменами.',
    badge: 'Французский · A2',
    emoji: '🇫🇷',
  },
  {
    href: '/dashboard/student/courses/french-a2',
    title: 'Французский A2',
    description: 'Продвинутый тренажёр: диагностика, мой план, классы и лидерборд.',
    badge: 'Французский · A2',
    emoji: '📗',
  },
  {
    href: '/dashboard/student/courses/mettre',
    title: 'Mettre & Remettre',
    description: 'Устойчивые выражения с mettre и remettre: en place, au point, à neuf, sur pied — с коучем и экзаменами.',
    badge: 'Французский · A2–B1',
    emoji: '🗝️',
  },
];

export default function CoursesCatalogPage() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const router = useRouter();

  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!idToken) return;
    setLoading(true);
    listCourses(idToken)
      .then(setCourses)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [idToken]);

  useEffect(() => { reload(); }, [reload]);

  const handleCreate = async () => {
    if (!idToken || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { id } = await createCourse({ title: 'Новый курс', language: 'fr' }, idToken);
      router.push(`/courses/${id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать курс');
      setCreating(false);
    }
  };

  const mine = courses.filter(c => c.isOwner);
  const published = courses.filter(c => !c.isOwner);

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-10">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-[#4255ff]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#4255ff]">Курсы</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Каталог курсов</h1>
            <p className="text-qz-text-muted max-w-xl">
              Проходите готовые тренажёры или создавайте собственные курсы с теорией,
              упражнениями и озвучкой — по образцу Édito A1.
            </p>
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !idToken}
            className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать курс
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Built-in trainers */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Встроенные тренажёры</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {BUILTIN_COURSES.map(c => (
              <Link key={c.href} href={c.href}>
                <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all cursor-pointer group h-full flex flex-col">
                  <div className="text-2xl mb-3">{c.emoji}</div>
                  <h3 className="text-foreground font-semibold text-sm mb-1">{c.title}</h3>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1">{c.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs bg-muted text-qz-text-muted px-2 py-0.5 rounded-full">{c.badge}</span>
                    <span className="text-[#4255ff] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* My courses */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Мои курсы</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-qz-text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Загрузка…</div>
          ) : mine.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center">
              <BookOpen className="w-8 h-8 text-qz-text-muted mx-auto mb-3" />
              <p className="text-qz-text-muted text-sm mb-4">У вас пока нет своих курсов. Создайте первый — вручную или с помощью ИИ.</p>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" /> Создать курс
              </button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mine.map(c => (
                <div key={c.id} className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 transition-all h-full flex flex-col">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-foreground font-semibold text-sm line-clamp-1">{c.title}</h3>
                    {c.isPublished
                      ? <span title="Опубликован"><Globe2 className="w-4 h-4 text-emerald-400 shrink-0" /></span>
                      : <span title="Черновик"><Lock className="w-4 h-4 text-qz-text-muted shrink-0" /></span>}
                  </div>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-2">{c.description || 'Без описания'}</p>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="bg-muted text-qz-text-muted px-2 py-0.5 rounded-full">{c.unitCount} юнит(ов)</span>
                    <div className="flex items-center gap-3">
                      <Link href={`/courses/${c.id}/edit`} className="inline-flex items-center gap-1 text-qz-text-muted hover:text-[#4255ff] transition-colors">
                        <Pencil className="w-3.5 h-3.5" /> Редактор
                      </Link>
                      <Link href={`/courses/${c.id}`} className="text-[#4255ff] hover:underline">Открыть →</Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Published by others */}
        {published.length > 0 && (
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Опубликованные курсы</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {published.map(c => (
                <Link key={c.id} href={`/courses/${c.id}`}>
                  <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all cursor-pointer group h-full flex flex-col">
                    <h3 className="text-foreground font-semibold text-sm mb-1 line-clamp-1">{c.title}</h3>
                    <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-2">{c.description || 'Без описания'}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs bg-muted text-qz-text-muted px-2 py-0.5 rounded-full">{c.unitCount} юнит(ов)</span>
                      <span className="text-[#4255ff] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
