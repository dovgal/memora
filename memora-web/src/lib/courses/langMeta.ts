// Соответствие кода языка курса параметрам речи и озвучки.

export interface LangMeta {
  /** Название языка по-русски (для промптов LLM) */
  label: string;
  /** Код для Web Speech API */
  speechLang: string;
  /** Голос Inworld */
  voice: string;
}

const LANG_META: Record<string, LangMeta> = {
  fr: { label: 'французский', speechLang: 'fr-FR', voice: 'Alain' },
  en: { label: 'английский', speechLang: 'en-US', voice: 'Clive' },
  de: { label: 'немецкий', speechLang: 'de-DE', voice: 'Josef' },
  es: { label: 'испанский', speechLang: 'es-ES', voice: 'Carmen' },
  ru: { label: 'русский', speechLang: 'ru-RU', voice: 'Tatiana' },
};

export function langMeta(code?: string): LangMeta {
  return LANG_META[code ?? 'fr'] ?? LANG_META.fr;
}
