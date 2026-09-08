'use client';
// Язык приложения для всего дерева.
//
// При первой отрисовке берётся из куки — это копия выбора, сделанная затем,
// чтобы страница не мигала русским, пока идёт ответ сервера. Настоящий же
// хозяин выбора — сервер: он и решает, если копия устарела (человек сменил
// язык на другом устройстве).

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { BASE_LANG, isLang, langFromCookieString, rememberLang, translate, type Lang } from '@/lib/i18n';
import { getSettings, putSetting } from '@/lib/settingsApi';

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (text: string) => string;
}

const Ctx = createContext<I18n>({ lang: BASE_LANG, setLang: () => {}, t: text => text });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(BASE_LANG);

  // Куки читаем после подключения: на сервере и в браузере первая отрисовка
  // должна совпадать, иначе React ругается на расхождение разметки.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const fromCookie = langFromCookieString(document.cookie);
      if (!cancelled && fromCookie !== BASE_LANG) setLangState(fromCookie);
      try {
        const s = await getSettings();
        if (!cancelled && isLang(s.language) && s.language !== fromCookie) {
          setLangState(s.language);
          rememberLang(s.language);
        }
      } catch {
        // Не вошли — остаёмся на том, что в куки.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    rememberLang(next);
    // Сервер — хозяин выбора, но ждать его незачем: язык уже переключился.
    void putSetting('language', next).catch(() => {});
  }, []);

  const t = useCallback((text: string) => translate(text, lang), [lang]);

  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

/** Перевод строки: ключ — сама русская надпись из кода. */
export function useT(): (text: string) => string {
  return useContext(Ctx).t;
}

export function useLang(): { lang: Lang; setLang: (l: Lang) => void } {
  const { lang, setLang } = useContext(Ctx);
  return { lang, setLang };
}
