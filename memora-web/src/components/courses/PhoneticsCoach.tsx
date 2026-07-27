'use client';
// Фонетический коуч: постановка звука → разминка → практика по ступеням
// (слова → минимальные пары → фразы → лесенки → скороговорка) с проверкой
// произношения через микрофон и разбором ошибок по правилам чтения.
//
// Несданные единицы возвращаются в очередь — блок закрывается только когда
// весь материал произнесён чисто («до полного усвоения»).

import { useCallback, useMemo, useState } from 'react';
import {
  Mic, MicOff, Volume2, Turtle, RotateCcw, Trophy, Lightbulb, ChevronRight,
  Dumbbell, Check, ArrowRight, Repeat,
} from 'lucide-react';
import { speakInworld, speakInworldAndWait } from '@/lib/courses/ttsInworld';
import { checkDictation, type DictationCheck } from '@/lib/courses/dictation';
import { DiffChips } from '@/components/edito/DiffChips';
import { rulesForWord, type ReadingRule } from '@/lib/courses/frenchReadingRules';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { drillItems, type DrillItem, type SoundDrill, type ArticulationDrill } from '@/lib/courses/phonetics';
import { PASS_SCORE, REQUEUE_GAP, markPassed, markAttempt } from '@/lib/courses/phonetics/mastery';

type Phase = 'theory' | 'warmup' | 'practice' | 'done';

const KIND_LABEL: Record<DrillItem['kind'], string> = {
  word: 'Слово',
  pair: 'Минимальная пара',
  phrase: 'Фраза',
  ladder: 'Лесенка',
  twister: 'Скороговорка',
};

