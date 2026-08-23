// Извлечение текста книги в браузере: EPUB, FB2, PDF, DOCX, TXT.
//
// Разбор на клиенте — то же решение, что и для источников: тащить в Rust-образ
// парсеры EPUB и PDF не за чем, а браузер это уже умеет. Сервер получает
// готовые главы обычным JSON.

import type { ChapterDraft } from './draft';

export interface ExtractResult {
  chapters: ChapterDraft[];
  /** Метаданные из самого файла: EPUB и FB2 их несут, остальные форматы — нет. */
  meta: { title: string; author: string; language: string };
}

export type Progress = (done: number, total: number, stage: string) => void;

/**
 * Форматы, которые принимает загрузчик.
 *
 * Кроме расширений перечислены и MIME-типы: на iOS выбор файла по одним
 * расширениям работает плохо — подходящие книги оказываются недоступны для
 * нажатия.
 */
export const ACCEPTED = [
  '.epub', '.fb2', '.txt', '.pdf', '.docx',
  'application/epub+zip',
  'application/x-fictionbook+xml',
  'text/xml',
  'text/plain',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

/** То же для показа человеку. */
export const ACCEPTED_HINT = 'epub · fb2 · txt · pdf · docx';

export function formatOf(file: File): string {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (['epub', 'fb2', 'txt', 'pdf', 'docx'].includes(ext)) return ext;
  if (file.type === 'application/pdf') return 'pdf';
  if (file.type.startsWith('text/')) return 'txt';
  return ext || 'txt';
}

// ---------- Общие помощники ----------

/**
 * Текст в кодировке файла. У русских .txt и .fb2 сплошь и рядом windows-1251:
 * читаем как UTF-8 и, если получили мусор (символы замены), перечитываем.
 */
function decode(buf: ArrayBuffer, declared?: string): string {
  const tryDecode = (label: string) => {
    try { return new TextDecoder(label, { fatal: false }).decode(buf); } catch { return ''; }
  };
  if (declared) {
    const t = tryDecode(declared);
    if (t) return t;
  }
  const utf8 = tryDecode('utf-8');
  const broken = (utf8.match(/�/g) ?? []).length;
  if (broken > utf8.length / 500 + 5) {
    const cp1251 = tryDecode('windows-1251');
    if (cp1251) return cp1251;
  }
  return utf8;
}

/** Текст из HTML/XHTML-узла: абзацы разделяются пустой строкой. */
function textFromHtml(root: Element | Document): string {
  const parts: string[] = [];
  const blocks = root.querySelectorAll('p, div, li, h1, h2, h3, h4, blockquote, br');
  if (blocks.length === 0) {
    return (root.textContent ?? '').replace(/[ \t]+/g, ' ').trim();
  }
  for (const el of Array.from(blocks)) {
    // Берём только листовые блоки, иначе текст задваивается вложенными div.
    if (el.querySelector('p, div, li, blockquote')) continue;
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (t) parts.push(t);
  }
  return parts.join('\n\n');
}

/** Нарезка сплошного текста на главы, когда заголовков в файле нет. */
function chunkText(text: string, targetChars = 12_000): ChapterDraft[] {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const out: ChapterDraft[] = [];
  let cur: string[] = [];
  let size = 0;
  for (const p of paragraphs) {
    cur.push(p);
    size += p.length;
    if (size >= targetChars) {
      out.push({ title: `Часть ${out.length + 1}`, content: cur.join('\n\n') });
      cur = []; size = 0;
    }
  }
  if (cur.length) out.push({ title: `Часть ${out.length + 1}`, content: cur.join('\n\n') });
  return out;
}

/** Заголовок главы в обычном тексте: «Глава 5», «CHAPTER V», «Часть вторая». */
const HEADING = /^\s*(глава|часть|chapter|part|розділ|kapitel|chapitre|capítulo|capitolo)\b[^\n]{0,60}$/i;

function splitByHeadings(text: string): ChapterDraft[] {
  const lines = text.split(/\r?\n/);
  const chapters: ChapterDraft[] = [];
  let title = '';
  let buf: string[] = [];
  const flush = () => {
    const content = buf.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (content) chapters.push({ title: title || `Часть ${chapters.length + 1}`, content });
    buf = [];
  };
  for (const line of lines) {
    if (HEADING.test(line) && line.trim().length < 70) {
      flush();
      title = line.trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  // Заголовков не нашлось (или нашёлся один) — режем по объёму.
  return chapters.length > 1 ? chapters : chunkText(text.replace(/\r?\n(?!\s*\r?\n)/g, ' '));
}

// ---------- EPUB ----------

async function extractEpub(file: File, onProgress?: Progress): Promise<ExtractResult> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parser = new DOMParser();

  const containerRaw = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerRaw) throw new Error('Это не EPUB: нет META-INF/container.xml');
  const container = parser.parseFromString(containerRaw, 'application/xml');
  const opfPath = container.querySelector('rootfile')?.getAttribute('full-path');
  if (!opfPath) throw new Error('EPUB повреждён: не найден OPF');

  const opfRaw = await zip.file(opfPath)?.async('string');
  if (!opfRaw) throw new Error('EPUB повреждён: OPF не читается');
  const opf = parser.parseFromString(opfRaw, 'application/xml');
  const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const meta = {
    title: opf.querySelector('metadata > title, title')?.textContent?.trim() ?? '',
    author: opf.querySelector('metadata > creator, creator')?.textContent?.trim() ?? '',
    language: (opf.querySelector('metadata > language, language')?.textContent ?? '').trim().slice(0, 2).toLowerCase(),
  };

  // manifest: id → href; spine задаёт порядок чтения.
  const hrefById = new Map<string, string>();
  for (const item of Array.from(opf.querySelectorAll('manifest > item'))) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) hrefById.set(id, href);
  }
  const spine = Array.from(opf.querySelectorAll('spine > itemref'))
    .map(r => r.getAttribute('idref'))
    .filter((v): v is string => !!v)
    .map(id => hrefById.get(id))
    .filter((v): v is string => !!v);

  const chapters: ChapterDraft[] = [];
  for (let i = 0; i < spine.length; i++) {
    // Пути внутри OPF относительные, плюс могут быть percent-encoded.
    const path = decodeURIComponent(new URL(spine[i], `file:///${baseDir}`).pathname.replace(/^\//, ''));
    const raw = await zip.file(path)?.async('string');
    onProgress?.(i + 1, spine.length, 'Читаю главы');
    if (!raw) continue;
    const doc = parser.parseFromString(raw, 'application/xhtml+xml');
    const body = doc.querySelector('body') ?? doc.documentElement;
    const title = body.querySelector('h1, h2, h3, title')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const content = textFromHtml(body);
    // Обложки и пустые служебные файлы главами не считаем.
    if (content.length < 120) continue;
    chapters.push({ title: title || `Глава ${chapters.length + 1}`, content });
  }
  if (chapters.length === 0) throw new Error('В EPUB не нашлось текста');
  return { chapters, meta };
}

// ---------- FB2 ----------

async function extractFb2(file: File): Promise<ExtractResult> {
  const buf = await file.arrayBuffer();
  const head = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, 200));
  const declared = head.match(/encoding=["']([\w-]+)["']/i)?.[1];
  const xml = decode(buf, declared);
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('FB2 не разбирается как XML');

  const titleInfo = doc.querySelector('description > title-info');
  const author = titleInfo?.querySelector('author');
  const meta = {
    title: titleInfo?.querySelector('book-title')?.textContent?.trim() ?? '',
    author: [
      author?.querySelector('first-name')?.textContent?.trim(),
      author?.querySelector('last-name')?.textContent?.trim(),
    ].filter(Boolean).join(' '),
    language: (titleInfo?.querySelector('lang')?.textContent ?? '').trim().slice(0, 2).toLowerCase(),
  };

  const body = doc.querySelector('body');
  if (!body) throw new Error('В FB2 нет тела книги');

  const paragraphText = (el: Element) => Array.from(el.querySelectorAll('p, subtitle, v'))
    .map(p => (p.textContent ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');

  // Array.from, а не спред: HTMLCollection в Safari не итерируется, и на
  // мобильном разбор падал с «undefined is not a function».
  const sections = Array.from(body.children).filter(el => el.tagName.toLowerCase() === 'section');
  const chapters: ChapterDraft[] = [];
  for (const s of sections) {
    const title = s.querySelector(':scope > title')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const content = paragraphText(s);
    if (content.length < 40) continue;
    chapters.push({ title: title || `Глава ${chapters.length + 1}`, content });
  }
  if (chapters.length === 0) {
    const all = paragraphText(body);
    if (!all) throw new Error('В FB2 не нашлось текста');
    return { chapters: chunkText(all), meta };
  }
  return { chapters, meta };
}

// ---------- PDF / DOCX / TXT ----------

async function extractPdf(file: File, onProgress?: Progress): Promise<ExtractResult> {
  let text = '';

  // Сначала в браузере: быстро и без загрузки многомегабайтного файла на сервер.
  try {
    const { extractPdfText } = await import('@/lib/pdfExtract');
    const pages = await extractPdfText(file, (page, total) => onProgress?.(page, total, 'Читаю страницы'));
    text = pages.filter(Boolean).join('\n\n');
  } catch {
    // На iOS pdf.js падает внутри себя — молчим и уходим на сервер.
    text = '';
  }

  // Не вышло — разбираем на сервере. Там разбор не зависит от браузера вовсе.
  if (!text.trim()) {
    onProgress?.(0, 1, 'Разбираю PDF на сервере');
    const { pdfTextOnServer } = await import('./api');
    const pages = await pdfTextOnServer(file);
    text = pages.filter(Boolean).join('\n\n');
  }

  if (!text.trim()) {
    throw new Error('В PDF нет текстового слоя — похоже, это сканы. Такой файл читалка не разберёт.');
  }
  return { chapters: chunkText(text), meta: { title: '', author: '', language: '' } };
}

async function extractDocx(file: File): Promise<ExtractResult> {
  const mammoth = await import('mammoth');
  const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const doc = new DOMParser().parseFromString(`<body>${value}</body>`, 'text/html');

  // Заголовки h1/h2 — естественные границы глав в .docx.
  const chapters: ChapterDraft[] = [];
  let title = '';
  let buf: string[] = [];
  const flush = () => {
    const content = buf.join('\n\n').trim();
    if (content) chapters.push({ title: title || `Часть ${chapters.length + 1}`, content });
    buf = [];
  };
  // Тот же случай: .children — HTMLCollection, в Safari его нельзя перебирать.
  for (const el of Array.from(doc.body.children)) {
    const tag = el.tagName.toLowerCase();
    const t = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!t) continue;
    if (tag === 'h1' || tag === 'h2') { flush(); title = t; } else { buf.push(t); }
  }
  flush();
  if (chapters.length === 0) throw new Error('В файле .docx не нашлось текста');
  return {
    chapters: chapters.length > 1 ? chapters : chunkText(chapters[0].content),
    meta: { title: '', author: '', language: '' },
  };
}

async function extractTxt(file: File): Promise<ExtractResult> {
  const text = decode(await file.arrayBuffer());
  if (!text.trim()) throw new Error('Файл пустой');
  return { chapters: splitByHeadings(text), meta: { title: '', author: '', language: '' } };
}

// ---------- Точка входа ----------

/** Метка сборки — чтобы отличать «не работает» от «открыта старая версия». */
export const BUILD = process.env.NEXT_PUBLIC_BUILD || 'dev';

export async function extractBook(file: File, onProgress?: Progress): Promise<ExtractResult> {
  const format = formatOf(file);
  onProgress?.(0, 1, 'Разбираю файл');
  try {
    switch (format) {
      case 'epub': return await extractEpub(file, onProgress);
      case 'fb2':  return await extractFb2(file);
      case 'pdf':  return await extractPdf(file, onProgress);
      case 'docx': return await extractDocx(file);
      default:     return await extractTxt(file);
    }
  } catch (e) {
    // Сообщение браузера само по себе бесполезно: «undefined is not a function»
    // не говорит ни формата, ни шага. Дописываем то, по чему видно, куда смотреть.
    const err = e as { name?: string; message?: string };
    const detail = [
      `формат ${format}`,
      `${Math.round(file.size / 1024)} КБ`,
      err.name && err.name !== 'Error' ? err.name : '',
      err.message ?? String(e),
      `сборка ${BUILD}`,
    ].filter(Boolean).join(' · ');
    throw new Error(detail);
  }
}
