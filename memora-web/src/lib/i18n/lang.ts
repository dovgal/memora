// Язык приложения.
//
// Выбор принадлежит человеку, а не устройству: Дамир ставит французский, и
// приложение говорит с ним по-французски и на телефоне, и на Boox, и на чужом
// компьютере. Поэтому язык хранится на сервере, а в куки лежит его копия —
// только затем, чтобы страница рисовалась сразу на нужном языке, не мигая
// русским до ответа сервера.

export const LANGS = [
  { code: 'ru', name: 'Русский' },
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
] as const;

export type Lang = (typeof LANGS)[number]['code'];

/** Язык, на котором написан сам код: он же ключ во всех словарях. */
export const BASE_LANG: Lang = 'ru';

export const COOKIE = 'memora.lang';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && LANGS.some(l => l.code === v);
}

/** Язык из куки. На сервере читается из заголовка, в браузере — из document. */
export function langFromCookieString(raw: string | undefined | null): Lang {
  if (!raw) return BASE_LANG;
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(raw);
  return isLang(m?.[1]) ? (m![1] as Lang) : BASE_LANG;
}

/**
 * Кладём копию выбора в куки на год. Путь корневой, иначе страницы из разных
 * разделов увидят разные языки.
 */
export function rememberLang(lang: Lang): void {
  try {
    document.cookie = `${COOKIE}=${lang}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`;
  } catch { /* приватный режим */ }
}
