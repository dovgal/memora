'use client';
// Текст страницы книги: абзацы → предложения → слова.
//
// Обработчики висят на контейнере, а не на каждом слове: на странице их
// несколько сотен, и отдельные замыкания на каждое ощутимо тормозят
// перерисовку при смене статуса. Всё нужное лежит в data-атрибутах.

import { memo, useEffect, useMemo, useRef } from 'react';
import { tokenize, splitSentences, splitSentencesRaw } from '@/lib/books/tokenize';
import { statusStyle } from '@/lib/books/vocab';
import type { VocabStatus } from '@/lib/books/api';
import { isTextBlock, type Block } from '@/lib/books/draft';

export interface ReaderTextProps {
  paragraphs: string[];
  /** Структура страницы: заголовки, списки, картинки. Пусто — сплошной текст. */
  blocks?: Block[];
  lang: string;
  vocab: Map<string, VocabStatus>;
  /** Ключ выбранного слова — подсвечивается рамкой. */
  activeWord: string | null;
  /** Индекс предложения, которое сейчас звучит (режим чтения вслух). */
  activeSentence: number | null;
  fontSize: number;
  lineHeight: number;
  /**
   * Разворот: перевод единиц страницы, по тем же номерам, что даёт pageUnits.
   * Пусто — обычное чтение в одну колонку.
   */
  translations?: string[] | null;
  /** Язык перевода: по нему делим переведённый абзац на предложения. */
  targetLang?: string;
}

interface Sentence { idx: number; text: string; tokens: ReturnType<typeof tokenize> }

/**
 * Единицы страницы в порядке вывода.
 *
 * Одна и та же нумерация нужна и здесь, и снаружи: по ней читалка заказывает
 * перевод и ставит его напротив нужного абзаца. Разойдётся — перевод уедет.
 */
export function pageUnits(paragraphs: string[], blocks?: Block[]): Block[] {
  if (blocks && blocks.length > 0) return blocks;
  return paragraphs.map(text => ({ kind: 'p', text } as Block));
}

/** Тексты единиц страницы; у картинки текста нет. */
export function pageUnitTexts(paragraphs: string[], blocks?: Block[]): string[] {
  return pageUnits(paragraphs, blocks).map(b => (isTextBlock(b) ? b.text : ''));
}

/** Текст предложения по его сквозному номеру на странице. */
export function sentenceTexts(paragraphs: string[], lang: string): string[] {
  const out: string[] = [];
  for (const p of paragraphs) out.push(...splitSentences(p, lang));
  return out;
}

/** Подсветка пары «предложение — его перевод» при наведении. */
const PAIR_BG = 'rgba(66, 85, 255, 0.14)';

