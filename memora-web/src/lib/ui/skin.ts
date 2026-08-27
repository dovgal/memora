// Оформление приложения: обычное или блочное «пиксельное».
//
// Пиксельный шрифт намеренно НЕ используется: ни у одного из пиксельных
// шрифтов Google Fonts нет кириллицы, и русский текст выводился бы обычным
// шрифтом вперемешку с пиксельным. Блочность даётся геометрией и палитрой —
// рублеными углами, толстыми рамками и жёсткими тенями со сдвигом.

export type Skin = 'default' | 'pixel';

export const SKINS: { id: Skin; title: string; hint: string }[] = [
  { id: 'default', title: 'Обычная', hint: 'Скруглённые формы, мягкие тени' },
  { id: 'pixel', title: 'Блочная', hint: 'Рубленые углы и землистые цвета — в духе кубических игр' },
];

const KEY = 'memora.skin';

let cache: Skin | null = null;
const listeners = new Set<() => void>();

export function subscribeSkin(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function skinSnapshot(): Skin {
  if (cache === null) {
    try {
      cache = window.localStorage.getItem(KEY) === 'pixel' ? 'pixel' : 'default';
    } catch {
      cache = 'default';
    }
  }
  return cache;
}

export function skinServerSnapshot(): Skin {
  return 'default';
}

export function setSkin(skin: Skin): void {
  cache = skin;
  try { window.localStorage.setItem(KEY, skin); } catch { /* приватный режим */ }
  document.documentElement.setAttribute('data-skin', skin);
  listeners.forEach(fn => fn());
}
