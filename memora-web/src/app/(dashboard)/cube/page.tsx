'use client';
// Курс «Кубик Рубика»: семь этапов послойной сборки с анимированным кубом.
// Каждый алгоритм проигрывается на настоящей модели куба — видно, что именно
// поворачивается, а нотация подсвечивается синхронно с движением.

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Box, Check, ChevronRight, Lightbulb, Target } from 'lucide-react';
import { AlgorithmPlayer } from '@/components/cube/AlgorithmPlayer';
import { Cube3D } from '@/components/cube/Cube3D';
import { solvedCube, applySequence } from '@/lib/cube/model';
import { CUBE_STEPS, NOTATION, BASIC_TURNS } from '@/data/cube/course';

const DONE_KEY = 'memora.cube.done';

function loadDone(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(DONE_KEY) || '[]'); } catch { return []; }
}

export default function CubeCoursePage() {
  const [stepId, setStepId] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>(loadDone);

  const step = CUBE_STEPS.find(s => s.id === stepId) ?? null;

  const toggleDone = (id: string) => {
    setDone(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try { window.localStorage.setItem(DONE_KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
      return next;
    });
  };

  // ---------- Экран этапа ----------
  if (step) {
    const i = CUBE_STEPS.indexOf(step);
    const nextStep = CUBE_STEPS[i + 1];
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
          <button onClick={() => setStepId(null)}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-4">
            <ChevronLeft className="w-4 h-4" /> Ко всем этапам
          </button>

          <p className="text-xs font-bold uppercase tracking-wider text-[#4255ff] mb-1">Этап {step.n} из {CUBE_STEPS.length}</p>
          <h1 className="text-2xl font-bold text-foreground mb-2">{step.title}</h1>

          <div className="rounded-xl border-l-4 border-[#4255ff] bg-[#4255ff]/5 p-4 mb-5">
            <p className="text-sm font-bold text-foreground mb-1 flex items-center gap-1.5">
              <Target className="w-4 h-4 text-[#4255ff]" /> Цель этапа
            </p>
            <p className="text-sm text-qz-text-muted">{step.goal}</p>
          </div>

          <div className="space-y-3 mb-6">
            {step.text.map((p, k) => (
              <p key={k} className="text-sm text-qz-text-muted leading-relaxed">{p}</p>
            ))}
          </div>

          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">
            Алгоритмы — нажмите «Показать»
          </h2>
          <div className="space-y-4">
            {step.algorithms.map((a, k) => (
              <div key={k}>
                <div className="mb-2">
                  <p className="font-bold text-foreground text-sm">{a.name}</p>
                  <p className="text-qz-text-muted text-xs">{a.when}</p>
                </div>
                <AlgorithmPlayer algorithm={a.moves} setup={a.setup} loop />
                {a.note && (
                  <p className="text-qz-text-muted text-xs mt-2 flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" /> {a.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-500/5 p-4 mt-6">
            <p className="text-sm font-bold text-foreground mb-1">Проверьте себя</p>
            <p className="text-sm text-qz-text-muted">{step.check}</p>
          </div>

          <div className="flex gap-2 mt-6 flex-wrap">
            <button onClick={() => toggleDone(step.id)}
              className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors ${
                done.includes(step.id) ? 'bg-emerald-500 text-white' : 'border border-border text-foreground'}`}>
              <Check className="w-4 h-4" /> {done.includes(step.id) ? 'Этап освоен' : 'Отметить как освоенный'}
            </button>
            {nextStep && (
              <button onClick={() => { setStepId(nextStep.id); window.scrollTo(0, 0); }}
                className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
                Этап {nextStep.n}: {nextStep.title} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Обзор курса ----------
  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-3">
          <ChevronLeft className="w-4 h-4" /> На главную
        </Link>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 mb-2">
          <Box className="w-7 h-7 text-[#4255ff]" /> Кубик Рубика
        </h1>
        <p className="text-qz-text-muted mb-6 max-w-2xl">
          Послойный метод — тот, которым собирают все начинающие. Семь этапов, шесть алгоритмов.
          Каждый показан на живой модели: нажмите «Показать» и увидите, какой именно слой поворачивается.
        </p>

        {/* Нотация */}
        <section className="bg-qz-card border border-border rounded-2xl p-5 mb-6">
          <h2 className="font-bold text-foreground mb-1">Язык кубика: шесть букв</h2>
          <p className="text-qz-text-muted text-sm mb-4">
            Каждая буква — поворот одной грани на 90° по часовой стрелке, если смотреть на эту грань снаружи.
            Штрих (<span className="font-mono">&apos;</span>) — против часовой, двойка — на 180°.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5">
            {NOTATION.map(n => (
              <div key={n.key} className="border border-border rounded-xl p-3">
                <span className="font-mono font-bold text-[#4255ff] text-lg">{n.key}</span>
                <p className="text-foreground text-xs font-semibold mt-0.5">{n.ru}</p>
                <p className="text-qz-text-muted text-xs">{n.hint}</p>
              </div>
            ))}
          </div>
          <p className="text-qz-text-muted text-sm mb-3">Посмотрите, как выглядит каждый поворот:</p>
          <AlgorithmPlayer
            algorithm={BASIC_TURNS.map(b => b.move).join(' ')}
            title="Все базовые ходы подряд"
            allowScramble
          />
        </section>

        {/* Этапы */}
        <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">Семь этапов сборки</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {CUBE_STEPS.map(s => (
            <button key={s.id} onClick={() => { setStepId(s.id); window.scrollTo(0, 0); }}
              className="text-left bg-qz-card border border-border rounded-2xl p-5 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="w-8 h-8 rounded-xl bg-[#4255ff]/15 text-[#4255ff] font-bold flex items-center justify-center text-sm">
                  {s.n}
                </span>
                {done.includes(s.id) && (
                  <span className="text-xs text-emerald-500 inline-flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> освоен
                  </span>
                )}
              </div>
              <p className="font-bold text-foreground text-sm mb-1">{s.title}</p>
              <p className="text-qz-text-muted text-xs leading-relaxed flex-1">{s.goal}</p>
              <p className="text-[#4255ff] text-xs font-semibold mt-2">
                {s.algorithms.length} {s.algorithms.length === 1 ? 'алгоритм' : 'алгоритма'}
              </p>
            </button>
          ))}
        </div>

        {/* Итоговая цель */}
        <section className="mt-8 bg-qz-card border border-border rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
          <Cube3D state={applySequence(solvedCube(), '')} scale={0.75} />
          <div>
            <h2 className="font-bold text-foreground mb-1">Что получится в конце</h2>
            <p className="text-qz-text-muted text-sm">
              Шесть одноцветных граней. Первые сборки занимают 5–10 минут, после десятка повторов —
              около двух. Главное правило: не бросайте на седьмом этапе, когда куб выглядит сломанным, —
              так и должно быть, это середина последнего алгоритма.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
