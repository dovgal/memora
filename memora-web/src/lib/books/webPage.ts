// Страница из интернета как книга для читалки.
//
// Разбор идёт в браузере, хотя саму страницу забирает сервер: у браузера уже
// есть полноценный разбор разметки, и он же используется для EPUB. Тащить в
// Rust-образ ещё один разборщик HTML ради этого незачем.

import { chunkText, textFromHtml, type ExtractResult } from './extract';

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

  const text = best ? textFromHtml(best) : '';
  if (text.replace(/\s/g, '').length < 200) {
    throw new Error('На странице не нашлось связного текста. Бывает у лент новостей и страниц, где текст рисуется скриптами.');
  }

  return {
    chapters: chunkText(text),
    meta: { title, author: hostOf(source), language },
    source,
  };
}

function hostOf(url: string): string {
  try { return new URL(url).host.replace(/^www\./, ''); } catch { return ''; }
}
