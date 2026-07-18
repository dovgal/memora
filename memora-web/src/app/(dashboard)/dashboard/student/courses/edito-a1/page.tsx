import Link from 'next/link';
import { BookOpen, Layers, Hash, Sparkles, Brain, MessagesSquare, BookOpenText, BarChart3 } from 'lucide-react';
import { EDITO_A1_UNITS, UNIT_ORDER, SPECIAL_MODULES } from '@/lib/courses/edito-a1';
import { VocabSetCard } from '@/components/edito/VocabSetCard';

export default function EditoA1CoursePage() {
  const regularUnits = UNIT_ORDER.map(id => ({ id, unit: EDITO_A1_UNITS[id] }));
  const genre = EDITO_A1_UNITS['genre'];
  const numeros = EDITO_A1_UNITS['numeros'];
  const phonetique = EDITO_A1_UNITS['phonetique'];
  const delf = EDITO_A1_UNITS['delf'];

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-qz-accent" />
            <span className="text-xs font-bold uppercase tracking-wider text-qz-accent">Уровень A1 · Édito A1</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Тренажер Édito A1</h1>
          <p className="text-qz-text-muted max-w-xl mb-4">
            10 юнитов с теорией и упражнениями по материалам учебника Édito A1. Грамматика, диалоги,
            роды существительных, числа и лексика — с озвучкой на французском.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/student/courses/edito-a1/coach"
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <Brain className="w-4 h-4" /> Коуч-режим
            </Link>
            <Link
              href="/dashboard/student/courses/edito-a1/talk"
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <MessagesSquare className="w-4 h-4" /> Разговор
            </Link>
            <Link
              href="/dashboard/student/courses/edito-a1/reading"
              className="inline-flex items-center gap-2 border border-border hover:border-[#ffcd1f]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <BookOpenText className="w-4 h-4" /> Чтение
            </Link>
            <Link
              href="/dashboard/student/courses/edito-a1/stats"
              className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <BarChart3 className="w-4 h-4" /> Прогресс
            </Link>
          </div>
        </div>

        {/* Special modules */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Специальные модули</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Genre */}
            <Link href="/dashboard/student/courses/edito-a1/genre">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-pink-900/30 via-purple-900/20 to-transparent p-6 hover:scale-[1.01] hover:border-pink-500/40 transition-all duration-200 cursor-pointer group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">🎯</div>
                  <h3 className="text-foreground font-bold text-base mb-1">{genre.title}</h3>
                  <p className="text-qz-text-muted text-sm mb-3">{genre.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-pink-500/20 text-pink-300 px-2 py-0.5 rounded-full">{genre.exercises.length} упр.</span>
                    <span className="text-pink-400 text-sm group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Numeros */}
            <Link href="/dashboard/student/courses/edito-a1/numeros">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-900/30 via-emerald-900/20 to-transparent p-6 hover:scale-[1.01] hover:border-amber-500/40 transition-all duration-200 cursor-pointer group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">🔢</div>
                  <h3 className="text-foreground font-bold text-base mb-1">{numeros.title}</h3>
                  <p className="text-qz-text-muted text-sm mb-3">{numeros.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">{numeros.exercises.length} упр.</span>
                    <span className="text-amber-400 text-sm group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* Phonétique */}
            <Link href="/dashboard/student/courses/edito-a1/phonetique">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-sky-900/30 via-cyan-900/20 to-transparent p-6 hover:scale-[1.01] hover:border-sky-500/40 transition-all duration-200 cursor-pointer group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">🔊</div>
                  <h3 className="text-foreground font-bold text-base mb-1">{phonetique.title}</h3>
                  <p className="text-qz-text-muted text-sm mb-3">{phonetique.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">{phonetique.exercises.length} упр.</span>
                    <span className="text-sky-400 text-sm group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>

            {/* DELF A1 */}
            <Link href="/dashboard/student/courses/edito-a1/delf">
              <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-indigo-900/30 via-blue-900/20 to-transparent p-6 hover:scale-[1.01] hover:border-indigo-500/40 transition-all duration-200 cursor-pointer group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">🎓</div>
                  <h3 className="text-foreground font-bold text-base mb-1">{delf.title}</h3>
                  <p className="text-qz-text-muted text-sm mb-3">{delf.description}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">{delf.exercises.length} упр.</span>
                    <span className="text-indigo-400 text-sm group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Personal vocabulary set */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Мой словарь</h2>
          <VocabSetCard />
        </section>

        {/* Units grid */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">10 Unités — Édito A1</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {regularUnits.map(({ id, unit }) => (
              <Link key={id} href={`/dashboard/student/courses/edito-a1/${id}`}>
                <div className="bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all duration-200 cursor-pointer group h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-[#4255ff]/20 flex items-center justify-center text-[#4255ff] font-bold text-sm shrink-0">
                      {id}
                    </div>
                    <span className="text-xs text-qz-text-muted bg-muted px-2 py-0.5 rounded-full">
                      {unit.exercises.length} упр.
                    </span>
                  </div>
                  <h3 className="text-foreground font-semibold text-sm mb-1 line-clamp-1">{unit.title}</h3>
                  <p className="text-qz-text-muted text-xs leading-relaxed flex-1 line-clamp-2">{unit.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-1">
                      {unit.exercises.slice(0, 5).map((ex, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${
                          ex.type === 'theory' ? 'bg-[#ffcd1f]' :
                          ex.type === 'grammar-quiz' ? 'bg-[#4255ff]' :
                          ex.type === 'gender-quiz' ? 'bg-pink-400' :
                          ex.type === 'dialogue' ? 'bg-emerald-400' :
                          ex.type === 'fill-blank' ? 'bg-violet-400' :
                          'bg-qz-text-muted'
                        }`} />
                      ))}
                      {unit.exercises.length > 5 && <span className="text-qz-text-muted/50 text-xs">+{unit.exercises.length - 5}</span>}
                    </div>
                    <span className="text-[#4255ff] text-xs group-hover:translate-x-0.5 transition-transform">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 text-xs text-qz-text-muted">
          {[
            { color: 'bg-[#ffcd1f]', label: 'Теория' },
            { color: 'bg-[#4255ff]', label: 'Грамматика' },
            { color: 'bg-pink-400', label: 'Род' },
            { color: 'bg-emerald-400', label: 'Диалог' },
            { color: 'bg-violet-400', label: 'Пропуски' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
