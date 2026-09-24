// Сбор готовых фраз («чанков») юнита — для карточек с интервальным повторением.
//
// Слово учат иначе, чем готовую фразу: фразу нужно проговорить целиком, а не
// подставить перевод одного слова. Отсюда и отдельный сборщик источников,
// где есть фраза целиком + её русский смысл:
//   - pronunciation.pronItems[] (text → ru) — реплики на произношение;
//   - meaning-to-form.productions[] (ru → answers[0]) — готовый ответ на мысль;
//   - vocabulary[] с type === 'phrase' — фразы, размеченные как лексика юнита.
// substitution/transformation НЕ берём: там нет перевода самой фразы —
// substitutions[].cueRu переводит только слово-подстановку, а не шаблон целиком.

import type { EditoExercise, VocabularyItem } from './edito-a1';

export interface UnitChunk {
  fr: string;
  ru: string;
}

/** Минимальная форма юнита, достаточная для сборки чанков (EditoUnit и UnitDetail ей удовлетворяют). */
export interface ChunkSourceUnit {
  vocabulary?: VocabularyItem[];
  exercises: EditoExercise[];
}

/**
 * Ключ сравнения фраз: без регистра, пунктуации и апострофов (прямых и типографских).
 * «C'est combien ?» и «c’est combien» — одна и та же фраза.
 */
export function normalizeChunkKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[.,!?;:«»"“”()…]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Собирает фразы юнита в порядке: сперва лексика юнита (type 'phrase' —
 * так её видит ученик на странице юнита), затем упражнения в их собственном
 * порядке. Пустые/без перевода и повторы (по normalizeChunkKey) пропускаются.
 */
export function collectUnitChunks(unit: ChunkSourceUnit): UnitChunk[] {
  const chunks: UnitChunk[] = [];
  const seen = new Set<string>();

  const push = (fr: string | undefined, ru: string | undefined) => {
    const frText = fr?.trim();
    const ruText = ru?.trim();
    if (!frText || !ruText) return;
    const key = normalizeChunkKey(frText);
    if (!key || seen.has(key)) return;
    seen.add(key);
    chunks.push({ fr: frText, ru: ruText });
  };

  for (const v of unit.vocabulary ?? []) {
    if (v.type === 'phrase') push(v.fr, v.ru);
  }

  for (const ex of unit.exercises) {
    if (ex.type === 'pronunciation') {
      for (const item of ex.pronItems ?? []) push(item.text, item.ru);
    } else if (ex.type === 'meaning-to-form') {
      for (const prod of ex.productions ?? []) push(prod.answers?.[0], prod.ru);
    }
  }

  return chunks;
}
