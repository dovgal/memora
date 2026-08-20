// Статусы слов читателя — как в LingQ: незнакомое подсвечено синим, взятое
// в работу — жёлтым разной насыщенности, выученное сливается с текстом.
// Видимый цвет и есть мера прогресса: чем меньше краски, тем лучше читаешь.

import type { VocabStatus } from './api';

export const STATUS_LABEL: Record<VocabStatus, string> = {
  0: 'Новое',
  1: 'Учу',
  2: 'Узнаю',
  3: 'Знаю',
  4: 'Не учить',
};

export const STATUS_HINT: Record<VocabStatus, string> = {
  0: 'Впервые вижу это слово',
  1: 'Работаю над ним — подсвечено ярко',
  2: 'Узнаю в тексте, но не всегда помню перевод',
  3: 'Выучено — подсветка снимается',
  4: 'Имя, число, термин — в словарь не нужно',
};

/**
 * Цвет подсветки слова. Значения подобраны так, чтобы текст поверх оставался
 * читаемым в обеих темах: заливка полупрозрачная, буквы — цвет темы.
 */
export function statusStyle(status: VocabStatus | undefined): string {
  switch (status) {
    case undefined:
    case 0:  return 'bg-[#4255ff]/15 border-b-2 border-[#4255ff]/50';
    case 1:  return 'bg-amber-400/45 border-b-2 border-amber-500/70';
    case 2:  return 'bg-amber-300/22 border-b-2 border-amber-400/40';
    case 3:  return '';
    case 4:  return 'opacity-70';
  }
}

/** Слова со статусом 0 или отсутствующие в словаре — «незнакомые». */
export function isUnknown(status: VocabStatus | undefined): boolean {
  return status === undefined || status === 0;
}

/** Доля выученного среди встреченных слов — для полосы прогресса книги. */
export function knownShare(words: string[], vocab: Map<string, VocabStatus>): number {
  if (words.length === 0) return 0;
  let known = 0;
  for (const w of words) {
    const s = vocab.get(w);
    if (s === 3 || s === 4) known += 1;
  }
  return Math.round((known / words.length) * 100);
}
