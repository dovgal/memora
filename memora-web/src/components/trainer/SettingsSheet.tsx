'use client';
// Параметры занятия — компактный лист, не полноэкранная простыня: звук,
// направление вопроса и строгость проверки — вот и всё, что реально нужно
// в моменте. Остальное (виды заданий, их порядок) решает сама лесенка.
// Запоминаются в браузере (lib/trainer/settings.ts).

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { AnswerDirection, GradingMode, TrainerSettings } from '@/lib/trainer/types';

const DIRECTIONS: { value: AnswerDirection; label: string }[] = [
  { value: 'mixed', label: 'Вперемешку' },
  { value: 'front-to-back', label: 'Слово → перевод' },
  { value: 'back-to-front', label: 'Перевод → слово' },
];

const GRADINGS: { value: GradingMode; label: string; hint: string }[] = [
  { value: 'strict', label: 'Строгое', hint: 'Точное совпадение, мелкие опечатки не прощаются.' },
  { value: 'soft', label: 'Мягкое', hint: 'Небольшие опечатки и пропуски засчитываются.' },
];

export function SettingsSheet({
  settings, onChange, onClose,
}: {
  settings: TrainerSettings;
  onChange: (s: TrainerSettings) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl bg-qz-bg border border-qz-border-light shadow-2xl p-6 space-y-6 animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Параметры занятия"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-qz-text">Параметры</h3>
          <button onClick={onClose} aria-label="Закрыть" className="p-2 -m-2 rounded-full hover:bg-qz-card text-qz-text-muted hover:text-qz-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-semibold text-sm text-qz-text">Звук</span>
            <span className="block text-xs text-qz-text-muted mt-0.5">Без звука заданий на слух не будет.</span>
          </span>
          <button
            role="switch"
            aria-checked={settings.sound}
            aria-label="Звук"
            onClick={() => onChange({ ...settings, sound: !settings.sound })}
            className={`w-11 h-6 rounded-full relative transition-colors flex-shrink-0 ${settings.sound ? 'bg-[#4255ff]' : 'bg-qz-border'}`}
          >
            <span className={`w-5 h-5 rounded-full bg-white absolute top-0.5 left-0 transition-transform shadow-sm ${settings.sound ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>

        <div className="space-y-2">
          <span className="font-semibold text-sm text-qz-text">Направление вопроса</span>
          <div className="grid grid-cols-1 gap-2">
            {DIRECTIONS.map(d => (
              <button
                key={d.value}
                onClick={() => onChange({ ...settings, direction: d.value })}
                className={`text-left px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  settings.direction === d.value
                    ? 'bg-[#4255ff]/10 border-[#4255ff] text-qz-text'
                    : 'bg-qz-card border-qz-border-light text-qz-text hover:border-[#4255ff]/40'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="font-semibold text-sm text-qz-text">Строгость проверки</span>
          <div className="grid grid-cols-1 gap-2">
            {GRADINGS.map(g => (
              <button
                key={g.value}
                onClick={() => onChange({ ...settings, grading: g.value })}
                className={`text-left px-4 py-2.5 rounded-xl border transition-colors ${
                  settings.grading === g.value
                    ? 'bg-[#4255ff]/10 border-[#4255ff]'
                    : 'bg-qz-card border-qz-border-light hover:border-[#4255ff]/40'
                }`}
              >
                <div className="text-sm font-semibold text-qz-text">{g.label}</div>
                <div className="text-xs text-qz-text-muted mt-0.5">{g.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold py-3.5 rounded-2xl transition-colors"
        >
          Готово
        </button>
      </div>
    </div>
  );
}
