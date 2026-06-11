import Link from 'next/link';
import { Sparkles, Brain, MessagesSquare, BookOpenText, BarChart3 } from 'lucide-react';
import { EDITO_A2_UNITS, A2_UNIT_ORDER } from '@/lib/courses/edito-a2';

export default function EditoA2CoursePage() {
  const units = A2_UNIT_ORDER.map(id => ({ id, unit: EDITO_A2_UNITS[id] }));

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Уровень A2 · Édito A2</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Тренажер Édito A2</h1>
          <p className="text-qz-text-muted max-w-xl mb-4">
            12 юнитов по программе уровня A2: прошедшие времена, будущее, условие, местоимения,
            субжонктив и формальные письма — с теорией, упражнениями и озвучкой.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/student/courses/edito-a2/coach"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <Brain className="w-4 h-4" /> Коуч-режим
            </Link>
            <Link
              href="/dashboard/student/courses/edito-a2/talk"
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <MessagesSquare className="w-4 h-4" /> Разговор
            </Link>
            <Link
              href="/dashboard/student/courses/edito-a2/reading"
              className="inline-flex items-center gap-2 border border-border hover:border-[#ffcd1f]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <BookOpenText className="w-4 h-4" /> Чтение
            </Link>
            <Link
              href="/dashboard/student/courses/edito-a2/stats"
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <BarChart3 className="w-4 h-4" /> Прогресс
            </Link>
          </div>
        </div>

        {/* Units grid */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">12 Unités — Édito A2</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map(({ id, unit }) => (
              <Link key={id} href={`/dashboard/student/courses/edito-a2/${id}`}>
                <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200 cursor-pointer group h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm shrink-0">
                      {id}
                    </div>
                    <span className="text-xs text-qz-text-muted bg-muted px-2 py-0.5 rounded-full">
                      {unit.exercises.length} упр.
                    </span>
                  </div>
                  <h3 className="text-foreground font-semibold text-sm mb-1 line-clamp-1">{unit.title}</h3>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-2">{unit.description}</p>
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-emerald-400 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
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
