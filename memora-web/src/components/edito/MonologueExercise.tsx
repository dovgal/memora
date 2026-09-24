'use client';
// «Расскажите о себе»: ответ на вопрос собеседования целиком, на минуту-две.
//
// Остальные упражнения судят одну фразу, а на собеседовании важна вся
// история: сказал ли, кто ты и что умеешь, связно ли, без вечных «euh».
// Поэтому здесь человек говорит свободно, а разбор показывает три вещи, от
// которых больше всего толку начинающему: что из главного он уже сказал,
// несколько самых важных ошибок и его же рассказ, но правильно — чтобы было
// что выучить, а не «правильно было иначе». Образец ответа открывается только
// после попытки, иначе его просто перескажут.

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Check, CheckCircle2, Circle, Copy, Eye, EyeOff, Keyboard, Lightbulb, Loader2, Mic,
  RotateCcw, Sparkles, Square, Target, Volume2,
} from 'lucide-react';
import type { EditoExercise, ExerciseResult } from '@/lib/courses/edito-a1';
import {
  countWords, formatClock, foxLine, recordingLimits, refusalReason,
  type ErrorKind, type MonologueReview, type TimedWord,
} from '@/lib/courses/monologue';
import { reviewMonologue } from '@/lib/courses/monologueApi';
import { useMonologueRecorder } from '@/lib/courses/useMonologueRecorder';
import { speakInworld, speakInworldLong } from '@/lib/courses/ttsInworld';
import { emitFox } from '@/lib/fox/bus';

type Stage = 'prompt' | 'draft' | 'reviewing' | 'review';

interface Draft {
  text: string;
  words: TimedWord[];
  durationSeconds: number;
  mode: 'speech' | 'typed';
  source: 'server' | 'browser' | 'none';
  dropped: number;
  partial: boolean;
}

const KIND_LABEL: Record<ErrorKind, string> = {
  grammar: 'Грамматика',
  vocabulary: 'Слово',
  pronunciation: 'Произношение',
  other: 'Другое',
};

const SCORE_LABELS: { key: keyof MonologueReview['scores']; label: string }[] = [
  { key: 'content', label: 'Содержание' },
  { key: 'grammar', label: 'Грамматика' },
  { key: 'vocabulary', label: 'Словарь' },
  { key: 'fluency', label: 'Беглость' },
];

const btnPrimary = 'inline-flex items-center justify-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors';
const btnSecondary = 'inline-flex items-center justify-center gap-2 border border-border text-foreground hover:border-[#4255ff]/60 font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors';
const iconBtn = 'shrink-0 p-2 rounded-lg text-qz-text-muted hover:text-[#4255ff] hover:bg-[#4255ff]/10 transition-colors';

