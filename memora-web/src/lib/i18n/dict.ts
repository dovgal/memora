// Словари переводов.
//
// Ключ — сама русская строка, а не выдуманный код вроде `button.start`. Так не
// нужно придумывать и держать в голове восемь сотен имён, а код остаётся
// читаемым: в нём видно, что именно будет написано. Нет перевода — показывается
// русский, и приложение не ломается на полуслове.

import fr from './dictionaries/fr.json';
import en from './dictionaries/en.json';
import { BASE_LANG, type Lang } from './lang';

const DICTS: Record<Lang, Record<string, string>> = {
  ru: {},
  fr: fr as Record<string, string>,
  en: en as Record<string, string>,
};

export function translate(text: string, lang: Lang): string {
  if (lang === BASE_LANG) return text;
  return DICTS[lang][text] ?? text;
}

/** Сколько строк переведено — для проверки полноты словаря. */
export function dictSize(lang: Lang): number {
  return Object.keys(DICTS[lang]).length;
}
