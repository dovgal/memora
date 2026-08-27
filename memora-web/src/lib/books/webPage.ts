// Страница из интернета как книга для читалки.
//
// Разбор идёт в браузере, хотя саму страницу забирает сервер: у браузера уже
// есть полноценный разбор разметки, и он же используется для EPUB. Тащить в
// Rust-образ ещё один разборщик HTML ради этого незачем.

import { type ExtractResult } from './extract';
import { isTextBlock, type Block, type ChapterDraft } from './draft';
import { collectBlocks } from './blocks';

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
export async function parsePage(html: string, source: string): Promise<WebPage> {
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

  // Картинки страницы остаются по своим адресам в интернете: качать их к себе
  // незачем, они и так лежат на чужом сервере.
  const blocks = best
    ? await collectBlocks(best, async el => {
        const src = absolute(imageHref(el), source);
        if (!src) return null;
        // Значки и следящие точки картинками не считаем.
        const w = Number(el.getAttribute('width'));
        const h = Number(el.getAttribute('height'));
        if ((w && w < 60) || (h && h < 60)) return null;
        return { src };
      })
    : [];
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

/** Откуда брать адреса картинки, по порядку. */
const SRC_ATTRS = ['data-lazy-src', 'data-src', 'data-original', 'data-echo', 'src'];
const SET_ATTRS = ['data-lazy-srcset', 'srcset', 'data-srcset'];

/**
 * Настоящий адрес картинки.
 *
 * Страницы сплошь и рядом подставляют картинку скриптом, а в самом теге
 * держат прозрачную заглушку. Читать один только `src` значит выбросить
 * ровно те картинки, ради которых всё и затевалось: на странице monday.com
 * так спрятаны сорок одна из восьмидесяти пяти.
 */
function imageHref(el: Element): string {
  for (const a of SRC_ATTRS) {
    const v = (el.getAttribute(a) ?? '').trim();
    if (v && !v.startsWith('data:')) return v;
  }
  for (const a of SET_ATTRS) {
    // Список вида «адрес 1x, адрес 2x» — берём первый, он же самый лёгкий.
    const first = (el.getAttribute(a) ?? '').split(',')[0]?.trim().split(/\s+/)[0] ?? '';
    if (first && !first.startsWith('data:')) return first;
  }
  return '';
}

function absolute(src: string, base: string): string {
  if (!src) return '';
  try { return new URL(src, base).toString(); } catch { return ''; }
}
