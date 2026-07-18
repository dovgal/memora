'use client';
// Каталог курсов: темы (Языки → по языкам, Другое...), поиск, фильтры,
// подписка на курсы (⭐ → «Мой кабинет») + пользовательские курсы и конструктор.

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BookOpen, Plus, Pencil, Globe2, Lock, Loader2, GraduationCap, Search, Star, Library,
} from 'lucide-react';
import { listCourses, createCourse, type CourseSummary } from '@/lib/courses/customCoursesApi';
import { BUILTIN_COURSES, subjectForCourse, type CatalogCourse } from '@/lib/courseCatalog';
import { getSubscriptions, subscribeCourse, unsubscribeCourse } from '@/lib/classroomApi';

interface CardData extends CatalogCourse {
  isCustom?: boolean;
  isOwner?: boolean;
  isPublished?: boolean;
  unitCount?: number;
}

export default function CoursesCatalogPage() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const router = useRouter();

  const [custom, setCustom] = useState<CourseSummary[]>([]);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string>('Все');
  const [topic, setTopic] = useState<string>('Все');

  // loading=true с инициализации; синхронный setLoading в эффекте запрещён
  // (react-hooks/set-state-in-effect) и не нужен — сбрасываем по завершении загрузки.
  const reload = useCallback(() => {
    if (!idToken) return;
    Promise.allSettled([listCourses(idToken), getSubscriptions(idToken)]).then(([c, s]) => {
      if (c.status === 'fulfilled') setCustom(c.value);
      if (s.status === 'fulfilled') setSubs(new Set(s.value.map(x => x.courseId)));
      setLoading(false);
    });
  }, [idToken]);

  useEffect(() => { reload(); }, [reload]);

  // Все карточки: встроенные + пользовательские
  const allCards: CardData[] = useMemo(() => {
    const customCards: CardData[] = custom.map(c => {
      const st = subjectForCourse(c.subject, c.language);
      return {
        id: c.id,
        href: `/courses/${c.id}`,
        title: c.title,
        description: c.description || 'Без описания',
        subject: st.subject,
        topic: st.topic,
        level: c.level || undefined,
        emoji: '📚',
        isCustom: true,
        isOwner: c.isOwner,
        isPublished: c.isPublished,
        unitCount: c.unitCount,
      };
    });
    return [...BUILTIN_COURSES, ...customCards];
  }, [custom]);

  const subjects = useMemo(() => ['Все', ...Array.from(new Set(allCards.map(c => c.subject)))], [allCards]);
  const topics = useMemo(() => {
    const pool = subject === 'Все' ? allCards : allCards.filter(c => c.subject === subject);
    return ['Все', ...Array.from(new Set(pool.map(c => c.topic)))];
  }, [allCards, subject]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allCards.filter(c => {
      if (subject !== 'Все' && c.subject !== subject) return false;
      if (topic !== 'Все' && c.topic !== topic) return false;
      if (q && !(`${c.title} ${c.description} ${c.level ?? ''} ${c.topic}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allCards, query, subject, topic]);

  const toggleSub = async (c: CardData, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!idToken) return;
    if (subs.has(c.id)) {
      setSubs(prev => { const n = new Set(prev); n.delete(c.id); return n; });
      await unsubscribeCourse(c.id, idToken).catch(() => {});
    } else {
      setSubs(prev => new Set(prev).add(c.id));
      await subscribeCourse({ courseId: c.id, title: c.title, href: c.href }, idToken).catch(() => {});
    }
  };

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

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-[#4255ff]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#4255ff]">Курсы</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Каталог курсов</h1>
            <p className="text-qz-text-muted max-w-xl">
              Тренажёры по темам и уровням, пользовательские курсы и конструктор.
              Нажмите ⭐, чтобы добавить курс в «Мой кабинет».
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/sources"
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <Library className="w-4 h-4" /> Учебники
            </Link>
            <button
              onClick={handleCreate}
              disabled={creating || !idToken}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Создать курс
            </button>
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Поиск и фильтры */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-qz-bg border border-border rounded-xl px-3 py-2.5 max-w-md">
            <Search className="w-4 h-4 text-qz-text-muted shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск курса: название, уровень, тема…"
              className="bg-transparent outline-none text-sm text-foreground w-full"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-qz-text-muted text-xs font-semibold uppercase tracking-wider mr-1">Тема:</span>
            {subjects.map(s => (
              <button key={s} onClick={() => { setSubject(s); setTopic('Все'); }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  subject === s ? 'bg-[#4255ff] border-[#4255ff] text-white' : 'border-border text-qz-text-muted hover:border-[#4255ff]/50'
                }`}>
                {s}
              </button>
            ))}
          </div>
          {topics.length > 2 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-qz-text-muted text-xs font-semibold uppercase tracking-wider mr-1">Раздел:</span>
              {topics.map(t => (
                <button key={t} onClick={() => setTopic(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    topic === t ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-border text-qz-text-muted hover:border-emerald-500/50'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Сетка курсов */}
        {loading ? (
          <div className="flex items-center gap-2 text-qz-text-muted text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Загрузка…</div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-2xl p-10 text-center">
            <BookOpen className="w-8 h-8 text-qz-text-muted mx-auto mb-3" />
            <p className="text-qz-text-muted text-sm">Ничего не найдено. Измените запрос или фильтры.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(c => (
              <Link key={`${c.isCustom ? 'u' : 'b'}-${c.id}`} href={c.href}>
                <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all cursor-pointer group h-full flex flex-col relative">
                  <button
                    onClick={(e) => toggleSub(c, e)}
                    className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
                    title={subs.has(c.id) ? 'Убрать из моих курсов' : 'В мои курсы'}
                  >
                    <Star className={`w-4 h-4 ${subs.has(c.id) ? 'text-qz-accent fill-[#ffcd1f]' : 'text-qz-text-muted'}`} />
                  </button>
                  <div className="text-2xl mb-3">{c.emoji}</div>
                  <h3 className="text-foreground font-semibold text-sm mb-1 pr-6 line-clamp-1">{c.title}</h3>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-2">{c.description}</p>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs bg-muted text-qz-text-muted px-2 py-0.5 rounded-full line-clamp-1">
                      {c.topic}{c.level ? ` · ${c.level}` : ''}
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      {c.isCustom && (c.isPublished
                        ? <span title="Опубликован"><Globe2 className="w-3.5 h-3.5 text-emerald-400" /></span>
                        : <span title="Черновик"><Lock className="w-3.5 h-3.5 text-qz-text-muted" /></span>)}
                      {c.isCustom && c.isOwner && (
                        <span
                          role="link"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/courses/${c.id}/edit`; }}
                          className="text-qz-text-muted hover:text-[#4255ff]"
                          title="Редактор"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </span>
                      )}
                      <span className="text-[#4255ff] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
