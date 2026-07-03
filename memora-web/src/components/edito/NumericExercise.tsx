'use client';
// Числовая задача (STEM): ученик вводит число (с единицей, если требуется),
// проверка детерминированная — lib/courses/numeric (допуск + приведение единиц).

import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { checkNumeric, type NumericCheck } from '@/lib/courses/numeric';

export function NumericExercise({ exercise, onComplete }: {
  exercise: EditoExercise;
  onComplete?: (result?: { correct: number; total: number; wrongAnswers?: string[] }) => void;
}) {
  const [input, setInput] = useState('');
  const [check, setCheck] = useState<NumericCheck | null>(null);
  const [attempts, setAttempts] = useState(0);

  const spec = {
    answer: exercise.numericAnswer ?? 0,
    tolerance: exercise.tolerance,
    unit: exercise.unit,
    acceptedUnits: exercise.acceptedUnits,
  };

  const handleCheck = () => {
    if (!input.trim() || check) return;
    const result = checkNumeric(spec, input);
    setCheck(result);
    setAttempts(a => a + 1);
    onComplete?.({
      correct: result.correct ? 1 : 0,
      total: 1,
      wrongAnswers: result.correct ? undefined : [input.trim()],
    });
  };

  const handleRetry = () => {
    setInput('');
    setCheck(null);
  };

  const expected = `${exercise.numericAnswer}${exercise.unit ? ` ${exercise.unit}` : ''}`;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <h4 className="text-foreground font-semibold text-sm mb-3">{exercise.title}</h4>
      {exercise.prompt && <p className="text-foreground text-base leading-relaxed mb-4">{exercise.prompt}</p>}

      {!check ? (
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCheck(); }}
            inputMode="decimal"
            placeholder={exercise.unit ? `Ответ в ${exercise.unit} (или др. единицах)` : 'Числовой ответ'}
            className="flex-1 bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
            autoFocus
          />
          <button
            onClick={handleCheck}
            disabled={!input.trim()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#4255ff] disabled:opacity-40 text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" /> Проверить
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`flex gap-2 items-start p-3 rounded-xl text-sm ${
            check.correct
              ? 'dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-300 text-emerald-700'
              : 'dark:bg-red-500/10 bg-red-50 dark:text-red-300 text-red-700'
          }`}>
            {check.correct ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>
              {check.correct && <>Верно! {expected}</>}
              {!check.correct && check.reason === 'unparsed' && <>Не удалось разобрать число — введите, например: 3,5 или 3.5</>}
              {!check.correct && check.reason === 'wrong-unit' && <>Проверьте единицу измерения — ответ нужен в {exercise.unit}.</>}
              {!check.correct && check.reason === 'wrong-value' && <>Неверно. Правильный ответ: <strong>{expected}</strong></>}
            </span>
          </div>
          {exercise.explanation && !check.correct && (
            <p className="text-qz-text-muted text-sm">{exercise.explanation}</p>
          )}
          <div className="flex justify-end">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-foreground text-sm hover:opacity-80 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" /> Ещё раз{attempts > 0 ? ` (попытка ${attempts + 1})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
