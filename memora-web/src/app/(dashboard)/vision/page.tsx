'use client';
// Тренажёр «Зоркий глаз» — гимнастика для глаз для детей.
//
// Устройство: распорядок дня (утро / днём / после школы / вечер), внутри —
// упражнения с анимацией и таймером. Мотивация построена на серии дней
// подряд и звёздах, а не на обещаниях результата: обещать ребёнку, что
// зрение восстановится, было бы нечестно.

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Eye, Star, Flame, ShieldAlert, ChevronRight, Sparkles } from 'lucide-react';
import { ExercisePlayer } from '@/components/vision/ExercisePlayer';
import { VISION_EXERCISES, DAY_PLAN, DAILY_PROGRAM, type VisionExercise } from '@/data/vision/exercises';

const KEY = 'memora.vision.progress.v1';

interface Progress {
  /** Сколько раз выполнено каждое упражнение. */
  counts: Record<string, number>;
  /** Даты занятий, YYYY-MM-DD. */
  days: string[];
}

function load(): Progress {
  if (typeof window === 'undefined') return { counts: {}, days: [] };
  try { return JSON.parse(window.localStorage.getItem(KEY) || '') as Progress; }
  catch { return { counts: {}, days: [] }; }
}

/** Серия: сколько дней подряд, считая от сегодня. */
function streakOf(days: string[]): number {
  const set = new Set(days);
  let n = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export default function VisionPage() {
  const [progress, setProgress] = useState<Progress>(load);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [runIdx, setRunIdx] = useState<number | null>(null);   // индекс в комплексе

  const byId = useMemo(() => new Map(VISION_EXERCISES.map(e => [e.id, e])), []);
  const stars = useMemo(() => Object.values(progress.counts).reduce((a, b) => a + b, 0), [progress]);
  const streak = useMemo(() => streakOf(progress.days), [progress]);

  const markDone = useCallback((id: string) => {
    setProgress(prev => {
      const today = new Date().toISOString().slice(0, 10);
      const next: Progress = {
        counts: { ...prev.counts, [id]: (prev.counts[id] ?? 0) + 1 },
        days: prev.days.includes(today) ? prev.days : [...prev.days, today],
      };
      try { window.localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
      return next;
    });
  }, []);

  const active: VisionExercise | null =
    runIdx !== null ? byId.get(DAILY_PROGRAM[runIdx]) ?? null
    : activeId ? byId.get(activeId) ?? null
    : null;

  // ---------- Экран упражнения ----------
  if (active) {
    const inRun = runIdx !== null;
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
          <button onClick={() => { setActiveId(null); setRunIdx(null); }}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-4">
            <ChevronLeft className="w-4 h-4" /> Ко всем упражнениям
          </button>
          {inRun && (
            <p className="text-xs font-bold uppercase tracking-wider text-[#4255ff] mb-2">
              Комплекс · упражнение {(runIdx ?? 0) + 1} из {DAILY_PROGRAM.length}
            </p>
          )}
          <ExercisePlayer
            key={`${active.id}-${runIdx ?? 'solo'}`}
            ex={active}
            onDone={markDone}
            onNext={inRun && (runIdx ?? 0) < DAILY_PROGRAM.length - 1
              ? () => { setRunIdx(i => (i ?? 0) + 1); window.scrollTo(0, 0); }
              : undefined}
          />
          {inRun && (runIdx ?? 0) === DAILY_PROGRAM.length - 1 && (
            <div className="mt-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center">
              <p className="text-2xl mb-1">🏆</p>
              <p className="font-bold text-foreground">Весь комплекс пройден! Молодец!</p>
              <button onClick={() => { setRunIdx(null); setActiveId(null); }}
                className="mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl">
                Вернуться
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Обзор ----------
  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Link href="/courses" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-3">
          <ChevronLeft className="w-4 h-4" /> К каталогу
        </Link>

        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2 mb-2">
          <Eye className="w-7 h-7 text-[#4255ff]" /> Зоркий глаз
        </h1>
        <p className="text-qz-text-muted mb-5 max-w-2xl">
          Гимнастика для глаз по методу Бейтса и привычки, которые берегут зрение.
          Следи за звёздочкой глазами, отдыхай в «домике» из ладошек и собирай звёзды каждый день.
        </p>

        {/* Прогресс */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <Star className="w-5 h-5 text-qz-accent mx-auto mb-1 fill-[#ffcd1f]" />
            <p className="text-2xl font-bold text-foreground">{stars}</p>
            <p className="text-qz-text-muted text-xs">звёзд собрано</p>
          </div>
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{streak}</p>
            <p className="text-qz-text-muted text-xs">дней подряд</p>
          </div>
          <div className="bg-qz-card border border-border rounded-2xl p-4 text-center col-span-2 sm:col-span-1">
            <Sparkles className="w-5 h-5 text-[#4255ff] mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{progress.days.length}</p>
            <p className="text-qz-text-muted text-xs">дней всего</p>
          </div>
        </div>

        {/* Запуск всего комплекса */}
        <button onClick={() => { setRunIdx(0); window.scrollTo(0, 0); }}
          className="w-full mb-7 rounded-3xl p-6 text-left bg-gradient-to-br from-[#4255ff] to-[#7048e8] text-white hover:brightness-110 transition-all">
          <p className="text-xs font-bold uppercase tracking-wider opacity-80 mb-1">Каждый день</p>
          <p className="text-2xl font-bold mb-1">Пройти весь комплекс →</p>
          <p className="text-white/80 text-sm">{DAILY_PROGRAM.length} упражнений подряд, примерно 8 минут. Одно за другим, ничего не нужно выбирать.</p>
        </button>

        {/* Инструменты */}
        <div className="grid sm:grid-cols-2 gap-3 mb-7">
          <Link href="/vision/screen"
            className="rounded-2xl p-5 bg-qz-card border border-border hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all">
            <p className="text-2xl mb-1">📱</p>
            <p className="font-bold text-foreground text-sm mb-1">Экранный режим</p>
            <p className="text-qz-text-muted text-xs">Таймер 20-20-20, правило локтя и напоминания об отдыхе — против того, из-за чего зрение и падает.</p>
          </Link>
          <Link href="/vision/chart"
            className="rounded-2xl p-5 bg-qz-card border border-border hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all">
            <p className="text-2xl mb-1">🖨️</p>
            <p className="font-bold text-foreground text-sm mb-1">Таблица для печати</p>
            <p className="text-qz-text-muted text-xs">Сивцева и Орловой, точные размеры знаков, контрольная линия для проверки масштаба печати.</p>
          </Link>
        </div>

        {/* Распорядок дня */}
        <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">Когда что делать</h2>
        <div className="space-y-4 mb-8">
          {DAY_PLAN.map(part => (
            <section key={part.id} className="bg-qz-card border border-border rounded-2xl p-5">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-xl">{part.emoji}</span>
                <h3 className="font-bold text-foreground">{part.title}</h3>
                <span className="text-qz-text-muted text-xs">{part.when}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {part.items.map(id => {
                  const e = byId.get(id);
                  if (!e) return null;
                  const done = progress.counts[id] ?? 0;
                  return (
                    <button key={id} onClick={() => { setActiveId(id); window.scrollTo(0, 0); }}
                      className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 hover:bg-[#4255ff]/5 rounded-xl px-3 py-2 transition-colors">
                      <span className="text-lg">{e.emoji}</span>
                      <span className="text-sm font-semibold text-foreground">{e.title}</span>
                      {done > 0 && <span className="text-[10px] text-qz-accent font-bold">×{done}</span>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Все упражнения */}
        <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">Все упражнения</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
          {VISION_EXERCISES.map(e => {
            const done = progress.counts[e.id] ?? 0;
            return (
              <button key={e.id} onClick={() => { setActiveId(e.id); window.scrollTo(0, 0); }}
                className="text-left bg-qz-card border border-border rounded-2xl p-4 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-3xl">{e.emoji}</span>
                  {done > 0 && (
                    <span className="text-xs text-qz-accent font-bold inline-flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-[#ffcd1f]" /> {done}
                    </span>
                  )}
                </div>
                <p className="font-bold text-foreground text-sm mb-1">{e.title}</p>
                <p className="text-qz-text-muted text-xs leading-relaxed flex-1">{e.short}</p>
                <span className="text-[#4255ff] text-xs font-semibold mt-2 inline-flex items-center gap-1">
                  Начать <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Родителям — честная рамка */}
        <section className="border-l-4 border-amber-500 bg-amber-500/5 rounded-xl p-5">
          <p className="font-bold text-foreground mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500" /> Родителям — прочитайте обязательно
          </p>
          <p className="text-sm font-bold text-red-500 mb-2">Когда гимнастику делать НЕЛЬЗЯ</p>
          <ul className="space-y-2 text-sm text-qz-text-muted mb-4">
            <li>• <strong>Отслоение сетчатки</strong> — гимнастика и массаж глаз категорически запрещены.</li>
            <li>• <strong>Менее 6 месяцев после любой операции на глазах</strong> — тоже запрещены.</li>
            <li>• <strong>Близорукость сильнее −4 диоптрий</strong> — только с осторожностью и не более 3–4 повторов: сетчатка натянута.</li>
            <li>• Появились <strong>головокружение, тошнота, боль</strong> — сразу прекратить, сделать пальминг и показаться врачу.</li>
          </ul>
          <p className="text-sm font-bold text-foreground mb-2">Общие правила</p>
          <ul className="space-y-2 text-sm text-qz-text-muted">
            <li>• Все упражнения — <strong>без волевых усилий</strong>, плавно и медленно, с обязательным морганием. Насилие над глазами вредит.</li>
            <li>• Эта гимнастика <strong>снимает усталость глаз</strong>, но не заменяет очки и врача. Метод Бейтса — авторская система; доказательная медицина не подтверждает, что упражнения исправляют близорукость.</li>
            <li>• <strong>Не отменяйте ребёнку очки</strong> самостоятельно. У детей некорригированное зрение мешает учёбе и может закрепить проблему. Любые изменения — только через офтальмолога.</li>
            <li>• <strong>Никогда не смотрите на солнце открытыми глазами.</strong> В оригинальном методе есть такое упражнение — здесь оно заменено безопасным вариантом с закрытыми веками.</li>
            <li>• Заклеивание одного глаза («пиратские очки») детям — только по назначению врача: без контроля это опасно для закрытого глаза.</li>
            <li>• Что действительно доказано для детей: <strong>1–2 часа на улице каждый день</strong>, перерывы в работе вблизи, хороший свет и расстояние до книги/экрана. Это в тренажёре есть.</li>
            <li>• Если ребёнок жалуется на боль, двоение, резкое ухудшение — к врачу, не к упражнениям.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
