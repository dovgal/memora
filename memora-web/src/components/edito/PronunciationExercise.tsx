'use client';
// Упражнение «произнеси и проверь»: прогоняет через микрофон КАЖДУЮ единицу
// списка — слово, фразу, ступень лесенки, скороговорку. Единица засчитывается
// при точности не ниже порога; незасчитанная возвращается в очередь, поэтому
// упражнение закрывается только когда весь список произнесён чисто.

import { useCallback, useMemo, useState } from 'react';
import { Mic, MicOff, Volume2, Turtle, RotateCcw, Check, ChevronRight, Lightbulb } from 'lucide-react';
import { EditoExercise, PronunciationItem } from '@/lib/courses/edito-a1';
import { speakInworld, speakInworldAndWait } from '@/lib/courses/ttsInworld';
import { checkDictation, bestTranscript, type DictationCheck } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';
import { rulesForWord, type ReadingRule } from '@/lib/courses/frenchReadingRules';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { PASS_SCORE, REQUEUE_GAP } from '@/lib/courses/phonetics/mastery';

const KIND_LABEL: Record<NonNullable<PronunciationItem['kind']>, string> = {
  word: 'Слово',
  phrase: 'Фраза',
  ladder: 'Ступень лесенки',
  twister: 'Скороговорка',
};

