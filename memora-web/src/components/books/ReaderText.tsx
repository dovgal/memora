'use client';
// Текст страницы книги: абзацы → предложения → слова.
//
// Обработчики висят на контейнере, а не на каждом слове: на странице их
// несколько сотен, и отдельные замыкания на каждое ощутимо тормозят
// перерисовку при смене статуса. Всё нужное лежит в data-атрибутах.

import { memo, useMemo } from 'react';
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
}

interface Sentence { idx: number; text: string; tokens: ReturnType<typeof tokenize> }

/** Текст предложения по его сквозному номеру на странице. */
export function sentenceTexts(paragraphs: string[], lang: string): string[] {
  const out: string[] = [];
  for (const p of paragraphs) out.push(...splitSentences(p, lang));
  return out;
}

function buildPage(paragraphs: string[], lang: string): Sentence[][] {
  let idx = 0;
  // Разбиваем без обрезки: пробелы между предложениями нужны при выводе.
  // Нумерация совпадает с sentenceTexts — по ней ищут контекст и читают вслух.
  return paragraphs.map(p =>
    splitSentencesRaw(p, lang).map(text => ({ idx: idx++, text, tokens: tokenize(text, lang) })),
  );
}

export const ReaderText = memo(function ReaderText({
  paragraphs, blocks, lang, vocab, activeWord, activeSentence, fontSize, lineHeight,
}: ReaderTextProps) {
  const page = useMemo(() => buildPage(paragraphs, lang), [paragraphs, lang]);

  /**
   * Нумерация предложений идёт только по текстовым блокам и в том же порядке,
   * что и снаружи: по этим номерам читалка озвучивает и подсвечивает строку.
   * Собьётся порядок — подсветка уедет на чужое предложение.
   */
  const structured = useMemo(() => {
    if (!blocks || blocks.length === 0) return null;
    let idx = 0;
    return blocks.map(b => (
      isTextBlock(b)
        ? { block: b, sentences: splitSentencesRaw(b.text, lang).map(text => ({ idx: idx++, text, tokens: tokenize(text, lang) })) }
        : { block: b, sentences: [] }
    ));
  }, [blocks, lang]);

  const renderSentences = (sentences: Sentence[]) => sentences.map(s => (
    <span
      key={s.idx}
      data-sentence={s.idx}
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

  if (structured) {
    return (
      <div data-reader-text className="select-text" style={{ fontSize: `${fontSize}px`, lineHeight }}>
        {structured.map((item, i) => {
          const b = item.block;
          if (b.kind === 'img') {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={b.src}
                alt={b.alt}
                loading="lazy"
                className="my-5 max-w-full h-auto rounded-xl border border-border mx-auto block"
              />
            );
          }
          if (b.kind === 'h') {
            const size = b.level <= 2 ? 'text-2xl' : 'text-xl';
            return (
              <p key={i} className={`${size} font-bold text-foreground mt-6 mb-3`}>
                {renderSentences(item.sentences)}
              </p>
            );
          }
          if (b.kind === 'li') {
            return (
              <p key={i} className="mb-2 pl-5 relative text-foreground before:content-['•'] before:absolute before:left-1">
                {renderSentences(item.sentences)}
              </p>
            );
          }
          if (b.kind === 'quote') {
            return (
              <p key={i} className="mb-5 pl-4 border-l-4 border-border italic text-foreground">
                {renderSentences(item.sentences)}
              </p>
            );
          }
          return <p key={i} className="mb-5 text-foreground">{renderSentences(item.sentences)}</p>;
        })}
      </div>
    );
  }

  return (
    <div
      data-reader-text
      className="select-text"
      style={{ fontSize: `${fontSize}px`, lineHeight }}
    >
      {page.map((sentences, pi) => (
        <p key={pi} className="mb-5 text-foreground">
          {sentences.map(s => (
            <span
              key={s.idx}
              data-sentence={s.idx}
              className={`transition-colors ${
                activeSentence === s.idx ? 'bg-emerald-400/25 rounded' : ''
              }`}
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
          ))}
        </p>
      ))}
    </div>
  );
});
