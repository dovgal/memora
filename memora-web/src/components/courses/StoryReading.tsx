'use client';
// Контекстное чтение v2: ИИ генерирует короткую историю из лексики курса.
// - клик по слову — озвучка + перевод (глоссарий истории → словарь курса) + «в словарь»;
// - «Проверить себя» — cloze по истории: ключевые слова прячутся, учащийся
//   расставляет их из банка слов (детерминированная проверка, без LLM);
// - выбор сложности относительно уровня курса (проще / мой уровень / сложнее).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, BookOpenText, Sparkles, Loader2, Eye, EyeOff, Volume2, BookmarkPlus, CheckCircle2, PencilLine, RotateCcw,
} from 'lucide-react';
import type { VocabularyItem } from '@/lib/courses/edito-a1';
import { generateStory, addToDictionary, type GeneratedStory } from '@/lib/courses/customCoursesApi';
import { speakInworld } from '@/lib/courses/ttsInworld';

const TOPICS = [
  'повседневная жизнь',
  'путешествие',
  'еда и ресторан',
  'семья и друзья',
  'работа и учёба',
  'выходные',
];

const DIFFICULTIES = [
  { value: 'easier', label: 'Проще' },
  { value: 'level', label: 'Мой уровень' },
  { value: 'harder', label: 'Сложнее' },
] as const;

interface Props {
  title: string;
  backHref: string;
  language: string;
  level: string;
  voice: string;
  vocabulary: VocabularyItem[];
  /** id курса — для кнопки «в словарь» (без него кнопка скрыта). */
  courseId?: string;
}

