'use client';
// Символьное выражение (математика): ученик вводит выражение-ответ,
// эквивалентность проверяет CAS-сервис — «2(x+1)» засчитывается как «2x+2».

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { CheckCircle2, XCircle, RotateCcw, Loader2 } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { checkSymbolic } from '@/lib/courses/customCoursesApi';

export function SymbolicExercise({ exercise, onComplete }: {
  exercise: EditoExercise;
  onComplete?: (result?: { correct: number; total: number; wrongAnswers?: string[] }) => void;
}) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const handleCheck = async () => {
    if (!input.trim() || busy || verdict) return;
    setBusy(true);
    setError(null);
    try {
      const { correct } = await checkSymbolic(exercise.expectedExpression ?? '', input, idToken);
      setVerdict(correct ? 'correct' : 'wrong');
      setAttempts(a => a + 1);
      onComplete?.({
        correct: correct ? 1 : 0,
        total: 1,
        wrongAnswers: correct ? undefined : [input.trim()],
      });
    } catch (e) {
      setError(e instanceof Error && e.message.includes('not configured')
        ? 'Проверка выражений не настроена на сервере (memora-math).'
        : 'Не удалось проверить — попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = () => {
    setInput('');
    setVerdict(null);
    setError(null);
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <h4 className="text-foreground font-semibold text-sm mb-3">{exercise.title}</h4>
      {exercise.prompt && <p className="text-foreground text-base leading-relaxed mb-4">{exercise.prompt}</p>}

      {!verdict ? (
        <>
          <div className="flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void handleCheck(); }}
              placeholder="Выражение, например: 2x + 2 или 2(x+1)"
              className="flex-1 bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 font-mono"
              autoFocus
              spellCheck={false}
            />
            <button
              onClick={handleCheck}
              disabled={!input.trim() || busy}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#4255ff] disabled:opacity-40 text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Проверить
            </button>
          </div>
          <p className="text-qz-text-muted text-xs mt-2">
            Эквивалентные формы засчитываются: 2(x+1) = 2x+2. Степень — ^ или **.
          </p>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </>
      ) : (
        <div className="space-y-3">
          <div className={`flex gap-2 items-start p-3 rounded-xl text-sm ${
            verdict === 'correct'
              ? 'dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-300 text-emerald-700'
              : 'dark:bg-red-500/10 bg-red-50 dark:text-red-300 text-red-700'
          }`}>
            {verdict === 'correct' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>
              {verdict === 'correct'
                ? <>Верно! Ваше выражение эквивалентно ответу.</>
                : <>Неверно. Ожидалось: <strong className="font-mono">{exercise.expectedExpression}</strong> (или эквивалентная форма)</>}
            </span>
          </div>
          {exercise.explanation && verdict === 'wrong' && (
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
