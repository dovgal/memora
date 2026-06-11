'use client';
// Динамическая горизонтальная лента всех курсов для главной страницы.
// Встроенные тренажёры + опубликованные пользовательские курсы.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { GraduationCap, ArrowRight } from 'lucide-react';
import { BUILTIN_COURSES } from '@/lib/courseCatalog';
import { listCourses } from '@/lib/courses/customCoursesApi';

interface StripCard { id: string; href: string; title: string; badge: string; emoji: string }

export function CoursesStrip() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [cards, setCards] = useState<StripCard[]>(
    BUILTIN_COURSES.map(c => ({ id: c.id, href: c.href, title: c.title, badge: `${c.topic}${c.level ? ' · ' + c.level : ''}`, emoji: c.emoji }))
  );

  useEffect(() => {
    if (!idToken) return;
    listCourses(idToken).then(custom => {
      const extra: StripCard[] = custom
        .filter(c => c.isPublished || c.isOwner)
        .map(c => ({
          id: c.id,
          href: `/courses/${c.id}`,
          title: c.title,
          badge: c.isOwner ? 'Мой курс' : 'Курс сообщества',
          emoji: '📚',
        }));
      setCards(prev => [...prev, ...extra.filter(e => !prev.some(p => p.id === e.id))]);
    }).catch(() => {});
  }, [idToken]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-qz-text tracking-wide flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[#4255ff]" /> Все курсы
        </h2>
        <Link href="/courses" className="inline-flex items-center gap-1 text-sm font-semibold text-[#4255ff] hover:underline">
          Каталог и поиск <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3 snap-x scrollbar-hide">
        {cards.map(c => (
          <Link key={c.id} href={c.href} className="snap-start shrink-0">
            <div className="w-52 h-full bg-qz-card border border-border rounded-2xl p-4 hover:border-[#4255ff]/50 hover:bg-[#4255ff]/5 transition-all group">
              <div className="text-2xl mb-2">{c.emoji}</div>
              <p className="text-foreground font-semibold text-sm line-clamp-2 mb-2">{c.title}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] bg-muted text-qz-text-muted px-2 py-0.5 rounded-full line-clamp-1">{c.badge}</span>
                <span className="text-[#4255ff] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
