'use client';
// Контекстное чтение: ИИ генерирует короткую историю из лексики курса.
// Любое слово можно кликнуть — озвучка + перевод (если слово из словаря курса).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, BookOpenText, Sparkles, Loader2, Eye, EyeOff, Volume2,
} from 'lucide-react';
import type { VocabularyItem } from '@/lib/courses/edito-a1';
import { generateStory, type GeneratedStory } from '@/lib/courses/customCoursesApi';
import { speakInworld } from '@/lib/courses/ttsInworld';

const TOPICS = [
  'повседневная жизнь',
  'путешествие',
  'еда и ресторан',
  'семья и друзья',
  'работа и учёба',
  'выходные',
];

interface Props {
  title: string;
  backHref: string;
  language: string;
  level: string;
  voice: string;
  vocabulary: VocabularyItem[];
}

function normalize(word: string): string {
  return word.toLowerCase().replace(/[.,!?;:«»"()\[\]…]/g, '').trim();
}

export function StoryReading({ title, backHref, language, level, voice, vocabulary }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [topic, setTopic] = useState(TOPICS[0]);
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [activeWord, setActiveWord] = useState<{ word: string; ru?: string } | null>(null);

  // Словарь для быстрого поиска перевода по слову
  const vocabMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vocabulary) {
      if (!v.fr) continue;
      map.set(normalize(v.fr), v.ru);
      // Также индексируем отдельные слова фраз
      for (const part of v.fr.split(/\s+/)) {
        const key = normalize(part);
        if (key.length > 2 && !map.has(key)) map.set(key, v.ru);
      }
    }
    return map;
  }, [vocabulary]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setActiveWord(null);
    setShowTranslation(false);
    try {
      const sample = vocabulary.slice(0, 60);
      const res = await generateStory(sample, { language, level, topic }, idToken);
      setStory(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сгенерировать историю');
    } finally {
      setBusy(false);
    }
  };

  const handleWordClick = (raw: string) => {
    const word = normalize(raw);
    if (!word) return;
    speakInworld(raw.replace(/[«»"]/g, ''), voice).catch(() => {});
    setActiveWord({ word: raw, ru: vocabMap.get(word) });
  };

  const renderStoryText = (text: string) => {
    // Разбиваем на токены, сохраняя пробелы и переносы
    const tokens = text.split(/(\s+)/);
    return tokens.map((tok, i) => {
      if (/^\s+$/.test(tok) || tok === '') return <span key={i}>{tok}</span>;
      const known = vocabMap.has(normalize(tok));
      return (
        <button
          key={i}
          onClick={() => handleWordClick(tok)}
          className={`inline rounded px-0.5 transition-colors cursor-pointer ${
            known
              ? 'text-[#4255ff] hover:bg-[#4255ff]/15 underline decoration-dotted underline-offset-4'
              : 'text-foreground hover:bg-muted'
          }`}
        >
          {tok}
        </button>
      );
    });
  };

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center justify-between mb-6">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {title}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[#ffcd1f] text-sm font-semibold">
            <BookOpenText className="w-4 h-4" /> Чтение
          </span>
        </div>

        {/* Управление */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="bg-qz-bg border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
          >
            {TOPICS.map(t => <option key={t} value={t}>Тема: {t}</option>)}
          </select>
          <button
            onClick={generate}
            disabled={busy}
            className="inline-flex items-center gap-2 bg-[#ffcd1f] hover:brightness-110 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-all"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {story ? 'Новая история' : 'Сгенерировать историю'}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {!story && !busy && (
          <div className="border border-dashed border-border rounded-2xl p-10 text-center">
            <BookOpenText className="w-10 h-10 text-qz-text-muted mx-auto mb-3" />
            <p className="text-foreground font-semibold mb-1">Истории из вашей лексики</p>
            <p className="text-qz-text-muted text-sm max-w-sm mx-auto">
              ИИ напишет короткий текст уровня {level} со словами курса.
              Кликайте по словам — озвучка и перевод. Слова из словаря курса подчёркнуты.
            </p>
          </div>
        )}

        {story && (
          <article className="bg-qz-card border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-3 mb-4">
              <h1 className="text-xl font-bold text-foreground">{story.title}</h1>
              <button
                onClick={() => speakInworld(story.story, voice)}
                className="p-2 rounded-full bg-[#4255ff]/15 text-[#4255ff] hover:bg-[#4255ff]/25 transition-colors shrink-0"
                title="Озвучить всю историю"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>

            <p className="text-base leading-loose mb-4">{renderStoryText(story.story)}</p>

            {/* Активное слово */}
            {activeWord && (
              <div className="bg-[#4255ff]/10 border border-[#4255ff]/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3">
                <span className="text-foreground text-sm">
                  <strong>{activeWord.word}</strong>
                  {activeWord.ru ? <> — {activeWord.ru}</> : <span className="text-qz-text-muted"> · перевода в словаре курса нет</span>}
                </span>
                <button onClick={() => setActiveWord(null)} className="text-qz-text-muted hover:text-foreground text-xs">✕</button>
              </div>
            )}

            <button
              onClick={() => setShowTranslation(t => !t)}
              className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-xs font-semibold transition-colors"
            >
              {showTranslation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showTranslation ? 'Скрыть перевод' : 'Показать перевод'}
            </button>
            {showTranslation && (
              <p className="text-qz-text-muted text-sm leading-relaxed mt-3 border-t border-border pt-3">{story.translation}</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}
