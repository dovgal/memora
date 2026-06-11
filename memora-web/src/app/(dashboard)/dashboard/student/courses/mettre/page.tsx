import Link from 'next/link';
import { Sparkles, Brain, BarChart3 } from 'lucide-react';
import { METTRE_UNITS, METTRE_UNIT_ORDER } from '@/lib/courses/mettre';

export default function MettreCoursePage() {
  const units = METTRE_UNIT_ORDER.map(id => ({ id, unit: METTRE_UNITS[id] }));

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-rose-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">Expressions clés · A2–B1</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Mettre &amp; Remettre</h1>
          <p className="text-qz-text-muted max-w-xl mb-4">
            Тренажёр устойчивых выражений с двумя незаменимыми глаголами: mettre en place,
            mettre au point, remettre à neuf, remettre sur pied… Теория с группировкой по смыслу,
            упражнения с объяснениями и личный словарь.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/student/courses/mettre/coach"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <Brain className="w-4 h-4" /> Коуч-режим
            </Link>
            <Link
              href="/dashboard/student/courses/mettre/stats"
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <BarChart3 className="w-4 h-4" /> Прогресс
            </Link>
          </div>
        </div>

        {/* Units */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">3 модуля</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map(({ id, unit }) => (
              <Link key={id} href={`/dashboard/student/courses/mettre/${id}`}>
                <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-rose-500/40 hover:bg-rose-500/5 transition-all duration-200 cursor-pointer group h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-sm shrink-0">
                      {id}
                    </div>
                    <span className="text-xs text-qz-text-muted bg-muted px-2 py-0.5 rounded-full">
                      {unit.exercises.length} упр. · {unit.vocabulary?.length ?? 0} выраж.
                    </span>
                  </div>
                  <h3 className="text-foreground font-semibold text-sm mb-1 line-clamp-2">{unit.title}</h3>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-3">{unit.description}</p>
                  <div className="mt-3 flex items-center justify-end">
                    <span className="text-rose-400 text-xs group-hover:translate-x-0.5 transition-transform">→</span>
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
