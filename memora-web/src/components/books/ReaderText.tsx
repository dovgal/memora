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

export interface ReaderTextProps {
  paragraphs: string[];
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
  paragraphs, lang, vocab, activeWord, activeSentence, fontSize, lineHeight,
}: ReaderTextProps) {
  const page = useMemo(() => buildPage(paragraphs, lang), [paragraphs, lang]);

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
