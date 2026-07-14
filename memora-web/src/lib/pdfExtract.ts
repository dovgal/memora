// Извлечение текста из PDF в браузере (pdf.js) и нарезка на главы-фрагменты.
// Сервер получает уже готовый текст — Rust-образ не тянет PDF-библиотеки.

import type { UploadChunk } from './sourcesApi';

/** Текст PDF постранично. pdfjs-dist грузится динамически — не попадает в общий бандл. */
export async function extractPdfText(
  file: File,
  onProgress?: (page: number, total: number) => void,
): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  // pdfjs 6: держим ссылку на loadingTask — destroy() переехал на него
  // (у PDFDocumentProxy его больше нет); loadingTask.destroy() рвёт worker
  // и освобождает ресурсы, как прежний doc.destroy().
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map(item => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(text);
    onProgress?.(i, doc.numPages);
  }
  await loadingTask.destroy();
  return pages;
}

/**
 * Группирует страницы в фрагменты ~targetChars (главы-заготовки).
 * Заголовок фрагмента — диапазон страниц: точную структуру глав PDF не отдаёт,
 * а для грунтованной генерации диапазона достаточно.
 */
export function chunkPages(pages: string[], targetChars = 3000): UploadChunk[] {
  const chunks: UploadChunk[] = [];
  let buf: string[] = [];
  let bufChars = 0;
  let startPage = 1;

  const flush = (endPage: number) => {
    const content = buf.join('\n\n').trim();
    if (content) {
      chunks.push({
        title: startPage === endPage ? `Стр. ${startPage}` : `Стр. ${startPage}–${endPage}`,
        content,
      });
    }
    buf = [];
    bufChars = 0;
    startPage = endPage + 1;
  };

  pages.forEach((page, i) => {
    buf.push(page);
    bufChars += page.length;
    if (bufChars >= targetChars) flush(i + 1);
  });
  flush(pages.length);
  return chunks;
}

/** Нарезка простого текста (paste/.txt): по абзацам, фрагменты ~targetChars. */
export function chunkPlainText(text: string, targetChars = 3000): UploadChunk[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const chunks: UploadChunk[] = [];
  let buf: string[] = [];
  let bufChars = 0;

  const flush = () => {
    const content = buf.join('\n\n').trim();
    if (content) chunks.push({ title: `Часть ${chunks.length + 1}`, content });
    buf = [];
    bufChars = 0;
  };

  for (const p of paragraphs) {
    // Слишком длинный абзац — режем жёстко, чтобы не упереться в серверный лимит.
    if (p.length > targetChars * 3) {
      flush();
      for (let i = 0; i < p.length; i += targetChars * 3) {
        buf = [p.slice(i, i + targetChars * 3)];
        bufChars = buf[0].length;
        flush();
      }
      continue;
    }
    buf.push(p);
    bufChars += p.length;
    if (bufChars >= targetChars) flush();
  }
  flush();
  return chunks;
}
