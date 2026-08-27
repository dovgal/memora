// Загрузка книги: создать запись → отправить главы пачками → финализировать.
//
// Пачками, а не одним запросом: прокси Railway рвёт соединение на 30 секундах,
// и «Война и мир» одним POST туда не проходит. Размер пачки ограничен и по
// числу глав, и по объёму текста — упирается всегда что-то одно.

import { addChapters, createBook, finalizeBook, updateBook, uploadBookImage, type Book } from './api';
import type { Block, ChapterDraft } from './draft';

const MAX_BATCH_CHARS = 600_000;
const MAX_BATCH_ITEMS = 40;

/**
 * Потолок на все картинки книги. Иллюстрированная книга укладывается с запасом,
 * а альбом сканов лучше не тащить целиком: это и долгая загрузка, и место.
 */
const MAX_TOTAL_IMAGE_BYTES = 80 * 1024 * 1024;

/**
 * Выкладывает картинки глав и подставляет им адреса.
 *
 * По одной, а не разом: у книги их бывают сотни, и десяток одновременных
 * отправок с телефона скорее валит соединение, чем ускоряет загрузку.
 * Картинка, которая не легла, просто исчезает — терять из-за неё книгу
 * целиком было бы обидно.
 */
async function uploadImages(
  bookId: string,
  chapters: ChapterDraft[],
  onProgress?: (done: number, total: number, stage?: string) => void,
) {
  const pending: Block[] = [];
  for (const c of chapters) {
    for (const b of c.blocks ?? []) if (b.kind === 'img' && b.data) pending.push(b);
  }
  if (pending.length === 0) return;

  let done = 0;
  let bytes = 0;
  for (const b of pending) {
    if (b.kind !== 'img' || !b.data) continue;
    done += 1;
    onProgress?.(done, pending.length, 'Загружаю картинки');
    if (bytes + b.data.size > MAX_TOTAL_IMAGE_BYTES) { delete b.data; continue; }
    try {
      b.src = await uploadBookImage(bookId, b.data);
      bytes += b.data.size;
    } catch {
      b.src = '';
    }
    // Файл больше не нужен, а в JSON главы ему не место.
    delete b.data;
  }

  // Картинки без адреса выбрасываем: пустой тег показал бы значок поломки.
  for (const c of chapters) {
    if (c.blocks) c.blocks = c.blocks.filter(b => b.kind !== 'img' || b.src);
  }
}

export async function uploadBook(
  meta: { title: string; author?: string; topic?: string; language?: string; targetLanguage?: string; sourceFormat?: string; level?: string },
  chapters: ChapterDraft[],
  onProgress?: (done: number, total: number, stage?: string) => void,
): Promise<Book> {
  if (chapters.length === 0) throw new Error('В книге нет глав');

  const { id } = await createBook(meta);

  // Картинки — только теперь: адрес у картинки появляется лишь после того,
  // как книга заведена, раньше его не к чему привязать.
  await uploadImages(id, chapters, onProgress);

  let batch: { position: number; title: string; content: string; blocks?: Block[] }[] = [];
  let size = 0;
  let sent = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await addChapters(id, batch);
    sent += batch.length;
    onProgress?.(sent, chapters.length);
    batch = [];
    size = 0;
  };

  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    if (batch.length > 0 && (size + c.content.length * (c.blocks ? 2 : 1) > MAX_BATCH_CHARS || batch.length >= MAX_BATCH_ITEMS)) {
      await flush();
    }
    batch.push({ position: i, title: c.title, content: c.content, blocks: c.blocks });
    // Глава со строением весит примерно вдвое: тот же текст едет ещё и блоками.
    size += c.content.length * (c.blocks ? 2 : 1);
  }
  await flush();

  const book = await finalizeBook(id);

  // Уровень адаптации — личная настройка читателя, поэтому сохраняется
  // отдельно от книги, уже после её создания.
  if (meta.level) {
    try { return await updateBook(id, { level: meta.level }); } catch { /* прочтём в оригинале */ }
  }
  return book;
}