export const ReaderText = memo(function ReaderText({
  paragraphs, blocks, lang, vocab, activeWord, activeSentence, fontSize, lineHeight,
  translations, targetLang,
}: ReaderTextProps) {
  const units = useMemo(() => pageUnits(paragraphs, blocks), [paragraphs, blocks]);
  const parallel = !!translations;

  /**
   * Нумерация предложений идёт только по текстовым единицам и в том же
   * порядке, что и снаружи: по этим номерам читалка озвучивает и подсвечивает
   * строку. Собьётся порядок — подсветка уедет на чужое предложение.
   */
  const model = useMemo(() => {
    let idx = 0;
    return units.map(b => (
      isTextBlock(b)
        ? { block: b, sentences: splitSentencesRaw(b.text, lang).map(text => ({ idx: idx++, text, tokens: tokenize(text, lang) })) }
        : { block: b, sentences: [] as Sentence[] }
    ));
  }, [units, lang]);

  /**
   * Перевод рядом с оригиналом.
   *
   * Переводим абзац целиком — так у переводчика есть связь между
   * предложениями, — а потом делим перевод обратно. Совпало число предложений
   * с оригиналом (обычный случай) — пары точные, и подсвечивается строка
   * напротив строки. Не совпало — переводчик слил или разбил предложения, и
   * тогда подсвечивается абзац целиком: лучше честно грубее, чем указать не на
   * то место.
   */
  const pairs = useMemo(() => {
    if (!translations) return null;
    return model.map((item, i) => {
      if (!isTextBlock(item.block)) return null;
      const whole = (translations[i] ?? '').trim();
      if (!whole) return { whole: '', parts: null as string[] | null };
      const parts = splitSentencesRaw(whole, targetLang || 'en');
      return { whole, parts: parts.length === item.sentences.length ? parts : null };
    });
  }, [translations, model, targetLang]);

  // Подсветку двигаем руками, без состояния: на странице до трёхсот
  // предложений, и перерисовывать их все на каждое движение мыши — верный
  // способ получить рывки, особенно на электронных чернилах.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !parallel) return;
    let lit: HTMLElement[] = [];

    const clear = () => {
      for (const el of lit) el.style.background = '';
      lit = [];
    };
    const light = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest?.('[data-pair]');
      const key = target?.getAttribute('data-pair');
      if (!key) { clear(); return; }
      if (lit.length > 0 && lit[0].getAttribute('data-pair') === key) return;
      clear();
      lit = Array.from(root.querySelectorAll<HTMLElement>(`[data-pair="${key}"]`));
      for (const el of lit) el.style.background = PAIR_BG;
    };

    root.addEventListener('pointerover', light);
    root.addEventListener('pointerdown', light);
    root.addEventListener('pointerleave', clear);
    return () => {
      clear();
      root.removeEventListener('pointerover', light);
      root.removeEventListener('pointerdown', light);
      root.removeEventListener('pointerleave', clear);
    };
  }, [parallel, model]);

  const renderSentences = (sentences: Sentence[], unit: number, paired: boolean) =>
    sentences.map((s, k) => (
      <span
        key={s.idx}
        data-sentence={s.idx}
        {...(paired ? { 'data-pair': `${unit}:${k}` } : {})}
        className={`transition-colors ${activeSentence === s.idx ? 'bg-emerald-400/25 rounded' : ''}`}
      >
        {s.tokens.map((t, ti) => {
          if (!t.word) return <span key={ti}>{t.text}</span>;
          const status = vocab.get(t.key);
          const active = activeWord === t.key;
          return (
            <span
              key={ti}
              data-word={t.key}
              data-raw={t.text}
              data-sentence={s.idx}
              className={`cursor-pointer rounded-[3px] transition-colors hover:bg-foreground/5 ${
                statusStyle(status)
              } ${active ? 'ring-2 ring-[#4255ff] ring-offset-1 ring-offset-transparent' : ''}`}
            >
              {t.text}
            </span>
          );
        })}
      </span>
    ));

  const renderUnit = (item: (typeof model)[number], i: number, paired: boolean) => {
    const b = item.block;
    if (b.kind === 'img') {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={b.src}
          alt={b.alt}
          loading="lazy"
          className="my-5 max-w-full h-auto rounded-xl border border-border mx-auto block"
        />
      );
    }
    const body = renderSentences(item.sentences, i, paired);
    if (b.kind === 'h') {
      return <p className={`${b.level <= 2 ? 'text-2xl' : 'text-xl'} font-bold text-foreground mt-6 mb-3`}>{body}</p>;
    }
    if (b.kind === 'li') {
      return <p className="mb-2 pl-5 relative text-foreground before:content-['•'] before:absolute before:left-1">{body}</p>;
    }
    if (b.kind === 'quote') {
      return <p className="mb-5 pl-4 border-l-4 border-border italic text-foreground">{body}</p>;
    }
    return <p className="mb-5 text-foreground">{body}</p>;
  };

  if (!pairs) {
    return (
      <div ref={rootRef} data-reader-text className="select-text" style={{ fontSize: `${fontSize}px`, lineHeight }}>
        {model.map((item, i) => <div key={i}>{renderUnit(item, i, false)}</div>)}
      </div>
    );
  }

  return (
    <div ref={rootRef} data-reader-text className="select-text" style={{ fontSize: `${fontSize}px`, lineHeight }}>
      {model.map((item, i) => {
        const pair = pairs[i];
        // Картинка идёт во всю ширину: перевода у неё нет.
        if (!pair) return <div key={i}>{renderUnit(item, i, false)}</div>;
        const paired = !!pair.parts;
        return (
          <div
            key={i}
            // Две колонки — когда экран лежит на боку и достаточно широк.
            // Стоя (телефон, Boox в книжной ориентации) перевод идёт под
            // абзацем: в двух узких колонках остаётся по три слова в строке.
            className="grid grid-cols-1 sm:landscape:grid-cols-2 sm:landscape:gap-x-8 items-start"
          >
            <div {...(paired ? {} : { 'data-pair': `u${i}` })}>{renderUnit(item, i, paired)}</div>
            <div
              className="mb-5 text-qz-text-muted sm:landscape:border-l sm:landscape:border-border sm:landscape:pl-6"
              {...(paired ? {} : { 'data-pair': `u${i}` })}
            >
              {pair.whole === '' ? (
                <span className="opacity-40">…</span>
              ) : paired ? (
                pair.parts!.map((t, k) => (
                  <span key={k} data-pair={`${i}:${k}`} className="transition-colors">{t}</span>
                ))
              ) : (
                pair.whole
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
