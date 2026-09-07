// Чистка текста после распознавания (OCR).
//
// Распознанный журнал приносит с собой три беды: обрывки вроде «£ r à» на месте
// вёрстки и рекламы, слова, разорванные переносом на другую строку, и
// вперемешку прямые с типографскими апострофами.
//
// Однозначное чиним сами, здесь же: это точно, мгновенно и бесплатно, а модель
// на такой работе только рискует напридумывать. Модели остаётся то, где нужно
// решать: «struc- турées» склеить без дефиса, а «elle- même» — с дефисом; и
// обрывок ли перед нами или короткая настоящая строка вроде «16 Ce jour là».

import { cleanOcrBlocks } from './api';
import { isTextBlock, type Block, type ChapterDraft } from './draft';

/** Столько блоков и знаков сервер берёт за один заход. */
const MAX_BLOCKS = 40;
const MAX_CHARS = 6000;

/** Мягкий перенос и метка порядка байтов: следы разбора, а не текст. */
const INVISIBLE = /[­﻿​]/g;

/**
 * Однозначная правка. Ничего не выбрасывает и не решает — только приводит
 * написание к единому виду.
 */
export function mechanicalClean(text: string): string {
  return text
    .replace(INVISIBLE, '')
    // Апострофы вперемешку: во французском принят типографский.
    .replace(/'/g, '’')
    .replace(/[ \t ]{2,}/g, ' ')
    .replace(/ ([,.;:!?])/g, (m, p) => (p === ',' || p === '.' ? p : m))
    .trim();
}

/**
 * Обрывок, в котором нет ни одного слова.
 *
 * Осторожно: короткая строка сама по себе не мусор — «16 Ce jour là» это
 * оглавление. Выбрасываем только то, где слов нет вовсе.
 */
export function isHopeless(text: string): boolean {
  if (text.length > 60) return false;
  return !/[A-Za-zÀ-ÿ]{3,}/.test(text);
}

export interface OcrReport {
  /** Доля обрывков среди абзацев — по ней и предлагаем чистку. */
  noise: number;
  hyphens: number;
  blocks: number;
}

/** Стоит ли предлагать чистку: считаем следы распознавания. */
export function inspectOcr(chapters: ChapterDraft[]): OcrReport {
  let blocks = 0;
  let junk = 0;
  let hyphens = 0;
  for (const c of chapters) {
    const texts = c.blocks?.length
      ? c.blocks.filter(isTextBlock).map(b => b.text)
      : c.content.split(/\n\n+/);
    for (const t of texts) {
      blocks += 1;
      if (isHopeless(t)) junk += 1;
      if (/[A-Za-zÀ-ÿ]{2,}-\s+[a-zà-ÿ]{2,}/.test(t) || /[A-Za-zÀ-ÿ]-$/.test(t.trim())) hyphens += 1;
    }
  }
  return { noise: blocks ? junk / blocks : 0, hyphens, blocks };
}

/** Порог, за которым чистка предлагается сама. */
export const NOISE_THRESHOLD = 0.06;

export function looksScanned(report: OcrReport): boolean {
  return report.noise >= NOISE_THRESHOLD || report.hyphens > 0;
}

/**
 * Чистит главы на месте и возвращает их же.
 *
 * Работаем по блокам, когда они есть: так картинки остаются на своих местах, а
 * текст рядом с ними чистится вместе с остальным.
 */
export async function cleanChapters(
  chapters: ChapterDraft[],
  language: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ChapterDraft[]> {
  // Собираем ссылки на все текстовые куски книги подряд.
  type Slot = { get: () => string; set: (v: string) => void };
  const slots: Slot[] = [];
  const perChapter: { chapter: ChapterDraft; blocks?: Block[]; paras?: string[] }[] = [];

  for (const c of chapters) {
    if (c.blocks?.length) {
      for (const b of c.blocks) {
        if (!isTextBlock(b)) continue;
        slots.push({ get: () => b.text, set: v => { b.text = v; } });
      }
      perChapter.push({ chapter: c, blocks: c.blocks });
    } else {
      const paras = c.content.split(/\n\n+/);
      for (let i = 0; i < paras.length; i++) {
        slots.push({ get: () => paras[i], set: v => { paras[i] = v; } });
      }
      perChapter.push({ chapter: c, paras });
    }
  }

  // Однозначная правка и явный мусор — до похода к модели: меньше отправим,
  // меньше ждать.
  for (const s of slots) {
    const t = mechanicalClean(s.get());
    s.set(isHopeless(t) ? '' : t);
  }

  const pending = slots.filter(s => s.get().length > 0);
  let done = 0;
  for (let i = 0; i < pending.length; ) {
    const batch: Slot[] = [];
    let chars = 0;
    while (i < pending.length && batch.length < MAX_BLOCKS && chars + pending[i].get().length <= MAX_CHARS) {
      chars += pending[i].get().length;
      batch.push(pending[i]);
      i += 1;
    }
    // Один абзац длиннее всей порции — отправляем его в одиночку.
    if (batch.length === 0) { batch.push(pending[i]); i += 1; }

    try {
      const r = await cleanOcrBlocks(batch.map(s => s.get()), language);
      if (r.blocks.length === batch.length) {
        batch.forEach((s, k) => s.set(r.blocks[k].trim()));
      }
    } catch {
      // Не почистилось — оставляем как есть. Книга важнее чистоты.
    }
    done += batch.length;
    onProgress?.(done, pending.length);
  }

  // Опустевшие куски убираем, текст главы пересобираем из того, что осталось.
  for (const entry of perChapter) {
    if (entry.blocks) {
      entry.chapter.blocks = entry.blocks.filter(b => !isTextBlock(b) || b.text.trim().length > 0);
      entry.chapter.content = entry.chapter.blocks
        .filter(isTextBlock).map(b => b.text).join('\n\n').trim();
    } else if (entry.paras) {
      entry.chapter.content = entry.paras.filter(p => p.trim().length > 0).join('\n\n').trim();
    }
  }
  return chapters.filter(c => c.content.length > 0);
}
