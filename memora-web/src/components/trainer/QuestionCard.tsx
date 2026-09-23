'use client';
// Карточка задания: показывает то, что нужно спросить (recognize/gender —
// выбор; recall/listen/conjugate/cloze — письменный ответ; speak — устный;
// build — целая фраза через SentenceBuildCard), и разбор после ответа.
//
// Ретрив прежде повторения: правильный ответ виден только ПОСЛЕ попытки — до
// этого момента recall/listen/speak ничего не подсказывают, кроме
// добровольной подсказки (она стоит рейтинга, см. lib/trainer/rating.ts).
// Исключение — подсказка, которую прислал сервер (у cloze это перевод всего
// примера): без неё пропуск неоднозначен, поэтому она видна сразу и бесплатна.

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { CheckCircle2, ChevronRight, Lightbulb, Loader2, Mic, Square, Volume2, XCircle } from 'lucide-react';
import type { FlashcardResponse } from '@/types/schema';
import type { TrainerTask } from '@/lib/trainer/localExercises';
import type { AnswerFeedback, CoachingState } from '@/lib/trainer/useTrainerSession';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { heardSomething } from '@/lib/courses/heardCheck';
import { bestTranscript } from '@/lib/courses/dictation';
import { bcp47ForLanguageCode } from '@/lib/trainer/lang';
import { SentenceBuildCard } from './SentenceBuildCard';

const IN_LANGUAGE: Record<string, string> = {
  fr: 'по-французски', en: 'по-английски', de: 'по-немецки', es: 'по-испански',
  it: 'по-итальянски', pt: 'по-португальски', ru: 'по-русски', uk: 'по-украински',
};

/** Что просим сделать — одной строкой над заданием, чтобы не гадать по виду карточки. */
function instructionFor(task: TrainerTask): string {
  const lang = IN_LANGUAGE[task.answerLang] ?? '';
  switch (task.kind) {
    case 'recognize': return 'Выберите перевод';
    case 'recall': return task.answerLabel ? `Напишите: ${task.answerLabel}` : `Напишите ${lang || 'перевод'}`.trim();
    case 'listen': return 'Послушайте и запишите, что услышали';
    case 'speak': return task.prompt.trim() === task.answer.trim() ? 'Прочитайте вслух' : `Скажите ${lang} вслух`;
    case 'gender': return 'le или la?';
    case 'conjugate': return 'Поставьте глагол в нужную форму';
    case 'cloze': return 'Вставьте пропущенное слово';
    case 'build': return 'Своими словами';
  }
}

/** Может ли задание прозвучать до ответа (иначе кнопка «послушать» выдала бы ответ). */
function canPlayBefore(task: TrainerTask): boolean {
  if (task.promptLang === 'ru') return false;
  if (task.kind === 'speak') return task.prompt.trim() === task.answer.trim();
  return task.kind === 'recognize' || task.kind === 'recall' || task.kind === 'listen' || task.kind === 'gender';
}

export interface QuestionCardProps {
  exercise: TrainerTask;
  card: FlashcardResponse;
  showResult: boolean;
  isCorrect: boolean | null;
  lastAnswerText: string;
  hintUsed: boolean;
  coaching: CoachingState | null;
  feedback: AnswerFeedback | null;
  grading: boolean;
  isLeech: boolean;
  onSubmit: (raw: string | number, opts?: { gaveUp?: boolean }) => void;
  onUseHint: () => void;
  onReplay: (slow?: boolean) => void;
  onNext: () => void;
  onSkipSpeaking: () => void;
  /** Поверх открыт лист параметров — клавиши принадлежат ему. */
  paused?: boolean;
}