export function MonologueExercise({
  exercise, voice = 'Alain', speechLang = 'fr-FR', onComplete,
}: {
  exercise: EditoExercise;
  voice?: string;
  speechLang?: string;
  onComplete?: (result?: ExerciseResult) => void;
}) {
  const question = exercise.question ?? exercise.prompt ?? exercise.title;
  const goals = exercise.goals ?? [];
  const { min, max } = recordingLimits(exercise);
  const recorder = useMonologueRecorder(speechLang);

  const [stage, setStage] = useState<Stage>('prompt');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [review, setReview] = useState<MonologueReview | null>(null);
  const [showModel, setShowModel] = useState(false);
  const [copied, setCopied] = useState(false);
  const completedRef = useRef(false);
  const stoppingRef = useRef(false);

  // Вопрос на экране — лисёнок знает, что пошёл отсчёт «думает».
  useEffect(() => { emitFox({ type: 'question' }); }, []);

  const finishRecording = async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const capture = await recorder.stop();
    stoppingRef.current = false;
    if (!capture) return;
    setDraft({
      text: capture.text,
      words: capture.words,
      durationSeconds: capture.durationSeconds,
      mode: 'speech',
      source: capture.source,
      dropped: capture.dropped,
      partial: capture.partial,
    });
    setNotice(capture.source === 'none'
      ? 'Не удалось распознать запись. Послушайте её — если голос слышно, напишите рассказ сами или запишите ещё раз.'
      : null);
    setStage('draft');
  };

  // Время вышло — останавливаем сами: на собеседовании тоже не дадут говорить бесконечно.
  useEffect(() => {
    if (recorder.phase === 'recording' && recorder.elapsed >= max) void finishRecording();
    // finishRecording меняется каждый рендер, а следить нужно только за временем.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.phase, recorder.elapsed, max]);

  const startRecording = async () => {
    setNotice(null);
    setDraft(null);
    recorder.reset();
    await recorder.start();
  };

  const typeInstead = () => {
    emitFox({ type: 'answered' });
    setNotice(null);
    setDraft({ text: '', words: [], durationSeconds: 0, mode: 'typed', source: 'none', dropped: 0, partial: false });
    setStage('draft');
  };

  const submit = async () => {
    if (!draft) return;
    const text = draft.text.trim();
    const spoken = draft.mode === 'speech';
    const refusal = refusalReason(text, draft.durationSeconds, spoken);
    if (refusal) { setNotice(refusal); return; }
    setNotice(null);
    setStage('reviewing');
    try {
      const r = await reviewMonologue({
        question,
        goals,
        modelAnswer: exercise.modelAnswer,
        transcript: text,
        durationSeconds: spoken ? draft.durationSeconds : 0,
        level: exercise.level ?? 'A1',
        words: draft.words.map(w => ({ word: w.word, start: w.start, end: w.end })),
        mode: draft.mode,
      });
      setReview(r);
      setStage('review');
      emitFox({ type: 'say', text: foxLine(r) });
      if (!completedRef.current) {
        completedRef.current = true;
        // Засчитываем по целям: сколько главного прозвучало — честнее, чем
        // «верно/неверно» про свободный рассказ.
        const total = Math.max(1, r.goalsCovered.length);
        const correct = r.goalsCovered.length ? r.goalsCovered.filter(g => g.covered).length : 1;
        onComplete?.({ correct, total });
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Проверка не ответила — попробуйте ещё раз.');
      setStage('draft');
    }
  };

  const again = () => {
    setStage('prompt');
    setDraft(null);
    setReview(null);
    setNotice(null);
    setShowModel(false);
    setCopied(false);
    recorder.reset();
    emitFox({ type: 'question' });
  };

  const copyBetter = async () => {
    if (!review?.betterVersion) return;
    try {
      await navigator.clipboard.writeText(review.betterVersion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* буфер недоступен — кнопка просто не отзовётся */ }
  };

  const recording = recorder.phase === 'recording';
  const busy = recorder.phase === 'starting' || recorder.phase === 'finishing';

  return (
    <div className="space-y-4">
      {/* Вопрос собеседника */}
      <div className="bg-qz-card border border-border rounded-2xl p-5 sm:p-6 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-qz-text-muted">Вопрос на собеседовании</p>
        <div className="flex items-start gap-2">
          <p className="flex-1 text-xl font-semibold text-foreground leading-snug">{question}</p>
          <button onClick={() => void speakInworld(question, voice)} className={iconBtn} title="Послушать вопрос" aria-label="Послушать вопрос">
            <Volume2 className="w-5 h-5" />
          </button>
        </div>
        {exercise.questionRu && <p className="text-sm text-qz-text-muted">{exercise.questionRu}</p>}

        {goals.length > 0 && stage !== 'review' && (
          <div className="pt-1">
            <p className="text-sm font-semibold text-foreground mb-1.5">Что стоит рассказать</p>
            <ul className="space-y-1">
              {goals.map(g => (
                <li key={g} className="flex items-start gap-2 text-sm text-foreground">
                  <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#4255ff]" /> {g}
                </li>
              ))}
            </ul>
          </div>
        )}
        {stage === 'prompt' && !recording && !busy && (
          <p className="text-xs text-qz-text-muted">
            Говорите {formatClock(min)}–{formatClock(max)}. Простыми фразами — это нормально: важно рассказать всё главное.
          </p>
        )}
      </div>

      {/* Запись */}
      {stage === 'prompt' && (
        <div className="bg-qz-card border border-border rounded-2xl p-5 sm:p-6">
          {recording || recorder.phase === 'finishing' ? (
            <RecordingPanel
              elapsed={recorder.elapsed}
              max={max}
              min={min}
              level={recorder.level}
              finishing={recorder.phase === 'finishing'}
              pending={recorder.pending}
              onStop={() => void finishRecording()}
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <button
                onClick={() => void startRecording()}
                disabled={busy}
                className="w-20 h-20 rounded-full bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white flex items-center justify-center shadow-lg shadow-[#4255ff]/25 transition-colors"
                aria-label="Начать запись"
              >
                {busy ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8" />}
              </button>
              <p className="text-sm font-semibold text-foreground">{busy ? 'Включаем микрофон…' : 'Записать ответ'}</p>
              <button onClick={typeInstead} className="inline-flex items-center gap-1.5 text-sm text-qz-text-muted hover:text-foreground">
                <Keyboard className="w-4 h-4" /> Нет микрофона — написать ответ
              </button>
              {recorder.error && <p className="text-sm text-amber-600 dark:text-amber-400">{recorder.error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Черновик: что распознали, можно поправить */}
      {(stage === 'draft' || stage === 'reviewing') && draft && (
        <div className="bg-qz-card border border-border rounded-2xl p-5 sm:p-6 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {draft.mode === 'typed' ? 'Ваш ответ' : 'Ваш рассказ — как мы его расслышали'}
            </p>
            {draft.mode === 'speech' && (
              <span className="text-xs text-qz-text-muted tabular-nums">{formatClock(draft.durationSeconds)}</span>
            )}
          </div>
          {recorder.selfUrl && draft.mode === 'speech' && (
            <audio src={recorder.selfUrl} controls className="w-full h-10" />
          )}
          <textarea
            value={draft.text}
            onChange={e => setDraft({ ...draft, text: e.target.value })}
            disabled={stage === 'reviewing'}
            rows={draft.mode === 'typed' ? 7 : 6}
            placeholder={draft.mode === 'typed' ? 'Bonjour, je m’appelle…' : ''}
            className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-foreground leading-relaxed outline-none focus:border-[#4255ff]/60 resize-y"
          />
          <DraftNotes draft={draft} min={min} />
          {notice && <p className="text-sm text-amber-600 dark:text-amber-400">{notice}</p>}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void submit()} disabled={!draft.text.trim() || stage === 'reviewing'} className={btnPrimary}>
              {stage === 'reviewing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {stage === 'reviewing' ? 'Разбираем рассказ…' : 'Получить разбор'}
            </button>
            <button onClick={again} disabled={stage === 'reviewing'} className={btnSecondary}>
              <RotateCcw className="w-4 h-4" /> {draft.mode === 'typed' ? 'Назад' : 'Записать заново'}
            </button>
          </div>
          {stage === 'reviewing' && (
            <p className="text-xs text-qz-text-muted">Разбор длинного рассказа занимает до минуты.</p>
          )}
        </div>
      )}

      {stage === 'review' && review && (
        <ReviewPanel
          review={review}
          voice={voice}
          copied={copied}
          onCopy={() => void copyBetter()}
          transcript={draft?.text ?? ''}
          modelAnswer={exercise.modelAnswer}
          showModel={showModel}
          onToggleModel={() => setShowModel(s => !s)}
          onAgain={again}
        />
      )}
    </div>
  );
}

function RecordingPanel({ elapsed, max, min, level, finishing, pending, onStop }: {
  elapsed: number; max: number; min: number; level: number; finishing: boolean; pending: number; onStop: () => void;
}) {
  if (finishing) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4255ff]" />
        <p className="text-sm font-semibold text-foreground">Распознаём запись…</p>
        {pending > 0 && <p className="text-xs text-qz-text-muted">Осталось кусков: {pending}</p>}
      </div>
    );
  }
  const share = Math.min(1, elapsed / max);
  // Полоска громкости: пять делений, чтобы было видно, что микрофон слышит.
  const bars = [0.1, 0.25, 0.45, 0.65, 0.85];
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-red-500">
        <span className="relative flex w-2.5 h-2.5">
          <span className="absolute inline-flex w-full h-full rounded-full bg-red-500 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-red-500" />
        </span>
        Идёт запись
      </div>
      <p className="text-4xl font-bold tabular-nums text-foreground">
        {formatClock(elapsed)}<span className="text-lg font-medium text-qz-text-muted"> / {formatClock(max)}</span>
      </p>
      <div className="flex items-end gap-1 h-6" aria-hidden>
        {bars.map((t, i) => (
          <span
            key={i}
            className={`w-1.5 rounded-full transition-colors ${level > t ? 'bg-[#4255ff]' : 'bg-border'}`}
            style={{ height: `${8 + i * 4}px` }}
          />
        ))}
      </div>
      <div className="w-full max-w-xs h-1.5 rounded-full bg-qz-bg overflow-hidden">
        <div className="h-full bg-[#4255ff] transition-[width] duration-150" style={{ width: `${share * 100}%` }} />
      </div>
      <button
        onClick={onStop}
        className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/25"
        aria-label="Остановить запись"
      >
        <Square className="w-6 h-6 fill-current" />
      </button>
      <p className="text-xs text-qz-text-muted">
        {elapsed < min ? `Постарайтесь говорить хотя бы ${formatClock(min)}` : 'Закончили — нажмите «стоп»'}
      </p>
    </div>
  );
}

function DraftNotes({ draft, min }: { draft: Draft; min: number }) {
  if (draft.mode === 'typed') {
    return <p className="text-xs text-qz-text-muted">Пишите так, как сказали бы вслух. Слов: {countWords(draft.text)}</p>;
  }
  const notes: string[] = [];
  if (draft.source === 'browser') notes.push('Распознал браузер — возможны неточности. Если что-то услышано неверно, поправьте текст.');
  else if (draft.source === 'server') notes.push('Если что-то расслышано неверно — поправьте текст перед разбором.');
  if (draft.partial) notes.push('Часть записи не успела распознаться — текст может быть неполным.');
  if (draft.dropped > 0) notes.push('Кусок с шумом без речи мы убрали, чтобы не разбирать чужие слова.');
  if (draft.durationSeconds < min) notes.push(`Ответ короче ${formatClock(min)}: на собеседовании лучше рассказать подробнее. Разобрать можно и так.`);
  return (
    <ul className="space-y-1">
      {notes.map(n => <li key={n} className="text-xs text-qz-text-muted">{n}</li>)}
    </ul>
  );
}

function ReviewPanel({
  review, voice, copied, onCopy, transcript, modelAnswer, showModel, onToggleModel, onAgain,
}: {
  review: MonologueReview;
  voice: string;
  copied: boolean;
  onCopy: () => void;
  transcript: string;
  modelAnswer?: string;
  showModel: boolean;
  onToggleModel: () => void;
  onAgain: () => void;
}) {
  const scores = SCORE_LABELS.filter(s => review.scores[s.key] > 0);
  const f = review.fluency;
  const facts: string[] = [];
  if (f.words) facts.push(`${f.words} слов`);
  if (f.wordsPerMinute) facts.push(`${f.wordsPerMinute} слов/мин`);
  for (const w of f.fillerWords.slice(0, 3)) facts.push(`«${w.word}» ×${w.count}`);
  if (f.longPauses) facts.push(`длинных пауз: ${f.longPauses}`);
  if (f.repetitions) facts.push(`повторов: ${f.repetitions}`);

  return (
    <div className="space-y-4">
      {/* Итог и оценки */}
      <div className="bg-qz-card border border-border rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-[#4255ff]/10 text-[#4255ff] flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <p className="text-foreground leading-relaxed">{review.overall}</p>
        </div>
        {scores.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {scores.map(s => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="w-24 text-sm text-qz-text-muted">{s.label}</span>
                <div className="flex gap-1 flex-1" aria-label={`${s.label}: ${review.scores[s.key]} из 5`}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={`h-2 flex-1 rounded-full ${i <= review.scores[s.key] ? 'bg-[#4255ff]' : 'bg-qz-bg border border-border'}`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {facts.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {facts.map(x => (
              <span key={x} className="text-xs px-2 py-1 rounded-full bg-qz-bg border border-border text-qz-text-muted">{x}</span>
            ))}
          </div>
        )}
      </div>

      {/* Цели */}
      {review.goalsCovered.length > 0 && (
        <Section title="Что вы рассказали">
          <ul className="space-y-2">
            {review.goalsCovered.map(g => (
              <li key={g.goal} className="flex items-start gap-2.5">
                {g.covered
                  ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                  : <Circle className="w-5 h-5 shrink-0 text-amber-500" />}
                <div>
                  <p className={`text-sm font-medium ${g.covered ? 'text-foreground' : 'text-amber-700 dark:text-amber-300'}`}>{g.goal}</p>
                  {g.note && <p className="text-xs text-qz-text-muted mt-0.5">{g.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Ошибки */}
      {review.errors.length > 0 && (
        <Section title="Главное, что поправить">
          <div className="space-y-2.5">
            {review.errors.map((e, i) => (
              <div key={`${e.quote}-${i}`} className="rounded-xl border border-border bg-qz-bg p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-qz-text-muted">{KIND_LABEL[e.kind]}</span>
                  <button onClick={() => void speakInworld(e.correction, voice)} className={iconBtn} aria-label="Послушать исправление">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm leading-relaxed">
                  <span className="line-through decoration-red-400/70 text-red-600 dark:text-red-400">{e.quote}</span>
                  <ArrowRight className="inline w-3.5 h-3.5 mx-1.5 text-qz-text-muted" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{e.correction}</span>
                </p>
                {e.explanation && <p className="text-xs text-qz-text-muted">{e.explanation}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Свой рассказ, но правильно */}
      {review.betterVersion && (
        <Section
          title="Лучшая версия вашего рассказа"
          actions={(
            <>
              <button onClick={() => void speakInworldLong(review.betterVersion, voice)} className={iconBtn} title="Послушать" aria-label="Послушать лучшую версию">
                <Volume2 className="w-5 h-5" />
              </button>
              <button onClick={onCopy} className={iconBtn} title="Скопировать" aria-label="Скопировать лучшую версию">
                {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              </button>
            </>
          )}
        >
          <p className="text-foreground leading-relaxed whitespace-pre-line">{review.betterVersion}</p>
          <p className="text-xs text-qz-text-muted mt-2">Это ваш рассказ с исправлениями — его стоит прочитать вслух пару раз.</p>
        </Section>
      )}

      {/* Полезные фразы */}
      {review.usefulPhrases.length > 0 && (
        <Section title="Фразы, которые украсят ответ">
          <ul className="space-y-2">
            {review.usefulPhrases.map(p => (
              <li key={p.fr} className="flex items-start gap-2">
                <button onClick={() => void speakInworld(p.fr, voice)} className={iconBtn} aria-label={`Послушать: ${p.fr}`}>
                  <Volume2 className="w-4 h-4" />
                </button>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-foreground">{p.fr}</p>
                  {p.ru && <p className="text-xs text-qz-text-muted">{p.ru}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {review.nextStep && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#4255ff]/30 bg-[#4255ff]/5 p-4">
          <Target className="w-5 h-5 shrink-0 text-[#4255ff]" />
          <div>
            <p className="text-sm font-semibold text-foreground">Следующий шаг</p>
            <p className="text-sm text-foreground mt-0.5">{review.nextStep}</p>
          </div>
        </div>
      )}

      {transcript && (
        <details className="bg-qz-card border border-border rounded-2xl p-4 group">
          <summary className="text-sm font-semibold text-foreground cursor-pointer">Как прозвучал ваш рассказ</summary>
          <p className="text-sm text-qz-text-muted leading-relaxed mt-2 whitespace-pre-line">{transcript}</p>
        </details>
      )}

      {modelAnswer && (
        <div className="bg-qz-card border border-border rounded-2xl p-4 space-y-2">
          <button onClick={onToggleModel} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            {showModel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showModel ? 'Скрыть образец ответа' : 'Показать образец ответа'}
          </button>
          {showModel && (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-sm text-foreground leading-relaxed whitespace-pre-line">{modelAnswer}</p>
              <button onClick={() => void speakInworldLong(modelAnswer, voice)} className={iconBtn} aria-label="Послушать образец">
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          )}
          {showModel && (
            <p className="text-xs text-qz-text-muted flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5" /> Образец — для идей. Учите лучше свою версию: её легче вспомнить на собеседовании.
            </p>
          )}
        </div>
      )}

      <button onClick={onAgain} className={`${btnPrimary} w-full sm:w-auto`}>
        <Mic className="w-4 h-4" /> Записать ещё раз
      </button>
    </div>
  );
}

function Section({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-qz-card border border-border rounded-2xl p-5 sm:p-6 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {actions && <div className="flex items-center gap-0.5">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
