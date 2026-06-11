'use client';
// Обзор тренажёра уровня (B1–C2): юниты + коуч/разговор/чтение/прогресс.

import { use } from 'react';
import Link from 'next/link';
import { Sparkles, Brain, MessagesSquare, BookOpenText, BarChart3 } from 'lucide-react';
import { LEVELS } from '@/lib/courses/niveaux';

export default function LevelCoursePage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = use(params);
  const course = LEVELS[levelId];

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Курс не найден</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  const base = `/dashboard/student/courses/niveau/${levelId}`;
  const units = course.order.map(id => ({ id, unit: course.units[id] }));

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-10">

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-[#4255ff]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#4255ff]">Уровень {course.level}</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{course.title}</h1>
          <p className="text-qz-text-muted max-w-xl mb-4">{course.description}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`${base}/coach`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
              <Brain className="w-4 h-4" /> Коуч-режим
            </Link>
            <Link href={`${base}/talk`}
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
              <MessagesSquare className="w-4 h-4" /> Разговор
            </Link>
            <Link href={`${base}/reading`}
              className="inline-flex items-center gap-2 border border-border hover:border-[#ffcd1f]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
              <BookOpenText className="w-4 h-4" /> Чтение
            </Link>
            <Link href={`${base}/stats`}
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors">
              <BarChart3 className="w-4 h-4" /> Прогресс
            </Link>
          </div>
        </div>

        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">
            {units.length} юнитов — {course.level}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map(({ id, unit }) => (
              <Link key={id} href={`${base}/unit/${id}`}>
                <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all duration-200 cursor-pointer group h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#4255ff]/20 flex items-center justify-center text-[#4255ff] font-bold text-sm shrink-0">
                      {id}
                    </div>
                    <span className="text-xs text-qz-text-muted bg-muted px-2 py-0.5 rounded-full">
                      {unit.exercises.length} упр.
                    </span>
                  </div>
                  <h3 className="text-foreground font-semibold text-sm mb-1 line-clamp-2">{unit.title}</h3>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-3">{unit.description}</p>
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-[#4255ff] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
