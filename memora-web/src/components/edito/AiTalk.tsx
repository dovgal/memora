'use client';
// Свободный разговор с собеседником-моделью на тему раздела.
//
// Отличие от общей разговорной практики — у разговора есть ЗАДАЧА. Не «поболтать
// по-французски», а «записаться на приём, не имея одного документа». Пока задача
// не выполнена, разговор не закончен, и видно, что именно осталось сказать.
//
// Речь идёт через тот же путь, что и в фонетике: запись уходит на своё
// распознавание, и оно возвращает уверенность по каждому слову. Поэтому здесь,
// в отличие от переписки, видно не только «что сказано», но и «что прозвучало
// неразборчиво».

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Mic, Square, Send, Volume2, Loader2, Lightbulb, RotateCcw, Check } from 'lucide-react';
import { converse, type ConverseTurn } from '@/lib/courses/customCoursesApi';
import { speakInworldAndWait } from '@/lib/courses/ttsInworld';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import type { EditoExercise } from '@/lib/courses/edito-a1';

interface Line extends ConverseTurn {
  translation?: string;
  correction?: string | null;
  /** Слова, прозвучавшие неразборчиво (только для своих реплик). */
  weak?: string[];
}

interface Props {
  exercise: EditoExercise;
  voice?: string;
  speechLang?: string;
  onComplete?: () => void;
}

/** Ниже этого порога слово считается неразборчивым. Подобрано на фонетике. */
const WEAK = 0.6;

