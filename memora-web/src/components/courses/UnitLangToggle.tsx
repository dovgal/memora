'use client';
// Переключатель языка интерфейса юнита: оригинал ↔ перевод (fr/en/…).
// Перевод генерируется на сервере (LLM) и кэшируется; изучаемый язык не меняется.
import { Languages, Loader2 } from 'lucide-react';

const LABELS: Record<string, string> = { fr: 'FR', en: 'EN', de: 'DE', es: 'ES', ru: 'RU' };

export function UnitLangToggle({
  uiLang, target, onSwitch, loading,
}: {
  uiLang: string;            // 'orig' | код языка
  target: string;            // язык перевода (обычно язык курса, напр. 'fr')
  onSwitch: (lang: string) => void;
  loading?: boolean;
}) {
  const label = LABELS[target] ?? target.toUpperCase();
  return (
    <div className="inline-flex items-center gap-1 border border-border rounded-xl p-0.5 text-xs font-semibold" title="Язык интерфейса урока">
      <Languages className="w-3.5 h-3.5 text-qz-text-muted ml-1.5" />
      <button
        onClick={() => onSwitch('orig')}
        className={`px-2.5 py-1 rounded-lg transition-colors ${uiLang === 'orig' ? 'bg-[#4255ff] text-white' : 'text-qz-text-muted hover:text-foreground'}`}
      >
        Ориг.
      </button>
      <button
        onClick={() => onSwitch(target)}
        disabled={loading}
        className={`px-2.5 py-1 rounded-lg transition-colors inline-flex items-center gap-1 disabled:opacity-60 ${uiLang === target ? 'bg-[#4255ff] text-white' : 'text-qz-text-muted hover:text-foreground'}`}
      >
        {loading && uiLang === target ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {label}
      </button>
    </div>
  );
}
