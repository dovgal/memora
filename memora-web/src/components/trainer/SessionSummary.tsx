'use client';
// Итог занятия: не просто процент, а тренерская сводка — что получилось, над
// чем стоит поработать и ОДИН конкретный следующий шаг (lib/trainer/coaching.ts).
// Тон ободряющий: человек только что закончил заниматься, это не место для придирок.

import { CalendarClock, CheckCircle2, Clock, RotateCcw, TrendingUp, Volume2 } from 'lucide-react';
import type { FieldSchema, FlashcardResponse } from '@/types/schema';
import type { SessionSummary as Summary } from '@/lib/trainer/useTrainerSession';
import { playTrainerAudio } from '@/lib/trainer/audio';
import { pluralRu } from '@/lib/trainer/coaching';

export function SessionSummaryView({
  summary, cards, schema, onClose, onRestart, closeLabel,
}: {
  summary: Summary;
  cards: FlashcardResponse[];
  schema?: FieldSchema[];
  onClose: () => void;
  onRestart: () => void;
  closeLabel: string;
}) {
  const stats = [
    { icon: <CheckCircle2 className="text-emerald-500" size={20} />, value: `${summary.accuracy}%`, label: 'верных ответов' },
    { icon: <TrendingUp className="text-qz-accent" size={20} />, value: summary.cardsMovedUp, label: `${pluralRu(summary.cardsMovedUp, ['слово', 'слова', 'слов'])} продвинулось` },
    { icon: <CalendarClock className="text-amber-500" size={20} />, value: summary.dueTomorrow, label: 'вернутся завтра' },
    { icon: <Clock className="text-qz-text-muted" size={20} />, value: `${summary.minutes} мин`, label: 'заняло' },
  ];

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-300">
      <section className="bg-qz-card border border-qz-border-light px-5 py-8 sm:p-10 rounded-3xl text-center shadow-sm">
        <h2 className="text-2xl sm:text-3xl font-bold text-qz-text">{summary.heading}</h2>
        <p className="text-qz-text-muted mt-1">
          {summary.answered} {pluralRu(summary.answered, ['задание', 'задания', 'заданий'])} за {summary.minutes} мин
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
          {stats.map(s => (
            <div key={s.label} className="bg-qz-bg p-4 rounded-2xl border border-qz-border-light">
              <div className="flex justify-center mb-1">{s.icon}</div>
              <div className="text-2xl font-bold text-qz-text tabular-nums">{s.value}</div>
              <div className="text-[11px] font-semibold text-qz-text-muted leading-tight mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <p className="mt-7 text-base text-qz-text leading-relaxed bg-qz-accent/5 border border-qz-accent/20 rounded-2xl px-5 py-4 text-left">
          <span className="block text-xs font-bold uppercase tracking-wider text-qz-accent mb-1">Что дальше</span>
          {summary.nextStep}
        </p>
      </section>

      {summary.weakCards.length > 0 && (
        <section className="bg-qz-card border border-qz-border-light rounded-3xl p-5 sm:p-6">
          <h3 className="text-xs font-bold text-qz-text-muted uppercase tracking-wider mb-3">Стоит послушать ещё раз</h3>
          <ul className="divide-y divide-qz-border-light">
            {summary.weakCards.map(c => {
              const card = cards.find(x => x.id === c.cardId) ?? null;
              return (
                <li key={c.cardId} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="text-base text-qz-text min-w-0">
                    <span className="font-semibold break-words">{c.text}</span>
                    <span className="text-qz-text-muted"> — {c.translation}</span>
                  </span>
                  {c.lang !== 'ru' && (
                    <span className="flex items-center flex-shrink-0">
                      <button
                        onClick={() => void playTrainerAudio({ text: c.text, lang: c.lang, card, side: c.side, schema })}
                        aria-label={`Прослушать «${c.text}»`}
                        className="p-2.5 rounded-xl text-qz-text-muted hover:text-qz-accent hover:bg-qz-accent/10 transition-colors"
                      >
                        <Volume2 size={18} />
                      </button>
                      <button
                        onClick={() => void playTrainerAudio({ text: c.text, lang: c.lang, card, side: c.side, schema, slow: true })}
                        aria-label={`Прослушать «${c.text}» медленно`}
                        className="px-2 py-2.5 rounded-xl text-xs font-bold text-qz-text-muted hover:text-qz-accent hover:bg-qz-accent/10 transition-colors"
                      >
                        0.75×
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-qz-border-light text-qz-text font-semibold hover:bg-qz-card transition-colors"
        >
          <RotateCcw size={16} /> Ещё занятие
        </button>
        <button
          onClick={onClose}
          className="bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold py-3.5 px-8 rounded-2xl transition-colors"
        >
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
