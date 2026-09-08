// Сбор структуры из разметки: заголовки, списки, цитаты и картинки.
//
// Общий для страниц из интернета и книг в EPUB, FB2 и DOCX: разметка у них
// разная, а строение одинаковое. Отличается только то, откуда берётся сама
// картинка, — это и передаётся отдельно.

import { isTextBlock, type Block, type ChapterDraft } from './draft';

/** Что забираем. Всё остальное — оформление, оно нам чужое. */
const KEEP = 'h1, h2, h3, h4, p, li, blockquote, img, image, figcaption';

/** Как достать картинку: вернуть адрес, файл или ничего, если она не нужна. */
export type ImageResolver = (el: Element) => Promise<{ src?: string; data?: Blob } | null>;

/**
 * Обход содержимого по порядку документа.
 *
 * Берём только листовые узлы: у вложенных разметка задваивается, и один абзац
 * попал бы в книгу дважды — сначала как часть раздела, потом сам по себе.
 */
export async function collectBlocks(
  root: Element,
  resolveImage: ImageResolver,
  opts: {
    /**
     * Выбрасывать ли повторы. Для страницы из интернета — да: меню и врезки
     * повторяют текст. Для книги — нет: там повтор чаще всего реплика диалога
     * («— Что?» дважды на главу), и выбросить её значит испортить текст.
     */
    dedupe?: boolean;
  } = {},
): Promise<Block[]> {
  const dedupe = opts.dedupe ?? true;
  const out: Block[] = [];
  const seen = new Set<string>();

  for (const el of Array.from(root.querySelectorAll(KEEP))) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'img' || tag === 'image') {
      const found = await resolveImage(el);
      if (!found) continue;
      const key = 'img|' + (found.src ?? '') + (found.data?.size ?? '');
      if (dedupe) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      out.push({
        kind: 'img',
        src: found.src ?? '',
        alt: (el.getAttribute('alt') ?? '').trim(),
        ...(found.data ? { data: found.data } : {}),
      });
      continue;
    }

    if (el.querySelector('p, li, blockquote')) continue;

    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 2) continue;
    const key = tag + '|' + text;
    if (dedupe) {
      if (seen.has(key)) continue;
      seen.add(key);
    }

    if (tag === 'li') out.push({ kind: 'li', text });
    else if (tag === 'blockquote') out.push({ kind: 'quote', text });
    else if (tag === 'figcaption') out.push({ kind: 'p', text });
    else if (tag === 'p') out.push({ kind: 'p', text });
    else out.push({ kind: 'h', level: Number(tag.slice(1)) || 2, text });
  }

  return out;
}

/** Картинка из адреса вида data:image/…;base64,… — так их отдаёт разбор DOCX. */
export function blobFromDataUrl(src: string): Blob | null {
  const m = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(src);
  if (!m) return null;
  const [, mime, isBase64, payload] = m;
  try {
    if (isBase64) {
      const bin = atob(payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
}

/** Слишком тяжёлые картинки пропускаем: иллюстрация столько не весит. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Текстовая основа главы: картинки живут рядом, а не внутри текста. */
export function textOfBlocks(blocks: Block[]): string {
  return blocks
    .filter(b => b.kind !== 'img')
    .map(b => (b as { text: string }).text)
    .join('\n\n')
    .trim();
}

/** Тип картинки по расширению: в EPUB он нигде не записан. */
export function mimeOfPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Режет на главы по объёму, не разлучая картинки с их абзацами.
 *
 * Границу стараемся вести по заголовку — рвать раздел посреди мысли некрасиво.
 * Но в тексте из Word заголовков может не быть вовсе, и тогда без второй,
 * жёсткой границы вся книга стала бы одной главой на десять страниц.
 */
export function chunkBlocks(blocks: Block[], targetChars = 12_000): ChapterDraft[] {
  const chapters: ChapterDraft[] = [];
  let cur: Block[] = [];
  let size = 0;

  const flush = () => {
    if (cur.length === 0) return;
    const text = cur.filter(isTextBlock).map(b => b.text).join('\n\n');
    chapters.push({ title: `Часть ${chapters.length + 1}`, content: text, blocks: cur });
    cur = [];
    size = 0;
  };

  for (const b of blocks) {
    if (size >= targetChars && b.kind === 'h') flush();
    // Заголовок так и не встретился — режем по абзацу, но вдвое позже.
    else if (size >= targetChars * 2 && b.kind === 'p') flush();
    cur.push(b);
    if (isTextBlock(b)) size += b.text.length;
  }
  flush();
  return chapters;
}