export function PronunciationExercise({ exercise, onComplete, voice = 'Alain', speechLang = 'fr-FR' }: {
  exercise: EditoExercise;
  onComplete?: () => void;
  voice?: string;
  speechLang?: string;
}) {
  const items = useMemo(() => exercise.pronItems ?? [], [exercise.pronItems]);
  const [queue, setQueue] = useState<PronunciationItem[]>(() => items);
  const [passed, setPassed] = useState<string[]>([]);
  const [check, setCheck] = useState<DictationCheck | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);

  const speech = useSpeechAttempt(speechLang);
  const total = items.length;
  const current = queue[0];
  const finished = total > 0 && queue.length === 0;

  const issues = useMemo(() => {
    if (!check) return [] as { word: string; given?: string; rules: ReadingRule[] }[];
    const out: { word: string; given?: string; rules: ReadingRule[] }[] = [];
    for (const op of check.ops) {
      if ((op.type === 'wrong' || op.type === 'missing') && op.expected) {
        out.push({ word: op.expected, given: op.given, rules: rulesForWord(op.expected).slice(0, 3) });
      }
    }
    return out;
  }, [check]);

  const play = async () => {
    if (!current) return;
    const r = await speakInworld(current.text, voice);
    if (!r.ok) speech.setError(`Не удалось озвучить: ${r.error}.`);
  };
  const playSlow = async () => {
    if (!current) return;
    for (const w of current.text.split(/\s+/).filter(Boolean)) {
      const r = await speakInworldAndWait(w, voice);
      if (!r.ok) { speech.setError(`Не удалось озвучить: ${r.error}.`); return; }
      await new Promise(res => setTimeout(res, 250));
    }
  };
  const playSelf = () => { if (speech.selfUrl) void new Audio(speech.selfUrl).play().catch(() => {}); };

  const finishAttempt = useCallback(async () => {
    const transcript = await speech.stop();
    if (!current) return;
    if (!transcript) {
      speech.setError('Речь не распознана. Прослушайте свою запись и сравните с образцом — либо откройте курс в Chrome или Safari для автооценки.');
      return;
    }
    // Из нескольких гипотез движка берём фонетически ближайшую к эталону.
    const heardBest = bestTranscript(current.text, transcript, speech.alternatives());
    const result = checkDictation(current.text, heardBest, { spoken: true });
    const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    setHeard(heardBest); setCheck(result); setScore(pct);
  }, [speech, current]);

  const advance = useCallback(() => {
    const ok = (score ?? 0) >= PASS_SCORE;
    setQueue(q => {
      const [head, ...rest] = q;
      if (ok) return rest;
      const at = Math.min(REQUEUE_GAP, rest.length);
      return [...rest.slice(0, at), head, ...rest.slice(at)];
    });
    if (ok && current) {
      setPassed(p => {
        const next = p.includes(current.text) ? p : [...p, current.text];
        if (next.length >= total) onComplete?.();
        return next;
      });
    }
    setCheck(null); setHeard(null); setScore(null); speech.reset();
  }, [score, current, total, onComplete, speech]);

  if (total === 0) return null;

  if (finished) {
    return (
      <div className="bg-qz-card border border-border rounded-2xl p-6">
        <p className="font-bold text-foreground flex items-center gap-2 mb-1">
          <Check className="w-5 h-5 text-emerald-500" /> {exercise.title}
        </p>
        <p className="text-qz-text-muted text-sm">
          Все {total} единиц произнесены чисто. Материал отработан.
        </p>
        <button onClick={() => { setQueue(items); setPassed([]); }}
          className="mt-4 inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-xl">
          <RotateCcw className="w-4 h-4" /> Пройти ещё раз
        </button>
      </div>
    );
  }

  const pct = Math.round((passed.length / total) * 100);

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-bold text-foreground flex items-center gap-2">
          <Mic className="w-4 h-4 text-[#4255ff]" /> {exercise.title}
        </h3>
        <span className="text-xs text-qz-text-muted shrink-0">{passed.length} / {total}</span>
      </div>
      <p className="text-qz-text-muted text-xs mb-3">
        Произнесите каждую единицу. Незасчитанное вернётся в очередь — упражнение закроется, когда всё прозвучит чисто.
      </p>
      <div className="h-1.5 bg-muted rounded-full mb-5">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {current && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#4255ff] bg-[#4255ff]/10 px-2 py-1 rounded">
              {KIND_LABEL[current.kind ?? 'word']}
            </span>
            <span className="text-[10px] text-qz-text-muted">осталось {queue.length}</span>
          </div>
          <p className={`${(current.kind ?? 'word') === 'word' ? 'text-3xl' : 'text-2xl'} font-semibold text-foreground leading-relaxed`}>
            {current.text}
          </p>
          {current.ipa && <p className="text-qz-text-muted font-mono text-sm mt-1">[{current.ipa}]</p>}
          {current.ru && <p className="text-qz-text-muted text-sm">{current.ru}</p>}
          {current.hint && <p className="text-qz-text-muted text-xs mt-1">{current.hint}</p>}

          <div className="mt-5 flex items-center gap-2 flex-wrap">
            <button onClick={() => void play()}
              className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 text-foreground text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
              <Volume2 className="w-4 h-4" /> Прослушать
            </button>
            <button onClick={() => void playSlow()}
              className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 text-foreground text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
              <Turtle className="w-4 h-4" /> Медленно
            </button>
            <button onClick={() => (speech.recording ? void finishAttempt() : void speech.start())}
              className={`inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl transition-colors ${
                speech.recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'}`}>
              {speech.recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {speech.recording ? 'Идёт запись… (нажмите, чтобы остановить)' : 'Произнести'}
            </button>
            {speech.selfUrl && (
              <button onClick={playSelf}
                className="inline-flex items-center gap-1.5 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-sm font-semibold px-3.5 py-2 rounded-xl">
                <Volume2 className="w-4 h-4" /> Прослушать себя
              </button>
            )}
          </div>

          {speech.error && (
            <p className="mt-3 text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              {speech.error}
            </p>
          )}
        </>
      )}

      {check && score !== null && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-foreground text-sm flex items-center gap-2">
              {score >= PASS_SCORE
                ? <><Check className="w-4 h-4 text-emerald-500" /> Засчитано</>
                : <><Lightbulb className="w-4 h-4 text-amber-500" /> Разберём ошибки</>}
            </p>
            <span className={`text-lg font-bold ${score >= PASS_SCORE ? 'text-emerald-500' : 'text-amber-500'}`}>{score}%</span>
          </div>
          {heard && <p className="text-qz-text-muted text-xs mb-2">Распознано: «{heard}»</p>}
          <DiffChips ops={check.ops} />

          {issues.length > 0 && (
            <div className="mt-3 space-y-2">
              {issues.map((it, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold text-foreground">{it.word}</span>
                  {it.given && <span className="text-qz-text-muted text-xs"> — прозвучало как «{it.given}»</span>}
                  {it.rules.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {it.rules.map(r => (
                        <li key={r.id} className="text-xs text-qz-text-muted">
                          <strong className="text-foreground">{r.spelling} → {r.sound}:</strong> {r.explanation} <em>{r.example}</em>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex gap-2 flex-wrap">
            <button onClick={() => { setCheck(null); setHeard(null); setScore(null); speech.reset(); }}
              className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-xl">
              <RotateCcw className="w-4 h-4" /> Повторить сейчас
            </button>
            <button onClick={advance}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              {score >= PASS_SCORE ? 'Дальше' : 'Отложить и вернуться позже'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