export function QuestionCard(props: QuestionCardProps) {
  const { exercise, card, showResult, isCorrect, coaching, feedback, isLeech, paused, onSubmit, onReplay, onNext } = props;

  // Клавиатура: 1–4 — вариант ответа, Enter — дальше, Space — повтор
  // озвучки, S — медленный повтор. Пока фокус в поле ввода, клавиши
  // принадлежат полю — иначе пробел и «s» не напечатать.
  useEffect(() => {
    if (paused) return;
    const isTyping = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' && showResult) { e.preventDefault(); onNext(); return; }
      if (isTyping()) return;
      if (!showResult && (exercise.kind === 'recognize' || exercise.kind === 'gender')) {
        const n = Number(e.key);
        if (n >= 1 && n <= (exercise.options?.length ?? 0)) { onSubmit(n - 1); return; }
      }
      if (e.key === ' ') { e.preventDefault(); onReplay(false); return; }
      if (e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы') onReplay(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, showResult, exercise, onSubmit, onReplay, onNext]);

  const isOptions = exercise.kind === 'recognize' || exercise.kind === 'gender';
  const isSpeak = exercise.kind === 'speak';
  const isBuild = exercise.kind === 'build';
  const isText = !isOptions && !isSpeak && !isBuild;
  const audible = showResult || canPlayBefore(exercise);
  // Серверная подсказка — часть задания (у cloze это перевод примера); локальная — платная.
  const freeHint = !exercise.local && exercise.hint ? exercise.hint : null;

  return (
    <div className="w-full flex flex-col gap-5 animate-in fade-in duration-300">
      <section className="bg-qz-card border border-qz-border-light px-5 py-6 sm:px-10 sm:py-9 rounded-3xl shadow-sm relative flex flex-col items-center gap-3 min-h-[200px] justify-center">
        <div className="w-full flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-qz-text-muted">
            {instructionFor(exercise)}
            {isLeech && <span className="ml-2 normal-case tracking-normal font-semibold text-amber-600 dark:text-amber-400">· трудное слово</span>}
          </span>
          {audible && (
            <div className="flex items-center gap-1 text-qz-text-muted -mr-2">
              <button
                onClick={() => onReplay(false)}
                aria-label="Прослушать (пробел)"
                title="Прослушать (пробел)"
                className="p-2.5 rounded-xl hover:text-qz-text hover:bg-qz-bg transition-colors"
              >
                <Volume2 size={20} />
              </button>
              <button
                onClick={() => onReplay(true)}
                aria-label="Медленнее (S)"
                title="Медленнее (S)"
                className="px-2 py-2.5 rounded-xl hover:text-qz-text hover:bg-qz-bg transition-colors text-xs font-bold"
              >
                0.75×
              </button>
            </div>
          )}
        </div>

        {card.imageUrl && exercise.kind !== 'listen' && (
          <Image src={card.imageUrl} alt="" width={400} height={160} className="max-h-[150px] w-auto object-contain rounded-xl" />
        )}

        {exercise.kind === 'listen' && !showResult ? (
          <button
            onClick={() => onReplay(false)}
            className="my-2 w-20 h-20 rounded-full bg-[#4255ff]/10 text-[#4255ff] flex items-center justify-center hover:bg-[#4255ff]/20 transition-colors"
            aria-label="Прослушать ещё раз"
          >
            <Volume2 size={34} />
          </button>
        ) : (
          <p className="text-2xl sm:text-3xl font-semibold leading-snug text-qz-text text-center whitespace-pre-line break-words">
            {exercise.kind === 'gender' ? <><span className="text-qz-text-muted">__ </span>{exercise.prompt}</> : exercise.prompt}
          </p>
        )}

        {freeHint && <p className="text-base text-qz-text-muted text-center">{freeHint}</p>}
      </section>

      {isOptions && <OptionsAnswer {...props} />}
      {isText && <TextAnswer key={exercise.id} {...props} />}
      {isSpeak && <SpeakAnswer key={exercise.id} {...props} />}
      {isBuild && (
        <SentenceBuildCard
          key={exercise.id}
          exercise={exercise}
          showResult={showResult}
          isCorrect={isCorrect}
          lastAnswerText={props.lastAnswerText}
          grading={props.grading}
          feedback={feedback}
          onSubmit={raw => onSubmit(raw)}
        />
      )}

      {showResult && exercise.explanation && (
        <p className="text-sm text-qz-text-muted px-1 animate-in fade-in duration-300">{exercise.explanation}</p>
      )}

      {showResult && coaching && (coaching.loading || coaching.mnemonic || coaching.example || isCorrect === false) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {coaching.loading && (
            <p className="text-sm text-qz-text-muted flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Подбираю, как это запомнить…
            </p>
          )}
          {coaching.mnemonic && (
            <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
              <Lightbulb className="inline w-4 h-4 mr-1.5 -mt-0.5" /> {coaching.mnemonic}
            </p>
          )}
          {coaching.example && (
            <p className="text-sm text-qz-text">
              <span className="font-semibold">{coaching.example.text}</span>
              <span className="text-qz-text-muted"> — {coaching.example.translation}</span>
            </p>
          )}
          {!coaching.loading && !coaching.mnemonic && !coaching.example && (
            <p className="text-sm text-qz-text-muted">Ничего страшного: это слово ещё встретится — и вы с ним справитесь.</p>
          )}
        </div>
      )}

      {showResult && (
        <button
          onClick={onNext}
          className="self-stretch sm:self-end flex items-center justify-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white font-bold px-6 py-3.5 rounded-2xl transition-colors animate-in fade-in duration-200"
        >
          Дальше <ChevronRight className="w-4 h-4" />
          <span className="hidden sm:inline text-xs font-semibold opacity-70 ml-1">Enter</span>
        </button>
      )}
    </div>
  );
}

function ResultBanner({ isCorrect, answer, given, children }: {
  isCorrect: boolean | null;
  answer: string;
  given?: string;
  children?: ReactNode;
}) {
  if (isCorrect === null) return null;
  return (
    <div
      role="status"
      className={`mt-4 p-5 rounded-2xl border-2 animate-in fade-in slide-in-from-bottom-1 duration-200 ${
        isCorrect ? 'bg-emerald-500/10 border-emerald-500/70' : 'bg-red-500/10 border-red-500/60'
      }`}
    >
      <p className={`font-bold flex items-center gap-2 ${isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
        {isCorrect ? 'Верно!' : 'Пока не так'}
      </p>
      {!isCorrect && (
        <div className="mt-3 space-y-2">
          <div>
            <div className="text-xs font-bold text-qz-text-muted uppercase mb-0.5">Правильно</div>
            <div className="text-lg font-semibold text-qz-text break-words">{answer}</div>
          </div>
          {given !== undefined && (
            <div>
              <div className="text-xs font-bold text-qz-text-muted uppercase mb-0.5">Ваш ответ</div>
              <div className="text-base text-red-600/80 dark:text-red-400/80 break-words">{given || '—'}</div>
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

function OptionsAnswer({ exercise, showResult, lastAnswerText, onSubmit }: QuestionCardProps) {
  const options = exercise.options ?? [];
  const twoCols = exercise.kind === 'gender' || options.every(o => o.length <= 28);
  return (
    <div className={`w-full grid gap-3 ${twoCols ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
      {options.map((option, i) => {
        const isAnswer = option === exercise.answer;
        const wasSelected = option === lastAnswerText;
        let cls = 'bg-qz-card border-qz-border-light hover:border-[#4255ff]/60 active:scale-[0.98] text-qz-text';
        if (showResult) {
          if (isAnswer) cls = 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300';
          else if (wasSelected) cls = 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400';
          else cls = 'bg-qz-card border-qz-border-light text-qz-text-muted opacity-50';
        }
        return (
          <button
            key={`${i}:${option}`}
            onClick={() => onSubmit(i)}
            disabled={showResult}
            className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-150 flex items-center gap-3 min-h-[64px] ${cls}`}
          >
            <span className="hidden sm:flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold bg-qz-bg text-qz-text-muted border border-qz-border-light flex-shrink-0">{i + 1}</span>
            <span className="font-semibold text-lg whitespace-pre-line break-words flex-1">{option}</span>
            {showResult && isAnswer && <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}

function TextAnswer({ exercise, showResult, isCorrect, lastAnswerText, hintUsed, onSubmit, onUseHint }: QuestionCardProps) {
  const [value, setValue] = useState('');
  const paidHint = exercise.local && exercise.hint ? exercise.hint : null;

  return (
    <div className="w-full">
      <form onSubmit={e => { e.preventDefault(); if (value.trim() && !showResult) onSubmit(value); }} className="flex flex-col gap-3">
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={showResult}
          autoFocus
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          lang={exercise.answerLang}
          placeholder="Ваш ответ…"
          className="w-full bg-qz-card border-2 border-qz-border-light rounded-2xl px-5 py-4 focus:border-[#4255ff] outline-none transition-colors font-medium text-xl text-qz-text disabled:opacity-60"
        />
        {!showResult && hintUsed && paidHint && (
          <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-1.5 px-1">
            <Lightbulb className="w-4 h-4" /> Начинается на: <span className="font-bold">{paidHint}</span>
          </p>
        )}
        {!showResult && (
          <div className="flex items-center gap-2">
            <button type="submit" disabled={!value.trim()} className="flex-1 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl transition-colors">
              Проверить
            </button>
            {paidHint && !hintUsed && (
              <button type="button" onClick={onUseHint} className="px-4 py-3.5 rounded-2xl border border-qz-border-light text-qz-text-muted hover:text-qz-text transition-colors" title="Первая буква — слово вернётся раньше">
                <Lightbulb size={18} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSubmit('', { gaveUp: true })}
              className="px-4 py-3.5 rounded-2xl border border-qz-border-light text-sm font-semibold text-qz-text-muted hover:text-qz-text transition-colors"
            >
              Не знаю
            </button>
          </div>
        )}
      </form>

      {showResult && <ResultBanner isCorrect={isCorrect} answer={exercise.answer} given={lastAnswerText} />}
    </div>
  );
}

function SpeakAnswer({ exercise, showResult, isCorrect, feedback, onSubmit, onSkipSpeaking }: QuestionCardProps) {
  const speech = useSpeechAttempt(bcp47ForLanguageCode(exercise.answerLang));
  const [busy, setBusy] = useState(false);

  const record = async () => {
    if (busy) return;
    if (speech.recording) {
      setBusy(true);
      try {
        const primary = await speech.stop();
        const text = bestTranscript(exercise.answer, primary, speech.alternatives());
        // Распознавание досочиняет на тишине и шуме — такой текст не оцениваем
        // вовсе, иначе человек получит «ошибку» за слова, которых не говорил.
        if (!text || !heardSomething(exercise.answer, text, speech.confidence(), speech.quality())) {
          speech.setError('Не расслышал — скажите ещё раз, чуть ближе к микрофону.');
          return;
        }
        onSubmit(text);
      } finally {
        setBusy(false);
      }
      return;
    }
    speech.reset();
    await speech.start();
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {!showResult && (
        <>
          <button
            onClick={() => void record()}
            disabled={busy}
            className={`w-24 h-24 rounded-full transition-all flex items-center justify-center shadow-lg disabled:opacity-60 ${
              speech.recording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#4255ff] hover:bg-[#3144e0] text-white'
            }`}
            aria-label={speech.recording ? 'Остановить запись' : 'Сказать вслух'}
          >
            {busy ? <Loader2 size={30} className="animate-spin" /> : speech.recording ? <Square size={28} /> : <Mic size={34} />}
          </button>
          <p className="text-sm text-qz-text-muted">
            {busy ? 'Распознаю…' : speech.recording ? 'Говорите, потом нажмите ещё раз' : 'Нажмите и скажите'}
          </p>
          {speech.error && <p className="text-sm text-amber-700 dark:text-amber-300 text-center">{speech.error}</p>}
          <div className="flex items-center gap-4 mt-1">
            <button onClick={() => onSubmit('', { gaveUp: true })} className="text-sm font-semibold text-qz-text-muted hover:text-qz-text transition-colors">
              Не знаю
            </button>
            <button onClick={onSkipSpeaking} className="text-sm font-semibold text-qz-text-muted hover:text-qz-text transition-colors">
              Не могу сейчас говорить
            </button>
          </div>
        </>
      )}

      {showResult && (
        <div className="w-full">
          <ResultBanner isCorrect={isCorrect} answer={exercise.answer}>
            {feedback?.heard && (
              <p className="mt-3 text-sm text-qz-text-muted">
                Услышал: «{feedback.heard}»
                {typeof feedback.score === 'number' && feedback.score < 1 && ` · совпало ${Math.round(feedback.score * 100)}%`}
              </p>
            )}
          </ResultBanner>
          {speech.selfUrl && (
            // Послушать себя рядом с образцом — самый быстрый способ услышать разницу.
            <audio src={speech.selfUrl} controls className="w-full mt-3" />
          )}
        </div>
      )}
    </div>
  );
}
