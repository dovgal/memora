'use client';
// Переключатель языка приложения.

import { Languages } from 'lucide-react';
import { LANGS } from '@/lib/i18n';
import { useLang } from './I18nProvider';

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <label className="inline-flex items-center gap-1.5" title="Язык приложения">
      <Languages className="w-4 h-4 text-qz-text-muted" />
      {!compact && <span className="sr-only">Язык приложения</span>}
      <select
        value={lang}
        onChange={e => setLang(e.target.value as typeof lang)}
        className="bg-transparent border border-border rounded-lg px-2 py-1 text-sm text-foreground outline-none"
      >
        {LANGS.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
