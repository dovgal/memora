'use client';
// Тренажёр «слово в контексте»: предложение с пропуском вместо голого слова.
//
// Отдельное слово запоминается хуже, чем слово в живой фразе: вместе с ним
// усваиваются сочетаемость, предлог и род. Три режима отличаются тем, откуда
// приходит предложение — с экрана, из динамика или из собственного голоса.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Eye, Headphones, Volume2, Loader2, Check, X, ChevronRight, ChevronLeft,
  RotateCcw, Mic, MicOff, Lightbulb,
} from 'lucide-react';
import type { SetResponse } from '@/types/schema';
import { blankOut, distractors, fetchCloze, type ClozeItem } from '@/lib/sets/clozeApi';
import { speakInworld } from '@/lib/courses/ttsInworld';
import { voiceFor, speechTag } from '@/lib/books/langs';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { checkDictation, bestTranscript } from '@/lib/courses/dictation';
import { PASS_SCORE } from '@/lib/courses/phonetics/mastery';

type Mode = 'vocabulary' | 'listening' | 'speaking';
type Answering = 'choice' | 'input';

const MODES: { id: Mode; icon: typeof Eye; title: string; hint: string }[] = [
  { id: 'vocabulary', icon: Eye, title: 'Словарь', hint: 'Читаете предложение и вставляете пропущенное слово' },
  { id: 'listening', icon: Headphones, title: 'Аудирование', hint: 'Слушаете предложение и вставляете пропущенное слово' },
  { id: 'speaking', icon: Volume2, title: 'Говорение', hint: 'Читаете предложение и произносите пропущенное слово вслух' },
];

/** Сервер сочиняет не больше четырёх предложений за запрос — просим ровно столько. */
const CHUNK = 4;

interface Question extends ClozeItem {
  before: string;
  after: string;
  options: string[];
}