function normalize(word: string): string {
  return word.toLowerCase().replace(/[.,!?;:«»"()\[\]…]/g, '').replace(/’/g, "'").trim();
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface ClozeTarget {
  tokenIndex: number;
  answer: string; // исходный токен (с регистром/пунктуацией)
}

interface ClozeState {
  targets: ClozeTarget[];
  bank: string[];
  filled: (string | null)[];
  checked: boolean;
}

export function StoryReading({ title, backHref, language, level, voice, vocabulary, courseId }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [topic, setTopic] = useState(TOPICS[0]);
  const [difficulty, setDifficulty] = useState<'easier' | 'level' | 'harder'>('level');
  const [story, setStory] = useState<GeneratedStory | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [activeWord, setActiveWord] = useState<{ word: string; ru?: string } | null>(null);
  const [dictState, setDictState] = useState<'idle' | 'busy' | 'added' | 'exists'>('idle');
  const [cloze, setCloze] = useState<ClozeState | null>(null);

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

  // Глоссарий истории — приоритетнее словаря курса (перевод точен в контексте).
  const glossaryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of story?.glossary ?? []) {
      const key = normalize(g.word);
      if (key) map.set(key, g.ru);
      for (const part of g.word.split(/\s+/)) {
        const p = normalize(part);
        if (p.length > 2 && !map.has(p)) map.set(p, g.ru);
      }
    }
    return map;
  }, [story]);

  const lookup = (word: string): string | undefined =>
    glossaryMap.get(word) ?? vocabMap.get(word);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setActiveWord(null);
    setShowTranslation(false);
    setCloze(null);
    try {
      const sample = vocabulary.slice(0, 60);
      const res = await generateStory(sample, {
        language, level, topic,
        difficulty: difficulty === 'level' ? undefined : difficulty,
      }, idToken);
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
    setActiveWord({ word: raw, ru: lookup(word) });
    setDictState('idle');
  };

  const handleAddToDictionary = async () => {
    if (!courseId || !idToken || !activeWord?.ru || dictState === 'busy') return;
    setDictState('busy');
    try {
      const term = normalize(activeWord.word);
      const res = await addToDictionary(courseId, term, activeWord.ru, idToken);
      setDictState(res.alreadyExists ? 'exists' : 'added');
    } catch {
      setDictState('idle');
    }
  };

  // ---------- Cloze «Проверить себя» ----------

  const clozeCandidates = useMemo(() => {
    if (!story) return 0;
    return buildClozeTargets(story, glossaryMap, vocabMap).length;
  }, [story, glossaryMap, vocabMap]);

  const startCloze = () => {
    if (!story) return;
    const targets = buildClozeTargets(story, glossaryMap, vocabMap);
    if (targets.length < 3) return;
    setActiveWord(null);
    setCloze({
      targets,
      bank: shuffle(targets.map(t => t.answer)),
      filled: new Array(targets.length).fill(null),
      checked: false,
    });
  };

  const fillSlot = (word: string) => {
    setCloze(c => {
      if (!c || c.checked) return c;
      const idx = c.filled.findIndex(f => f === null);
      if (idx < 0) return c;
      const filled = [...c.filled];
      filled[idx] = word;
      return { ...c, filled };
    });
  };

  const clearSlot = (idx: number) => {
    setCloze(c => {
      if (!c || c.checked) return c;
      const filled = [...c.filled];
      filled[idx] = null;
      return { ...c, filled };
    });
  };

  const clozeScore = cloze?.checked
    ? cloze.targets.filter((t, i) => normalize(cloze.filled[i] ?? '') === normalize(t.answer)).length
    : 0;

  const renderStoryText = (text: string) => {
    // Разбиваем на токены, сохраняя пробелы и переносы
    const tokens = text.split(/(\s+)/);

    if (cloze) {
      const targetByIndex = new Map(cloze.targets.map((t, ti) => [t.tokenIndex, ti]));
      const activeSlot = cloze.filled.findIndex(f => f === null);
      return tokens.map((tok, i) => {
        const ti = targetByIndex.get(i);
        if (ti === undefined) return <span key={i}>{tok}</span>;
        const value = cloze.filled[ti];
        const correct = cloze.checked && normalize(value ?? '') === normalize(cloze.targets[ti].answer);
        const cls = cloze.checked
          ? (correct ? 'border-emerald-500/70 text-emerald-500' : 'border-red-500/70 text-red-500')
          : ti === activeSlot
            ? 'border-[#4255ff] bg-[#4255ff]/10 text-[#4255ff]'
            : 'border-[#4255ff]/50 text-[#4255ff]';
        return (
          <button
            key={i}
            onClick={() => value && clearSlot(ti)}
            className={`inline-block min-w-[64px] border-b-2 mx-0.5 px-1 text-center transition-colors ${cls}`}
            title={cloze.checked && !correct ? `Правильно: ${cloze.targets[ti].answer}` : value ? 'Убрать слово' : undefined}
          >
            {cloze.checked && !correct
              ? <><span className="line-through opacity-60">{value ?? '···'}</span> {cloze.targets[ti].answer}</>
              : (value ?? ' ')}
          </button>
        );
      });
    }

    return tokens.map((tok, i) => {
      if (/^\s+$/.test(tok) || tok === '') return <span key={i}>{tok}</span>;
      const known = !!lookup(normalize(tok));
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

  const remainingBank = cloze
    ? cloze.bank.filter(w => !cloze.filled.includes(w))
    : [];

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center justify-between mb-6">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {title}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-qz-accent text-sm font-semibold">
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
          <select
            value={difficulty}
            onChange={e => setDifficulty(e.target.value as typeof difficulty)}
            className="bg-qz-bg border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
            title="Сложность относительно уровня курса"
          >
            {DIFFICULTIES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
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
              Кликайте по словам — озвучка, перевод и «в словарь». А потом проверьте
              себя: ключевые слова спрячутся, расставьте их обратно.
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

            {/* Cloze: банк слов и проверка */}
            {cloze && (
              <div className="mb-4">
                {!cloze.checked ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {remainingBank.map((w, i) => (
                        <button
                          key={`${w}-${i}`}
                          onClick={() => fillSlot(w)}
                          className="px-3 py-1.5 rounded-xl border border-border bg-muted text-foreground text-sm hover:border-[#4255ff]/60 transition-colors"
                        >
                          {w}
                        </button>
                      ))}
                      {remainingBank.length === 0 && (
                        <span className="text-qz-text-muted text-xs">Все слова расставлены — проверьте себя.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setCloze(c => c ? { ...c, checked: true } : c)}
                        disabled={cloze.filled.some(f => f === null)}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] disabled:opacity-40 text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Проверить
                      </button>
                      <button onClick={() => setCloze(null)} className="text-qz-text-muted hover:text-foreground text-xs underline">
                        Вернуться к чтению
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap">
                    <p className="text-foreground text-sm font-semibold">
                      Результат: {clozeScore} / {cloze.targets.length}
                      {clozeScore === cloze.targets.length && ' 🏆'}
                    </p>
                    <button
                      onClick={startCloze}
                      className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-xs font-semibold transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Ещё раз
                    </button>
                    <button onClick={() => setCloze(null)} className="text-qz-text-muted hover:text-foreground text-xs underline">
                      Вернуться к чтению
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Активное слово: перевод + в словарь */}
            {activeWord && !cloze && (
              <div className="bg-[#4255ff]/10 border border-[#4255ff]/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-foreground text-sm">
                  <strong>{activeWord.word}</strong>
                  {activeWord.ru ? <> — {activeWord.ru}</> : <span className="text-qz-text-muted"> · перевода нет</span>}
                </span>
                <span className="flex items-center gap-3">
                  {courseId && activeWord.ru && (
                    dictState === 'added' ? (
                      <span className="text-emerald-400 text-xs font-semibold">В словаре ✓</span>
                    ) : dictState === 'exists' ? (
                      <span className="text-qz-text-muted text-xs">Уже в словаре</span>
                    ) : (
                      <button
                        onClick={handleAddToDictionary}
                        disabled={dictState === 'busy'}
                        className="inline-flex items-center gap-1 text-[#4255ff] hover:underline text-xs font-semibold disabled:opacity-50"
                      >
                        {dictState === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                        В словарь
                      </button>
                    )
                  )}
                  <button onClick={() => setActiveWord(null)} className="text-qz-text-muted hover:text-foreground text-xs">✕</button>
                </span>
              </div>
            )}

            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => setShowTranslation(t => !t)}
                className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-xs font-semibold transition-colors"
              >
                {showTranslation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showTranslation ? 'Скрыть перевод' : 'Показать перевод'}
              </button>
              {!cloze && clozeCandidates >= 3 && (
                <button
                  onClick={startCloze}
                  className="inline-flex items-center gap-1.5 text-[#4255ff] hover:underline text-xs font-semibold transition-colors"
                >
                  <PencilLine className="w-4 h-4" /> Проверить себя ({Math.min(clozeCandidates, 6)} пропусков)
                </button>
              )}
            </div>
            {showTranslation && (
              <p className="text-qz-text-muted text-sm leading-relaxed mt-3 border-t border-border pt-3">{story.translation}</p>
            )}
          </article>
        )}
      </div>
    </div>
  );
}

/** Кандидаты в пропуски: ключевые слова истории (глоссарий → словарь курса), встречающиеся в тексте. */
function buildClozeTargets(
  story: GeneratedStory,
  glossaryMap: Map<string, string>,
  vocabMap: Map<string, string>,
): ClozeTarget[] {
  const tokens = story.story.split(/(\s+)/);
  const candidates = new Set<string>();
  for (const key of glossaryMap.keys()) if (!key.includes(' ')) candidates.add(key);
  for (const key of vocabMap.keys()) if (!key.includes(' ')) candidates.add(key);

  const used = new Set<string>();
  const targets: ClozeTarget[] = [];
  tokens.forEach((tok, i) => {
    if (targets.length >= 6 || /^\s*$/.test(tok)) return;
    const n = normalize(tok);
    if (n.length > 2 && candidates.has(n) && !used.has(n)) {
      used.add(n);
      targets.push({ tokenIndex: i, answer: tok });
    }
  });
  return targets;
}
