'use client';
// Упражнение «произнеси и проверь»: СПИСОК — все фразы и слова видны сразу,
// у каждой свои кнопки прослушивания и проверки. Ученик работает с любой
// строкой в любом порядке и переспрашивает столько раз, сколько нужно;
// упражнение засчитано, когда все строки произнесены чисто.

import { useCallback, useMemo, useState } from 'react';
import { Mic, MicOff, Volume2, Turtle, Check, Lightbulb, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { EditoExercise, PronunciationItem } from '@/lib/courses/edito-a1';
import { speakInworld, speakInworldAndWait } from '@/lib/courses/ttsInworld';
import { checkDictation, bestTranscript, type DictationCheck } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';
import { rulesForWord, type ReadingRule } from '@/lib/courses/frenchReadingRules';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { PASS_SCORE } from '@/lib/courses/phonetics/mastery';

const KIND_LABEL: Record<NonNullable<PronunciationItem['kind']>, string> = {
  word: 'Слово',
  phrase: 'Фраза',
  ladder: 'Ступень лесенки',
  twister: 'Скороговорка',
};

interface Attempt {
  score: number;
  check: DictationCheck;
  heard: string;
}

function issuesOf(check: DictationCheck) {
  const out: { word: string; given?: string; rules: ReadingRule[] }[] = [];
  for (const op of check.ops) {
    if ((op.type === 'wrong' || op.type === 'missing') && op.expected) {
      out.push({ word: op.expected, given: op.given, rules: rulesForWord(op.expected).slice(0, 3) });
    }
  }
  return out;
}

export function PronunciationExercise({ exercise, onComplete, voice = 'Alain', speechLang = 'fr-FR' }: {
  exercise: EditoExercise;
  onComplete?: () => void;
  voice?: string;
  speechLang?: string;
}) {
  const items = useMemo(() => exercise.pronItems ?? [], [exercise.pronItems]);
  const [attempts, setAttempts] = useState<Record<number, Attempt>>({});
  /** Индекс строки, которая сейчас записывается (запись всегда одна). */
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  /** Скрытый перевод — режим самопроверки: сначала вспомнить, потом свериться. */
  const [hideRu, setHideRu] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const speech = useSpeechAttempt(speechLang);
  const total = items.length;
  const passedCount = useMemo(
    () => Object.values(attempts).filter(a => a.score >= PASS_SCORE).length,
    [attempts],
  );

  const play = async (text: string) => {
    const r = await speakInworld(text, voice);
    if (!r.ok) speech.setError(`Не удалось озвучить: ${r.error}.`);
  };
  const playSlow = async (text: string) => {
    for (const w of text.split(/\s+/).filter(Boolean)) {
      const r = await speakInworldAndWait(w, voice);
      if (!r.ok) { speech.setError(`Не удалось озвучить: ${r.error}.`); return; }
      await new Promise(res => setTimeout(res, 250));
    }
  };

  const startFor = useCallback(async (idx: number) => {
    speech.setError(null);
    setActiveIdx(idx);
    await speech.start();
  }, [speech]);

  const stopAndCheck = useCallback(async (idx: number) => {
    const transcript = await speech.stop();
    setActiveIdx(null);
    const target = items[idx]?.text;
    if (!target) return;
    if (!transcript) {
      speech.setError('Речь не распознана. Прослушайте свою запись и сравните с образцом — либо откройте курс в Chrome или Safari для автооценки.');
      return;
    }
    const heard = bestTranscript(target, transcript, speech.alternatives());
    const check = checkDictation(target, heard, { spoken: true });
    const score = check.total > 0 ? Math.round((check.correct / check.total) * 100) : 0;
    setAttempts(prev => {
      const next = { ...prev, [idx]: { score, check, heard } };
      const ok = Object.values(next).filter(a => a.score >= PASS_SCORE).length;
      if (ok >= total) onComplete?.();
      return next;
    });
  }, [speech, items, total, onComplete]);

  if (total === 0) return null;

  const pct = Math.round((passedCount / total) * 100);
  const allDone = passedCount >= total;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#4255ff]" /> {exercise.title}
        </h3>
        <span className="text-xs text-qz-text-muted shrink-0">{passedCount} / {total}</span>
      </div>
      <p className="text-qz-text-muted text-xs mb-3">
        {allDone
          ? 'Всё произнесено чисто. Можно перепроверить любую строку ещё раз.'
          : 'Проверьте произношение каждой строки — в любом порядке и сколько угодно раз.'}
      </p>
      {items.some(i => i.ru) && (
        <button
          onClick={() => { setHideRu(v => !v); setRevealed({}); }}
          className="inline-flex items-center gap-1.5 mb-3 border border-border hover:border-[#4255ff]/50 text-qz-text-muted hover:text-foreground text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          {hideRu ? <><EyeOff className="w-3.5 h-3.5" /> Перевод скрыт — показать</> : <><Eye className="w-3.5 h-3.5" /> Перевод показан — скрыть</>}
        </button>
      )}
      <div className="h-1.5 bg-muted rounded-full mb-4">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {speech.error && (
        <p className="mb-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
          {speech.error}
        </p>
      )}

      <ol className="space-y-2">
        {items.map((it, idx) => {
          const a = attempts[idx];
          const ok = !!a && a.score >= PASS_SCORE;
          const recording = activeIdx === idx && speech.recording;
          const busy = speech.recording && activeIdx !== idx;
          const isWord = (it.kind ?? 'word') === 'word';

          return (
            <li
              key={`${idx}-${it.text}`}
              className={`rounded-xl border p-3 transition-colors ${
                ok ? 'border-emerald-500/40 bg-emerald-500/5'
                  : a ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border'}`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-qz-text-muted">
                      {idx + 1}. {KIND_LABEL[it.kind ?? 'word']}
                    </span>
                    {ok && <span className="text-[10px] text-emerald-500 inline-flex items-center gap-0.5"><Check className="w-3 h-3" /> засчитано</span>}
                    {a && !ok && <span className="text-[10px] text-amber-500">{a.score}% — нужно чище</span>}
                  </div>
                  <p className={`${isWord ? 'text-lg' : 'text-base'} font-semibold text-foreground leading-snug break-words`}>
                    {it.text}
                  </p>
                  {it.ipa && <p className="text-qz-text-muted font-mono text-xs">[{it.ipa}]</p>}
                  {it.ru && (
                    hideRu && !revealed[idx]
                      ? <button
                          onClick={() => setRevealed(r => ({ ...r, [idx]: true }))}
                          className="text-qz-text-muted/60 hover:text-[#4255ff] text-xs italic underline decoration-dotted transition-colors"
                        >
                          показать перевод
                        </button>
                      : <p className="text-qz-text-muted text-xs">{it.ru}</p>
                  )}
                  {it.hint && <p className="text-qz-text-muted text-xs italic">{it.hint}</p>}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => void play(it.text)}
                    title="Прослушать образец"
                    className="p-2 rounded-lg border border-border hover:border-[#4255ff]/50 text-qz-text-muted hover:text-[#4255ff] transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void playSlow(it.text)}
                    title="Медленно, по словам"
                    className="p-2 rounded-lg border border-border hover:border-[#4255ff]/50 text-qz-text-muted hover:text-[#4255ff] transition-colors"
                  >
                    <Turtle className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => (recording ? void stopAndCheck(idx) : void startFor(idx))}
                    disabled={busy}
                    title={recording ? 'Остановить и проверить' : 'Произнести и проверить'}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 ${
                      recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'}`}
                  >
                    {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    {recording ? 'Стоп' : a ? 'Ещё раз' : 'Произнести'}
                  </button>
                </div>
              </div>

              {a && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      {ok ? <><Check className="w-3.5 h-3.5 text-emerald-500" /> Засчитано</>
                          : <><Lightbulb className="w-3.5 h-3.5 text-amber-500" /> Разбор ошибок</>}
                    </span>
                    <span className={`text-sm font-bold ${ok ? 'text-emerald-500' : 'text-amber-500'}`}>{a.score}%</span>
                  </div>
                  <p className="text-qz-text-muted text-[11px] mb-1.5">Распознано: «{a.heard}»</p>
                  <DiffChips ops={a.check.ops} />
                  {!ok && issuesOf(a.check).length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {issuesOf(a.check).map((is, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-semibold text-foreground">{is.word}</span>
                          {is.given && <span className="text-qz-text-muted"> — прозвучало как «{is.given}»</span>}
                          {is.rules.map(r => (
                            <p key={r.id} className="text-qz-text-muted text-[11px] mt-0.5">
                              <strong className="text-foreground">{r.spelling} → {r.sound}:</strong> {r.explanation} <em>{r.example}</em>
                            </p>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  {speech.selfUrl && activeIdx === null && (
                    <button
                      onClick={() => { if (speech.selfUrl) void new Audio(speech.selfUrl).play().catch(() => {}); }}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      <Volume2 className="w-3 h-3" /> прослушать свою запись
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {Object.keys(attempts).length > 0 && (
        <button
          onClick={() => setAttempts({})}
          className="mt-4 inline-flex items-center gap-1.5 border border-border text-qz-text-muted hover:text-foreground text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Сбросить результаты
        </button>
      )}
    </div>
  );
}
