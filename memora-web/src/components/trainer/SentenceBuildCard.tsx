'use client';
// build: построить свою фразу с изученным словом — целиком, своими словами.
// Проверка идёт по смыслу и грамматике (/api/ai/course/check-production в
// режиме freeForm), не по буквам: примеры сервера — лишь образцы, и фраза,
// непохожая на них, не ошибка. Поэтому такое задание приходит только с
// сервера — простым сравнением строк его не проверить.

import { useState } from 'react';
import { CheckCircle2, Info, Loader2, Mic, Square, XCircle } from 'lucide-react';
import type { TrainerExercise } from '@/lib/contracts/trainer';
import type { AnswerFeedback } from '@/lib/trainer/useTrainerSession';
import { useSpeechAttempt } from '@/lib/courses/useSpeechAttempt';
import { heardSomething } from '@/lib/courses/heardCheck';
import { bcp47ForLanguageCode } from '@/lib/trainer/lang';

/** Сравнение без регистра и пунктуации: «Лучше так» с одной добавленной точкой — не поправка. */
const loose = (s: string) => s.toLowerCase().replace(/[.,!?;:«»"'’…\s]+/g, ' ').trim();

export function SentenceBuildCard({
  exercise, showResult, isCorrect, lastAnswerText, grading, feedback, onSubmit,
}: {
  exercise: TrainerExercise;
  showResult: boolean;
  isCorrect: boolean | null;
  lastAnswerText: string;
  grading: boolean;
  feedback: AnswerFeedback | null;
  onSubmit: (raw: string) => void;
}) {
  const [value, setValue] = useState('');
  const speech = useSpeechAttempt(bcp47ForLanguageCode(exercise.answerLang));
  const canSubmit = value.trim().length > 0 && !grading && !showResult;

  const record = async () => {
    if (speech.recording) {
      const text = await speech.stop();
      // Своя фраза не обязана совпадать с примером по длине, поэтому
      // сверяем с ней самой: отсекаем только тишину и досочинённое.
      if (!text || !heardSomething(text, text, speech.confidence(), speech.quality())) {
        speech.setError('Не расслышал — повторите ближе к микрофону или напишите фразу.');
        return;
      }
      setValue(text);
      return;
    }
    speech.reset();
    await speech.start();
  };

  return (
    <div className="w-full">
      <form onSubmit={e => { e.preventDefault(); if (canSubmit) onSubmit(value); }} className="flex flex-col gap-3">
        <div className="flex gap-2">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => {
              // Enter — отправить, Shift+Enter — перенос: фраза короткая, переносы редки.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canSubmit) onSubmit(value); }
            }}
            disabled={showResult || grading}
            autoFocus
            rows={2}
            lang={exercise.answerLang}
            spellCheck={false}
            placeholder="Скажите или напишите фразу целиком"
            className="flex-1 resize-none bg-qz-card border-2 border-qz-border-light rounded-2xl px-5 py-4 focus:border-[#4255ff] outline-none transition-colors font-medium text-lg text-qz-text disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => void record()}
            disabled={showResult || grading}
            aria-label={speech.recording ? 'Остановить запись' : 'Надиктовать фразу'}
            className={`w-14 rounded-2xl border-2 transition-colors disabled:opacity-40 flex-shrink-0 flex items-center justify-center ${
              speech.recording ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-qz-border-light text-qz-text hover:border-[#4255ff]/60'
            }`}
          >
            {speech.recording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
        </div>
        {speech.error && <p className="text-sm text-amber-700 dark:text-amber-300">{speech.error}</p>}

        {!showResult && (
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white font-bold py-3.5 rounded-2xl transition-colors"
          >
            {grading && <Loader2 className="w-4 h-4 animate-spin" />} {grading ? 'Проверяю…' : 'Проверить'}
          </button>
        )}
      </form>

      {showResult && (
        <div
          role="status"
          className={`mt-4 p-5 rounded-2xl border-2 space-y-2 ${
            isCorrect === null ? 'bg-qz-card border-qz-border-light'
              : isCorrect ? 'bg-emerald-500/10 border-emerald-500/70' : 'bg-amber-500/10 border-amber-500/60'
          }`}
        >
          <p className={`font-bold flex items-center gap-2 ${
            isCorrect === null ? 'text-qz-text' : isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'
          }`}>
            {isCorrect === null ? <Info size={20} /> : isCorrect ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
            {isCorrect === null ? 'Не получилось проверить — сравните с примером' : isCorrect ? 'Отличная фраза!' : 'Почти — поправим'}
          </p>
          <p className="text-sm text-qz-text-muted">Ваша фраза: <span className="text-qz-text">{lastAnswerText}</span></p>
          {feedback?.corrected && loose(feedback.corrected) !== loose(lastAnswerText) && (
            <p className="text-sm text-qz-text-muted">Лучше так: <span className="font-semibold text-qz-text">{feedback.corrected}</span></p>
          )}
          {feedback?.explanation && <p className="text-sm text-qz-text">{feedback.explanation}</p>}
          {(isCorrect === null || !isCorrect) && (
            <p className="text-sm text-qz-text-muted">Например: <span className="font-semibold text-qz-text">{exercise.answer}</span></p>
          )}
        </div>
      )}
    </div>
  );
}
