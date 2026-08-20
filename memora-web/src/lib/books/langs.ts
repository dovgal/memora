// Языки читалки: список для выбора перевода, голоса озвучки и коды для
// распознавания речи. Перечень целевых языков — те, что переводит DeepL.

export const TARGET_LANGS: { code: string; name: string }[] = [
  { code: 'ru', name: 'Русский' },
  { code: 'uk', name: 'Українська' },
  { code: 'en', name: 'English' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'pl', name: 'Polski' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'cs', name: 'Čeština' },
  { code: 'sv', name: 'Svenska' },
  { code: 'da', name: 'Dansk' },
  { code: 'fi', name: 'Suomi' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'el', name: 'Ελληνικά' },
  { code: 'ro', name: 'Română' },
  { code: 'hu', name: 'Magyar' },
  { code: 'bg', name: 'Български' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
];

export function langName(code: string): string {
  return TARGET_LANGS.find(l => l.code === code)?.name ?? (code ? code.toUpperCase() : 'не определён');
}

/**
 * Голос Inworld под язык книги. Явно знаем пять — остальные читает Clive:
 * модель inworld-tts-1.5-max многоязычная, акцент останется, но текст звучит.
 */
export function voiceFor(lang: string): string {
  switch (lang.slice(0, 2)) {
    case 'fr': return 'Alain';
    case 'ru': return 'Tatiana';
    case 'de': return 'Josef';
    case 'es': return 'Carmen';
    default:   return 'Clive';
  }
}

/** Тег BCP-47 для Web Speech API — распознаванию нужен регион. */
export function speechTag(lang: string): string {
  const map: Record<string, string> = {
    fr: 'fr-FR', en: 'en-US', de: 'de-DE', es: 'es-ES', ru: 'ru-RU', it: 'it-IT',
    pt: 'pt-PT', pl: 'pl-PL', uk: 'uk-UA', nl: 'nl-NL', cs: 'cs-CZ', sv: 'sv-SE',
    da: 'da-DK', fi: 'fi-FI', tr: 'tr-TR', el: 'el-GR', ro: 'ro-RO', hu: 'hu-HU',
    ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR',
  };
  return map[lang.slice(0, 2)] ?? 'en-US';
}
