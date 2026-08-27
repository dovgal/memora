// Страница из интернета как книга для читалки.
//
// Разбор идёт в браузере, хотя саму страницу забирает сервер: у браузера уже
// есть полноценный разбор разметки, и он же используется для EPUB. Тащить в
// Rust-образ ещё один разборщик HTML ради этого незачем.

import { type ExtractResult } from './extract';
import { isTextBlock, type Block, type ChapterDraft } from './draft';

/** Мусор, который есть почти на каждой странице и текстом не является. */
const NOISE = 'script, style, noscript, iframe, svg, form, nav, header, footer, aside, ' +
  'button, figure figcaption, [aria-hidden="true"], [role="navigation"], [role="banner"], ' +
  '[role="contentinfo"], .advertisement, .ads, .cookie, .banner';

/** Где обычно лежит текст статьи — в порядке убывания надёжности. */
const CANDIDATES = ['article', 'main', '[role="main"]', '.article', '.post', '.entry-content', 'body'];

/**
 * Сколько «настоящего» текста в узле. Считаем только абзацы: меню и подписи к
 * картинкам тоже состоят из слов, но читать их никто не собирается.
 */
function paragraphWeight(node: Element): number {
  let total = 0;
  for (const p of Array.from(node.querySelectorAll('p, blockquote, li'))) {
    total += (p.textContent ?? '').trim().length;
  }
  return total;
}

export interface WebPage extends ExtractResult {
  /** Адрес после переходов — показываем его как автора книги. */
  source: string;
}

/** Забрать и разобрать страницу. Забирает сервер: чужие сайты браузеру не отдают. */
export async function fetchWebPage(url: string, idToken?: string): Promise<WebPage> {
  const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  const res = await fetch(`${base}/api/web/fetch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as { url: string; html: string };
  return parsePage(data.html, data.url);
}

/** Разобрать разметку страницы в главы. */
export function parsePage(html: string, source: string): WebPage {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const title = (doc.querySelector('h1')?.textContent
    ?? doc.querySelector('title')?.textContent
    ?? 'Страница из интернета').replace(/\s+/g, ' ').trim();

  const language = (doc.documentElement.getAttribute('lang') ?? '')
    .trim().slice(0, 2).toLowerCase();

  // Убираем мусор до подсчёта: иначе меню перевесит статью на страницах,
  // где текста немного, а ссылок много.
  for (const junk of Array.from(doc.querySelectorAll(NOISE))) junk.remove();

  let best: Element | null = null;
  let bestWeight = 0;
  for (const selector of CANDIDATES) {
    for (const node of Array.from(doc.querySelectorAll(selector))) {
      const weight = paragraphWeight(node);
      if (weight > bestWeight) { best = node; bestWeight = weight; }
    }
  }

  const blocks = best ? collectBlocks(best, source) : [];
  const textLength = blocks.filter(isTextBlock).reduce((n, b) => n + b.text.length, 0);
  if (textLength < 200) {
    throw new Error('На странице не нашлось связного текста. Бывает у лент новостей и страниц, где текст рисуется скриптами.');
  }

  return {
    chapters: chunkBlocks(blocks),
    meta: { title, author: hostOf(source), language },
    source,
  };
}

/** Что забираем со страницы. Всё остальное — оформление, оно нам чужое. */
const KEEP = 'h1, h2, h3, h4, p, li, blockquote, img, figcaption';

/**
 * Обходим содержимое по порядку и собираем блоки.
 *
 * Берём только листовые узлы: у вложенных разметка задваивается, и один абзац
 * попал бы в книгу дважды — сначала как часть раздела, потом сам по себе.
 */
function collectBlocks(root: Element, base: string): Block[] {
  const out: Block[] = [];
  const seen = new Set<string>();

  for (const el of Array.from(root.querySelectorAll(KEEP))) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'img') {
      const src = absolute(el.getAttribute('src') ?? el.getAttribute('data-src') ?? '', base);
      // Пустышки-заглушки и следящие пиксели картинками не считаем.
      if (!src || src.startsWith('data:') || seen.has(src)) continue;
      seen.add(src);
      out.push({ kind: 'img', src, alt: (el.getAttribute('alt') ?? '').trim() });
      continue;
    }

    if (el.querySelector('p, li, blockquote')) continue;

    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text.length < 2) continue;
    const key = tag + '|' + text;
    if (seen.has(key)) continue;
    seen.add(key);

    if (tag === 'li') out.push({ kind: 'li', text });
    else if (tag === 'blockquote') out.push({ kind: 'quote', text });
    else if (tag === 'figcaption') out.push({ kind: 'p', text });
    else out.push({ kind: 'h', level: Number(tag.slice(1)) || 2, text });
  }

  // Абзацы добираем отдельно: в выборке выше они идут вперемешку с прочим,
  // а порядок в документе важнее порядка селекторов.
  return reorder(root, out);
}

/** Возвращает блокам порядок, в котором они стоят на странице. */
function reorder(root: Element, blocks: Block[]): Block[] {
  const order = new Map<string, number>();
  let i = 0;
  for (const el of Array.from(root.querySelectorAll(KEEP))) {
    const tag = el.tagName.toLowerCase();
    const key = tag === 'img'
      ? 'img|' + (el.getAttribute('src') ?? el.getAttribute('data-src') ?? '')
      : tag + '|' + (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (!order.has(key)) order.set(key, i++);
  }
  const keyOf = (b: Block) => b.kind === 'img' ? 'img|' + b.src : (b.kind === 'h' ? 'h' + b.level : b.kind === 'li' ? 'li' : b.kind === 'quote' ? 'blockquote' : 'p') + '|' + b.text;
  return [...blocks].sort((a, b) => (order.get(keyOf(a)) ?? 0) - (order.get(keyOf(b)) ?? 0));
}

function absolute(src: string, base: string): string {
  if (!src) return '';
  try { return new URL(src, base).toString(); } catch { return ''; }
}

/** Режем на главы по объёму текста; картинки идут вместе со своим разделом. */
function chunkBlocks(blocks: Block[], targetChars = 12_000): ChapterDraft[] {
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
    // Заголовок — естественная граница: рвать раздел по счётчику некрасиво.
    if (size >= targetChars && b.kind === 'h') flush();
    cur.push(b);
    if (isTextBlock(b)) size += b.text.length;
  }
  flush();
  return chapters.length > 0 ? chapters : [];
}

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; }
}