export function ClozeTrainer({ setId }: { setId: string }) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [set, setSet] = useState<SetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<'setup' | 'preparing' | 'play' | 'done'>('setup');

  const [mode, setMode] = useState<Mode>('vocabulary');
  const [answering, setAnswering] = useState<Answering>('choice');
  const [roundSize, setRoundSize] = useState(10);

  const [queue, setQueue] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<'right' | 'wrong' | null>(null);
  const [right, setRight] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [prepared, setPrepared] = useState(0);

  const [studyLang, setStudyLang] = useState('fr');
  const voice = useMemo(() => voiceFor(studyLang), [studyLang]);
  const speech = useSpeechAttempt(speechTag(studyLang));

  const inputRef = useRef<HTMLInputElement>(null);

  // ---------- Набор ----------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/sets/${setId}`, {
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SetResponse = await res.json();
        if (alive) setSet(data);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'не удалось открыть набор');
      }
    })();
    return () => { alive = false; };
  }, [setId, idToken]);

  const current = queue[idx];

  // ---------- Сбор раунда ----------
  const start = useCallback(async () => {
    if (!set) return;
    setStage('preparing');
    setError(null);
    setPrepared(0);

    const pool = set.flashcards.map(c => c.term).filter(Boolean);
    const shuffled = [...set.flashcards].sort(() => Math.random() - 0.5).slice(0, roundSize);

    const built: Question[] = [];
    try {
      for (let i = 0; i < shuffled.length; i += CHUNK) {
        const chunk = shuffled.slice(i, i + CHUNK);
        const batch = await fetchCloze(setId, chunk.map(c => c.id), idToken);
        if (batch.studyLanguage) setStudyLang(batch.studyLanguage);
        for (const item of batch.items) {
          const cut = blankOut(item.sentence, item.term);
          // Без пропуска вопроса нет — такую карточку молча пропускаем.
          if (!cut) continue;
          built.push({
            ...item,
            before: cut.before,
            after: cut.after,
            options: [item.term, ...distractors(item.term, pool)].sort(() => Math.random() - 0.5),
          });
        }
        setPrepared(built.length);
        // Первую порцию показываем сразу: ждать, пока сочинится весь раунд,
        // незачем — остальное догоняет, пока человек отвечает.
        if (built.length >= CHUNK && stage !== 'play') {
          setQueue([...built]);
          setStage('play');
        }
      }
      if (built.length === 0) {
        setError('Не удалось собрать ни одного предложения. Попробуйте ещё раз или добавьте примеры к карточкам.');
        setStage('setup');
        return;
      }
      setQueue(built);
      setStage('play');
      setIdx(0);
      setRight(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось подготовить раунд');
      setStage('setup');
    }
  }, [set, setId, idToken, roundSize, stage]);

  // Аудирование: предложение звучит сразу, текст открывается только после ответа.
  useEffect(() => {
    if (stage !== 'play' || mode !== 'listening' || !current || verdict) return;
    void speakInworld(current.sentence, voice);
  }, [stage, mode, current, verdict, voice]);

  useEffect(() => {
    if (stage === 'play' && answering === 'input' && mode !== 'speaking') inputRef.current?.focus();
  }, [stage, answering, mode, idx]);

  // ---------- Ответ ----------
  const record = useCallback((ok: boolean, cardId: string) => {
    void fetch('/api/study/fsrs/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
      // Оценки те же, что у карточек: верно — «хорошо», мимо — «заново».
      body: JSON.stringify({ flashcard_id: cardId, rating: ok ? 3 : 1 }),
    }).catch(() => { /* офлайн — раунд всё равно идёт */ });
  }, [idToken]);

  const settle = useCallback((ok: boolean) => {
    if (!current || verdict) return;
    setVerdict(ok ? 'right' : 'wrong');
    if (ok) setRight(r => r + 1);
    record(ok, current.cardId);
  }, [current, verdict, record]);

  const answerChoice = (option: string) => {
    if (verdict) return;
    setPicked(option);
    settle(option.toLowerCase() === current.term.toLowerCase());
  };

  const answerInput = () => {
    if (verdict || !typed.trim()) return;
    const norm = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, '');
    settle(norm(typed) === norm(current.term));
  };

  const answerSpoken = async () => {
    const transcript = await speech.stop();
    if (!transcript) {
      speech.setError('Речь не распознана. Попробуйте ещё раз.');
      return;
    }
    const heard = bestTranscript(current.term, transcript, speech.alternatives());
    const check = checkDictation(current.term, heard, { spoken: true });
    const score = check.total > 0 ? Math.round((check.correct / check.total) * 100) : 0;
    setTyped(heard);
    settle(score >= PASS_SCORE);
  };

  const next = () => {
    setVerdict(null);
    setPicked(null);
    setTyped('');
    setShowTranslation(false);
    speech.setError(null);
    if (idx + 1 >= queue.length) setStage('done');
    else setIdx(i => i + 1);
  };

  // ---------- Экраны ----------

  if (error && stage === 'setup' && !set) {
    return <Shell><p className="text-amber-500">{error}</p></Shell>;
  }
  if (!set) {
    return <Shell><p className="text-qz-text-muted flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> открываю набор…</p></Shell>;
  }

  if (stage === 'setup') {
    return (
      <Shell>
        <Link href={`/set/${setId}`} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm mb-4">
          <ChevronLeft className="w-4 h-4" /> К набору
        </Link>
        <h1 className="text-2xl font-bold text-foreground mb-1">{set.title}</h1>
        <p className="text-qz-text-muted text-sm mb-6">
          Слово в предложении, а не в одиночку: так вместе с ним запоминаются
          сочетаемость, предлог и род.
        </p>

        {error && <p className="mb-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">{error}</p>}

        <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-2">Как тренируемся</p>
        <div className="space-y-2 mb-6">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`w-full text-left border rounded-2xl p-4 flex items-start gap-3 transition-colors ${
                mode === m.id ? 'border-[#4255ff] bg-[#4255ff]/5' : 'border-border hover:border-[#4255ff]/40'}`}>
              <m.icon className={`w-5 h-5 mt-0.5 shrink-0 ${mode === m.id ? 'text-[#4255ff]' : 'text-qz-text-muted'}`} />
              <span className="min-w-0">
                <span className="block font-bold text-foreground">{m.title}</span>
                <span className="block text-qz-text-muted text-sm">{m.hint}</span>
              </span>
              {mode === m.id && <Check className="w-5 h-5 text-[#4255ff] shrink-0" />}
            </button>
          ))}
        </div>

        {mode !== 'speaking' && (
          <>
            <p className="text-xs font-bold uppercase tracking-wider text-qz-text-muted mb-2">Как отвечаем</p>
            <div className="grid grid-cols-2 gap-2 mb-6">
              <button onClick={() => setAnswering('choice')}
                className={`border rounded-2xl p-3 text-center transition-colors ${
                  answering === 'choice' ? 'border-[#4255ff] bg-[#4255ff]/5' : 'border-border'}`}>
                <span className="block font-bold text-foreground">Выбор из четырёх</span>
                <span className="text-xs text-qz-text-muted">быстрее</span>
              </button>
              <button onClick={() => setAnswering('input')}
                className={`border rounded-2xl p-3 text-center transition-colors ${
                  answering === 'input' ? 'border-[#4255ff] bg-[#4255ff]/5' : 'border-border'}`}>
                <span className="block font-bold text-foreground">Ввод текстом</span>
                <span className="text-xs text-qz-text-muted">крепче запоминается</span>
              </button>
            </div>
          </>
        )}

        <label className="block mb-6">
          <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">Предложений в раунде</span>
          <select value={roundSize} onChange={e => setRoundSize(Number(e.target.value))}
            className="w-full mt-1 bg-transparent border border-border rounded-xl px-3 py-2.5 text-foreground">
            {[5, 10, 20, 30].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>

        <button onClick={() => void start()} disabled={set.flashcards.length < 4}
          className="w-full inline-flex items-center justify-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-bold px-6 py-3.5 rounded-2xl text-lg transition-colors">
          Начать <ChevronRight className="w-5 h-5" />
        </button>
        {set.flashcards.length < 4 && (
          <p className="text-xs text-qz-text-muted mt-2 text-center">
            Нужно хотя бы четыре карточки: из остальных берутся неверные варианты.
          </p>
        )}
      </Shell>
    );
  }

  if (stage === 'preparing') {
    return (
      <Shell>
        <p className="text-qz-text-muted flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> подбираю предложения… {prepared > 0 && `готово ${prepared}`}
        </p>
        <p className="text-qz-text-muted text-xs mt-2">
          Для новых слов предложение сочиняется один раз и сохраняется — в следующий раз раунд начнётся сразу.
        </p>
      </Shell>
    );
  }

  if (stage === 'done') {
    const pct = queue.length > 0 ? Math.round((right / queue.length) * 100) : 0;
    return (
      <Shell>
        <h2 className="text-2xl font-bold text-foreground mb-2">Раунд пройден</h2>
        <p className="text-4xl font-bold text-[#4255ff] mb-1">{right} / {queue.length}</p>
        <p className="text-qz-text-muted mb-6">{pct}% верных ответов. Результат учтён в повторении набора.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setStage('setup'); setQueue([]); }}
            className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold px-5 py-3 rounded-2xl">
            <RotateCcw className="w-4 h-4" /> Ещё раунд
          </button>
          <Link href={`/set/${setId}`}
            className="inline-flex items-center gap-2 border border-border text-qz-text-muted hover:text-foreground font-semibold px-5 py-3 rounded-2xl">
            К набору
          </Link>
        </div>
      </Shell>
    );
  }

  if (!current) return <Shell><p className="text-qz-text-muted">Пусто</p></Shell>;

  const hideSentence = mode === 'listening' && !verdict;

  return (
    <Shell>
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href={`/set/${setId}`} className="text-qz-text-muted hover:text-foreground text-sm">Выйти</Link>
        <span className="text-xs text-qz-text-muted">{idx + 1} / {queue.length} · верно {right}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full mb-6">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(idx / queue.length) * 100}%` }} />
      </div>

      {/* Предложение */}
      <div className="bg-qz-card border border-border rounded-2xl p-5 mb-4">
        {hideSentence ? (
          <div className="text-center py-4">
            <button onClick={() => void speakInworld(current.sentence, voice)}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold px-5 py-3 rounded-2xl">
              <Headphones className="w-5 h-5" /> Послушать ещё раз
            </button>
            <p className="text-qz-text-muted text-xs mt-3">Текст откроется после ответа</p>
          </div>
        ) : (
          <p className="text-xl text-foreground leading-relaxed">
            {current.before}
            <span className={`font-bold px-1 rounded ${
              verdict === 'right' ? 'text-emerald-500'
              : verdict === 'wrong' ? 'text-red-500'
              : 'text-[#4255ff]'}`}>
              {verdict ? current.term : '_____'}
            </span>
            {current.after}
          </p>
        )}

        {!hideSentence && (
          <button onClick={() => void speakInworld(current.sentence, voice)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-qz-text-muted hover:text-[#4255ff]">
            <Volume2 className="w-3.5 h-3.5" /> Озвучить
          </button>
        )}

        {current.translation && (
          showTranslation || verdict
            ? <p className="text-qz-text-muted text-sm mt-2">{current.translation}</p>
            : <button onClick={() => setShowTranslation(true)}
                className="mt-2 block text-xs text-qz-text-muted/70 hover:text-[#4255ff] underline decoration-dotted">
                показать перевод
              </button>
        )}
      </div>

      {/* Ответ */}
      {mode === 'speaking' ? (
        <div className="text-center">
          <button
            onClick={() => (speech.recording ? void answerSpoken() : void speech.start())}
            disabled={!!verdict}
            className={`inline-flex items-center gap-2 font-bold px-6 py-3.5 rounded-2xl text-lg transition-colors disabled:opacity-40 ${
              speech.recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'}`}>
            {speech.recording ? <><MicOff className="w-5 h-5" /> Стоп</> : <><Mic className="w-5 h-5" /> Произнести слово</>}
          </button>
          {speech.transcribing && (
            <p className="text-qz-text-muted text-xs mt-2 flex items-center justify-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> распознаю…
            </p>
          )}
          {speech.error && <p className="text-amber-500 text-xs mt-2">{speech.error}</p>}
          {verdict && typed && <p className="text-qz-text-muted text-xs mt-2">Услышано: «{typed}»</p>}
        </div>
      ) : answering === 'choice' ? (
        <div className="grid sm:grid-cols-2 gap-2">
          {current.options.map(opt => {
            const isCorrect = opt.toLowerCase() === current.term.toLowerCase();
            const chosen = picked === opt;
            return (
              <button key={opt} onClick={() => answerChoice(opt)} disabled={!!verdict}
                className={`border rounded-2xl px-4 py-3 text-lg font-semibold transition-colors ${
                  verdict && isCorrect ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : verdict && chosen ? 'border-red-500 bg-red-500/10 text-red-500'
                  : 'border-border text-foreground hover:border-[#4255ff]/50'}`}>
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key !== 'Enter') return; if (verdict) next(); else answerInput(); }}
            disabled={!!verdict}
            placeholder="пропущенное слово"
            className="flex-1 bg-transparent border border-border rounded-2xl px-4 py-3 text-lg text-foreground"
          />
          <button onClick={answerInput} disabled={!!verdict || !typed.trim()}
            className="bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-bold px-5 rounded-2xl">
            Ответить
          </button>
        </div>
      )}

      {/* Итог вопроса */}
      {verdict && (
        <div className="mt-4">
          <p className={`font-bold flex items-center gap-2 ${verdict === 'right' ? 'text-emerald-500' : 'text-red-500'}`}>
            {verdict === 'right' ? <><Check className="w-5 h-5" /> Верно</> : <><X className="w-5 h-5" /> Правильно: {current.term}</>}
          </p>
          {verdict === 'wrong' && (
            <p className="text-qz-text-muted text-xs mt-1 flex items-start gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              Слово вернётся в повторение раньше остальных.
            </p>
          )}
          <button onClick={next}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold px-6 py-3 rounded-2xl">
            Дальше <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10">{children}</div>
    </div>
  );
}