/** Значимые слова подсказки: по ним видно, прозвучала ли эта мысль. */
function keyWords(hint: string): string[] {
  return hint
    .toLowerCase()
    .replace(/[^a-zà-ÿ'\s]/g, ' ')
    .split(/[\s']+/)
    .filter(w => w.length > 3);
}

export function AiTalk({ exercise, voice, speechLang = 'fr-FR', onComplete }: Props) {
  const { data: session } = useSession();
  const idToken = (session as { id_token?: string } | null)?.id_token;

  const goals = exercise.goals ?? [];
  const hints = exercise.hints ?? [];

  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [showHints, setShowHints] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speech = useSpeechAttempt(speechLang);
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const scenario = [exercise.situation, exercise.role ? `Собеседник: ${exercise.role}` : '']
    .filter(Boolean).join(' ');

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lines]);

  /** Отмечает выполненные задачи по тому, что прозвучало. */
  const markGoals = useCallback((said: string) => {
    const text = said.toLowerCase();
    setDone(prev => {
      const next = new Set(prev);
      hints.forEach((hint, i) => {
        if (next.has(i)) return;
        const words = keyWords(hint);
        if (words.length === 0) return;
        const hit = words.filter(w => text.includes(w)).length;
        // Половины значимых слов достаточно: человек скажет то же самое
        // своими словами, и требовать дословного совпадения бессмысленно.
        if (hit >= Math.max(1, Math.ceil(words.length / 2))) next.add(i);
      });
      if (next.size >= goals.length && goals.length > 0) onComplete?.();
      return next;
    });
  }, [hints, goals.length, onComplete]);

  const say = useCallback(async (text: string, weak?: string[]) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    setDraft('');
    const mine: Line = { role: 'user', content: clean, weak };
    const history = [...lines, mine];
    setLines(history);
    markGoals(clean);
    setBusy(true);
    try {
      const r = await converse(
        history.map(l => ({ role: l.role, content: l.content })),
        { language: 'французский', level: exercise.talkLevel || 'A2', scenario },
        idToken,
      );
      setLines(prev => [...prev, { role: 'assistant', content: r.reply, translation: r.translation, correction: r.correction }]);
      void speakInworldAndWait(r.reply, voice);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Собеседник не ответил');
    } finally {
      setBusy(false);
    }
  }, [busy, lines, markGoals, exercise.talkLevel, scenario, idToken, voice]);

  /** Первую реплику подаёт собеседник — иначе непонятно, с чего начинать. */
  const begin = useCallback(async () => {
    if (started.current) return;
    started.current = true;
    setBusy(true);
    try {
      const r = await converse(
        [{ role: 'user', content: 'Commencez la conversation, une seule phrase.' }],
        { language: 'французский', level: exercise.talkLevel || 'A2', scenario },
        idToken,
      );
      setLines([{ role: 'assistant', content: r.reply, translation: r.translation, correction: null }]);
      void speakInworldAndWait(r.reply, voice);
    } catch {
      setError('Собеседник не отозвался. Попробуйте ещё раз.');
      started.current = false;
    } finally {
      setBusy(false);
    }
  }, [exercise.talkLevel, scenario, idToken, voice]);

  const record = async () => {
    if (speech.recording) {
      const text = await speech.stop();
      if (!text) { setError('Не расслышал. Попробуйте ещё раз.'); return; }
      const weak = speech.wordScores().filter(w => w.probability < WEAK).map(w => w.word);
      await say(text, weak);
      return;
    }
    setError(null);
    await speech.start();
  };

  const restart = () => {
    started.current = false;
    setLines([]);
    setDone(new Set());
    setError(null);
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-4 space-y-3">
      <div>
        <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
        {exercise.situation && <p className="text-qz-text-muted text-xs mt-0.5">{exercise.situation}</p>}
      </div>

      {goals.length > 0 && (
        <div className="border border-border rounded-xl p-3">
          <p className="text-xs uppercase tracking-wider font-bold text-qz-text-muted mb-2">
            Задача — успеть сказать ({done.size}/{goals.length})
          </p>
          <ul className="space-y-1">
            {goals.map((g, i) => (
              <li key={g} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 w-4 h-4 rounded border shrink-0 flex items-center justify-center ${
                  done.has(i) ? 'bg-emerald-500 border-emerald-500' : 'border-border'
                }`}>
                  {done.has(i) && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className={done.has(i) ? 'text-qz-text-muted line-through' : 'text-foreground'}>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {lines.length === 0 && !busy && (
          <button
            onClick={() => void begin()}
            className="w-full bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold text-sm px-4 py-3 rounded-xl transition-colors"
          >
            Начать разговор
          </button>
        )}
        {lines.map((l, i) => (
          <div key={i} className={l.role === 'user' ? 'text-right' : ''}>
            <div className={`inline-block max-w-[85%] text-left rounded-2xl px-3 py-2 ${
              l.role === 'user' ? 'bg-[#4255ff]/12 border border-[#4255ff]/30' : 'bg-qz-bg border border-border'
            }`}>
              <p className="text-foreground text-sm">{l.content}</p>
              {l.translation && <p className="text-qz-text-muted text-xs mt-1">{l.translation}</p>}
              {l.correction && (
                <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">Точнее: {l.correction}</p>
              )}
              {l.weak && l.weak.length > 0 && (
                <p className="text-qz-text-muted text-xs mt-1">
                  Неразборчиво: <b className="text-foreground">{l.weak.join(', ')}</b>
                </p>
              )}
              {l.role === 'assistant' && (
                <button onClick={() => void speakInworldAndWait(l.content, voice)}
                  className="mt-1 text-qz-text-muted hover:text-foreground">
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {busy && <Loader2 className="w-4 h-4 animate-spin text-qz-text-muted" />}
        <div ref={endRef} />
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}
      {speech.error && <p className="text-red-500 text-xs">{speech.error}</p>}

      {lines.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void record()}
              disabled={busy || speech.transcribing}
              className={`inline-flex items-center gap-1.5 font-bold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                speech.recording ? 'bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {speech.recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {speech.recording ? 'Готово' : 'Сказать'}
            </button>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void say(draft); }}
              placeholder="…или напишите"
              className="flex-1 min-w-0 bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
            />
            <button onClick={() => void say(draft)} disabled={busy || !draft.trim()}
              className="p-2.5 rounded-xl border border-border text-qz-text-muted hover:text-foreground disabled:opacity-40">
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowHints(v => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border text-qz-text-muted hover:text-foreground px-3 py-1.5 rounded-lg">
              <Lightbulb className="w-3.5 h-3.5" /> {showHints ? 'Спрятать подсказки' : 'Подсказки'}
            </button>
            <button onClick={restart}
              className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border text-qz-text-muted hover:text-foreground px-3 py-1.5 rounded-lg">
              <RotateCcw className="w-3.5 h-3.5" /> Заново
            </button>
          </div>

          {showHints && (
            <div className="flex flex-wrap gap-1.5">
              {hints.map(h => (
                <button key={h} onClick={() => setDraft(h)}
                  className="text-xs border border-border rounded-lg px-2.5 py-1.5 text-qz-text-muted hover:text-foreground hover:border-[#4255ff]/50">
                  {h}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
