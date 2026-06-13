'use client';
// Какография (метод Projet Voltaire): «найди ошибку».
// Показывается одно предложение; учащийся кликает на ошибочное слово
// либо жмёт «Нет ошибки». Мгновенная обратная связь + коррекция + правило.
//
// errorIndex — индекс ошибочного слова при разбиении предложения по пробелам
// (0-based); null → ошибки нет (валидный кейс, тренирует и вариант «всё верно»).

import { useState } from 'react';
import { CheckCircle2, XCircle, Ban } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

export function ErrorHunt({
  exercise,
  onComplete,
}: {
  exercise: EditoExercise;
  onComplete?: (result?: { correct: number; total: number }) => void;
}) {
  const tokens = (exercise.sentence ?? '').split(/\s+/).filter(Boolean);
  const rawIndex = exercise.errorIndex;
  // Нормализуем: вне диапазона трактуем как «ошибки нет».
  const errorIndex =
    typeof rawIndex === 'number' && rawIndex >= 0 && rawIndex < tokens.length ? rawIndex : null;

  // null — ещё не отвечено; -1 — выбран «Нет ошибки»; иначе индекс выбранного слова.
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const isCorrect = answered && (picked === -1 ? errorIndex === null : picked === errorIndex);

  const choose = (idx: number) => {
    if (answered) return;
    setPicked(idx);
    onComplete?.({ correct: idx === -1 ? (errorIndex === null ? 1 : 0) : (idx === errorIndex ? 1 : 0), total: 1 });
  };

  const tokenClass = (i: number) => {
    if (!answered) return 'border-border hover:border-[#4255ff]/60 text-foreground cursor-pointer';
    // После ответа подсвечиваем: настоящую ошибку — красным, верно выбранную — зелёным.
    if (i === errorIndex) return 'border-red-500/60 dark:bg-red-500/15 bg-red-50 dark:text-red-300 text-red-700';
    if (i === picked && i !== errorIndex) return 'border-amber-500/60 dark:bg-amber-500/15 bg-amber-50 dark:text-amber-600 text-amber-700';
    return 'border-transparent text-foreground';
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-foreground font-semibold text-sm">{exercise.title || 'Найдите ошибку'}</h4>
        <AudioButton text={exercise.correction && errorIndex !== null
          ? tokens.map((t, i) => (i === errorIndex ? exercise.correction! : t)).join(' ')
          : (exercise.sentence ?? '')} />
      </div>

      <p className="text-qz-text-muted text-xs mb-4">
        Нажмите на слово с ошибкой — или «Нет ошибки», если предложение верное.
      </p>

      {/* Кликабельное предложение */}
      <div className="flex flex-wrap gap-x-1.5 gap-y-2 mb-4 text-base leading-relaxed">
        {tokens.map((tok, i) => (
          <button
            key={i}
            onClick={() => choose(i)}
            disabled={answered}
            className={`px-1.5 py-0.5 rounded-md border transition-colors ${tokenClass(i)}`}
          >
            {tok}
          </button>
        ))}
      </div>

      {/* Нет ошибки */}
      <button
        onClick={() => choose(-1)}
        disabled={answered}
        className={`inline-flex items-center gap-1.5 border rounded-xl px-4 py-2 text-sm font-semibold transition-colors mb-4 ${
          answered
            ? picked === -1
              ? (errorIndex === null ? 'border-emerald-500/60 text-emerald-400' : 'border-amber-500/60 text-amber-500')
              : (errorIndex === null ? 'border-emerald-500/60 text-emerald-400' : 'border-border text-qz-text-muted')
            : 'border-border text-foreground hover:border-[#4255ff]/60 cursor-pointer'
        }`}
      >
        <Ban className="w-4 h-4" /> Нет ошибки
      </button>

      {/* Обратная связь */}
      {answered && (
        <div className="space-y-3">
          <div
            className={`flex gap-2 items-start p-3 rounded-xl text-sm ${
              isCorrect
                ? 'dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-300 text-emerald-700'
                : 'dark:bg-red-500/10 bg-red-50 dark:text-red-700 text-red-700'
            }`}
          >
            {isCorrect ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span className="dark:text-qz-text-muted text-foreground">
              {!isCorrect && errorIndex !== null && (
                <strong className="dark:text-white text-foreground">
                  Ошибка в слове «{tokens[errorIndex]}»{exercise.correction ? ` → «${exercise.correction}»` : ''}.{' '}
                </strong>
              )}
              {!isCorrect && errorIndex === null && (
                <strong className="dark:text-white text-foreground">Здесь ошибки нет. </strong>
              )}
              {exercise.explanation || (isCorrect ? 'Верно!' : '')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
