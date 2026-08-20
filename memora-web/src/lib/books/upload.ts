// Загрузка книги: создать запись → отправить главы пачками → финализировать.
//
// Пачками, а не одним запросом: прокси Railway рвёт соединение на 30 секундах,
// и «Война и мир» одним POST туда не проходит. Размер пачки ограничен и по
// числу глав, и по объёму текста — упирается всегда что-то одно.

import { addChapters, createBook, finalizeBook, type Book } from './api';
import type { ChapterDraft } from './draft';

const MAX_BATCH_CHARS = 600_000;
const MAX_BATCH_ITEMS = 40;

export async function uploadBook(
  meta: { title: string; author?: string; language?: string; targetLanguage?: string; sourceFormat?: string },
  chapters: ChapterDraft[],
  onProgress?: (done: number, total: number) => void,
): Promise<Book> {
  if (chapters.length === 0) throw new Error('В книге нет глав');

  const { id } = await createBook(meta);

  let batch: { position: number; title: string; content: string }[] = [];
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
    if (batch.length > 0 && (size + c.content.length > MAX_BATCH_CHARS || batch.length >= MAX_BATCH_ITEMS)) {
      await flush();
    }
    batch.push({ position: i, title: c.title, content: c.content });
    size += c.content.length;
  }
  await flush();

  // Финализация считает объём и, если язык не задан, определяет его моделью.
  return finalizeBook(id);
}
