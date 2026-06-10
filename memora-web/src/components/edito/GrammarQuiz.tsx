'use client';
import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

export function GrammarQuiz({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: (result?: { correct: number; total: number }) => void }) {
  const questions = exercise.questions || [];
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const q = questions[current];
  const isCorrect = selected === q?.correctAnswer;

  const handleSelect = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    if (opt === q.correctAnswer) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent(c => c + 1);
      setSelected(null);
    } else {
      setFinished(true);
      onComplete?.({ correct: score, total: questions.length });
    }
  };

  const handleRestart = () => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="bg-qz-card border border-border rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">{pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '💪'}</div>
        <h4 className="text-foreground font-bold text-lg mb-1">{exercise.title}</h4>
        <p className="text-qz-text-muted text-sm mb-4">
          {score} / {questions.length} правильно · {pct}%
        </p>
        <button onClick={handleRestart} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted text-foreground text-sm hover:bg-muted transition-colors">
          <RotateCcw className="w-4 h-4" /> Ещё раз
        </button>
      </div>
    );
  }

  // Render question with ___ replaced by input slot
  const parts = q.question.split('___');

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
        <span className="text-qz-text-muted text-xs">{current + 1} / {questions.length} · ✓ {score}</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-muted rounded-full mb-5">
        <div
          className="h-full bg-[#4255ff] rounded-full transition-all duration-300"
          style={{ width: `${(current / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-foreground text-base font-medium mb-5 leading-relaxed">
        {parts.map((part, i, arr) => (
          <span key={i}>
            {part}
            {i !== arr.length - 1 && (
              <span className={`inline-block min-w-[60px] border-b-2 mx-1 text-center transition-colors ${
                selected ? (isCorrect ? 'border-emerald-400 text-emerald-400' : 'border-red-400 text-red-400') : 'border-[#4255ff] text-transparent'
              }`}>
                {selected || '___'}
              </span>
            )}
          </span>
        ))}
      </p>

      {/* Options */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {q.options.map((opt) => {
          let cls = 'bg-muted border-border text-foreground hover:border-[#4255ff]/50';
          if (selected) {
            if (opt === q.correctAnswer) cls = 'dark:bg-emerald-500/15 bg-emerald-50 border-emerald-500/50 dark:text-emerald-300 text-emerald-700';
            else if (opt === selected) cls = 'dark:bg-red-500/15 bg-red-50 border-red-500/50 dark:text-red-300 text-red-600';
            else cls = 'bg-muted border-border text-qz-text-muted';
          }
          return (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              disabled={!!selected}
              className={`border rounded-xl px-4 py-3 text-sm text-left transition-all ${cls} ${!selected ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <span className="flex items-center justify-between gap-2">
                {opt}
                <AudioButton text={opt} />
              </span>
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {selected && (
        <div className="space-y-3">
          {q.explanation && (
            <div className={`flex gap-2 items-start p-3 rounded-xl text-sm ${isCorrect ? 'dark:bg-emerald-500/10 bg-emerald-50 dark:text-emerald-300 text-emerald-700' : 'dark:bg-red-500/10 bg-red-50 dark:text-red-600 text-red-700'}`}>
              {isCorrect ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="dark:text-qz-text-muted text-foreground">
                {!isCorrect && <strong className="dark:text-white text-foreground">Правильно: {q.correctAnswer}. </strong>}
                {q.explanation}
              </span>
            </div>
          )}
          {!q.explanation && !isCorrect && (
            <div className="flex gap-2 items-center p-3 rounded-xl text-sm dark:bg-red-500/10 bg-red-50 dark:text-red-300 text-red-700">
              <XCircle className="w-4 h-4 shrink-0" />
              Правильно: <strong className="text-foreground ml-1">{q.correctAnswer}</strong>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={handleNext} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
              {current < questions.length - 1 ? 'Далее' : 'Результат'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