export function PhoneticsCoach({ drill, articulation, voice = 'Alain', speechLang = 'fr-FR', onExit }: {
  drill: SoundDrill;
  /** Разминка урока — показывается перед практикой. */
  articulation?: ArticulationDrill[];
  voice?: string;
  speechLang?: string;
  onExit?: () => void;
}) {
  const items = useMemo(() => drillItems(drill), [drill]);
  const [phase, setPhase] = useState<Phase>('theory');
  // Ленивая инициализация вместо эффекта: при смене блока родитель пересоздаёт
  // компонент через key={drill.id}, поэтому состояние сбрасывается само.
  const [queue, setQueue] = useState<DrillItem[]>(() => items);
  const [check, setCheck] = useState<DictationCheck | null>(null);
  const [heard, setHeard] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [passedCount, setPassedCount] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [scoreLog, setScoreLog] = useState<number[]>([]);

  const speech = useSpeechAttempt(speechLang);
  const total = items.length;
  const current = queue[0];

  // Что произносим целиком (для пары — оба слова подряд).
  const targetText = current ? (current.second ? `${current.text} ${current.second}` : current.text) : '';

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
    const r = await speakInworld(targetText, voice);
    if (!r.ok) speech.setError(`Не удалось озвучить: ${r.error}.`);
  };
  const playSlow = async () => {
    for (const w of targetText.split(/\s+/).filter(Boolean)) {
      const r = await speakInworldAndWait(w, voice);
      if (!r.ok) { speech.setError(`Не удалось озвучить: ${r.error}.`); return; }
      await new Promise(res => setTimeout(res, 250));
    }
  };
  const playSelf = () => { if (speech.selfUrl) void new Audio(speech.selfUrl).play().catch(() => {}); };

  const finishAttempt = useCallback(async () => {
    const transcript = await speech.stop();
    if (!transcript) {
      speech.setError('Речь не распознана. Прослушайте свою запись и сравните с образцом — либо откройте курс в Chrome или Safari для автооценки.');
      return;
    }
    // spoken: распознавание отдаёт числа цифрами — для чтения это не ошибка.
    const result = checkDictation(targetText, transcript, { spoken: true });
    const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
    setHeard(transcript);
    setCheck(result);
    setScore(pct);
    setAttempts(a => a + 1);
    setScoreLog(l => [...l, pct]);
    if (pct >= PASS_SCORE) markPassed(drill.id, current.text, pct);
    else markAttempt(drill.id, pct);
  }, [speech, targetText, drill.id, current]);

  const nextItem = useCallback(() => {
    const passed = (score ?? 0) >= PASS_SCORE;
    setQueue(q => {
      const [head, ...rest] = q;
      if (passed) return rest;
      // Не сдано — вернуть в очередь через несколько позиций.
      const at = Math.min(REQUEUE_GAP, rest.length);
      return [...rest.slice(0, at), head, ...rest.slice(at)];
    });
    if (passed) setPassedCount(n => n + 1);
    setCheck(null); setHeard(null); setScore(null); speech.reset();
  }, [score, speech]);

  const avg = scoreLog.length ? Math.round(scoreLog.reduce((a, b) => a + b, 0) / scoreLog.length) : 0;

  // ---------- Постановка звука ----------
  if (phase === 'theory') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-qz-card border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-mono font-bold text-[#4255ff]">{drill.ipa}</span>
            <div>
              <h2 className="text-xl font-bold text-foreground">{drill.title}</h2>
              <p className="text-qz-text-muted text-xs">Урок {drill.lesson} · {total} единиц материала</p>
            </div>
          </div>

          <div className="rounded-xl border-l-4 border-red-500 bg-red-500/5 p-4 mb-3">
            <p className="text-sm font-bold text-foreground mb-1">Типичная ошибка</p>
            <p className="text-sm text-qz-text-muted">{drill.problem}</p>
          </div>
          <div className="rounded-xl border-l-4 border-emerald-500 bg-emerald-500/5 p-4 mb-3">
            <p className="text-sm font-bold text-foreground mb-1">Как ставить звук</p>
            <p className="text-sm text-qz-text-muted">{drill.howTo}</p>
          </div>

          {drill.spellings && drill.spellings.length > 0 && (
            <div className="rounded-xl border border-border p-4 mb-3">
              <p className="text-sm font-bold text-foreground mb-2">Когда так читается</p>
              <ul className="space-y-1">
                {drill.spellings.map((s, i) => <li key={i} className="text-sm text-qz-text-muted">• {s}</li>)}
              </ul>
            </div>
          )}
          {drill.exceptions && drill.exceptions.length > 0 && (
            <div className="rounded-xl border-l-4 border-amber-500 bg-amber-500/5 p-4 mb-3">
              <p className="text-sm font-bold text-foreground mb-2">Исключения</p>
              <ul className="space-y-1">
                {drill.exceptions.map((s, i) => <li key={i} className="text-sm text-qz-text-muted">• {s}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-2 flex-wrap mt-5">
            <button onClick={() => void speakInworld(drill.words.slice(0, 6).join(', '), voice)}
              className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 text-foreground text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
              <Volume2 className="w-4 h-4" /> Послушать примеры
            </button>
            {articulation && articulation.length > 0 && (
              <button onClick={() => setPhase('warmup')}
                className="inline-flex items-center gap-1.5 border border-border hover:border-emerald-500/50 text-foreground text-sm font-semibold px-3.5 py-2 rounded-xl transition-colors">
                <Dumbbell className="w-4 h-4" /> Сначала разминка
              </button>
            )}
            <button onClick={() => setPhase('practice')}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              К практике <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {onExit && (
          <button onClick={onExit} className="mt-4 text-qz-text-muted hover:text-foreground text-sm">← К списку звуков</button>
        )}
      </div>
    );
  }

  // ---------- Разминка ----------
  if (phase === 'warmup') {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-qz-card border border-border rounded-2xl p-6">
          <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-emerald-500" /> Разминка речевого аппарата
          </h2>
          <p className="text-qz-text-muted text-sm mb-5">
            Произнесение звуков — это движение мышц. Как в танце: сначала медленно и поэтапно, только потом на скорости.
          </p>
          <div className="space-y-4">
            {(articulation ?? []).map(a => (
              <div key={a.id} className="border border-border rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="font-bold text-foreground text-sm">{a.title}</p>
                  <span className="text-xs text-qz-text-muted shrink-0">≈{a.seconds} сек</span>
                </div>
                <ol className="list-decimal pl-5 space-y-1 mb-2">
                  {a.steps.map((s, i) => <li key={i} className="text-sm text-qz-text-muted">{s}</li>)}
                </ol>
                <p className="text-xs text-qz-text-muted bg-background rounded-lg p-2.5">
                  <strong className="text-foreground">Зачем: </strong>{a.why}
                </p>
              </div>
            ))}
          </div>
          <button onClick={() => setPhase('practice')}
            className="mt-5 inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            Размялся — к практике <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ---------- Итог блока ----------
  if (phase === 'done' || (phase === 'practice' && queue.length === 0 && total > 0)) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <div className="bg-qz-card border border-border rounded-2xl p-8 text-center">
          <Trophy className="w-10 h-10 text-qz-accent mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-foreground mb-1">Звук {drill.ipa} усвоен!</h2>
          <p className="text-qz-text-muted mb-6">
            Весь материал блока произнесён чисто: {total} единиц за {attempts} попыток · средняя точность {avg}%
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => { setQueue(items); setPhase('practice'); setScoreLog([]); setAttempts(0); setPassedCount(0); }}
              className="inline-flex items-center gap-2 border border-border text-foreground font-semibold text-sm px-5 py-2.5 rounded-xl">
              <RotateCcw className="w-4 h-4" /> Пройти ещё раз
            </button>
            {onExit && (
              <button onClick={onExit}
                className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors">
                К следующему звуку <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Практика ----------
  const pct = total > 0 ? Math.round((passedCount / total) * 100) : 0;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2 text-xs text-qz-text-muted">
        <span className="font-mono text-[#4255ff] font-bold">{drill.ipa}</span>
        <span>усвоено {passedCount} / {total} · осталось в очереди {queue.length}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full mb-4">
        <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {current && (
        <div className="bg-qz-card border border-border rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#4255ff] bg-[#4255ff]/10 px-2 py-1 rounded">
              {KIND_LABEL[current.kind]}
            </span>
            {current.ladderStep && (
              <span className="text-[10px] text-qz-text-muted">ступень {current.ladderStep.i} из {current.ladderStep.of}</span>
            )}
          </div>

          {current.kind === 'pair' ? (
            <div className="flex items-center gap-4 flex-wrap mb-2">
              <p className="text-3xl font-semibold text-foreground">{current.text}</p>
              <Repeat className="w-5 h-5 text-qz-text-muted" />
              <p className="text-3xl font-semibold text-foreground">{current.second}</p>
            </div>
          ) : (
            <p className={`${current.kind === 'word' ? 'text-3xl' : 'text-2xl'} font-semibold text-foreground leading-relaxed mb-2`}>
              {current.text}
            </p>
          )}
          {current.hint && <p className="text-qz-text-muted text-sm mb-1">{current.hint}</p>}

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
        </div>
      )}

      {/* Разбор попытки */}
      {check && score !== null && (
        <div className="bg-qz-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-foreground flex items-center gap-2">
              {score >= PASS_SCORE
                ? <><Check className="w-5 h-5 text-emerald-500" /> Засчитано</>
                : <><Lightbulb className="w-5 h-5 text-amber-500" /> Ещё раз — разберём ошибки</>}
            </p>
            <span className={`text-xl font-bold ${score >= PASS_SCORE ? 'text-emerald-500' : 'text-amber-500'}`}>{score}%</span>
          </div>
          {heard && <p className="text-qz-text-muted text-xs mb-2">Распознано: «{heard}»</p>}
          <DiffChips ops={check.ops} />

          {issues.length > 0 && (
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-sm font-bold text-foreground mb-2">Разбор ошибок — правила чтения</p>
              <div className="space-y-3">
                {issues.map((it, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-semibold text-foreground">{it.word}</span>
                    {it.given && <span className="text-qz-text-muted text-xs"> — прозвучало как «{it.given}»</span>}
                    {it.rules.length > 0 ? (
                      <ul className="mt-1 space-y-1">
                        {it.rules.map(r => (
                          <li key={r.id} className="text-xs text-qz-text-muted">
                            <strong className="text-foreground">{r.spelling} → {r.sound}:</strong> {r.explanation} <em>{r.example}</em>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-qz-text-muted mt-1">
                        Послушайте образец и повторите медленно, следя за положением губ и языка.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 flex gap-2 flex-wrap">
            <button onClick={() => { setCheck(null); setHeard(null); setScore(null); speech.reset(); }}
              className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-xl">
              <RotateCcw className="w-4 h-4" /> Повторить сейчас
            </button>
            <button onClick={nextItem}
              className="inline-flex items-center gap-1.5 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
              {score >= PASS_SCORE ? 'Дальше' : 'Отложить и вернуться позже'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {score < PASS_SCORE && (
            <p className="text-qz-text-muted text-xs mt-2">
              Незасчитанное вернётся через несколько единиц — блок закроется, только когда всё прозвучит чисто.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
