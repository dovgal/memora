'use client';
import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

export function GrammarQuiz({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: () => void }) {
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
      onComplete?.();
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
      <div className="bg-[#13162a] border border-[#262c40] rounded-2xl p-6 text-center">
        <div className="text-4xl mb-3">{pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '💪'}</div>
        <h4 className="text-white font-bold text-lg mb-1">{exercise.title}</h4>
        <p className="text-[#8e95ae] text-sm mb-4">
          {score} / {questions.length} правильно · {pct}%
        </p>
        <button onClick={handleRestart} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e2640] text-white text-sm hover:bg-[#262c40] transition-colors">
          <RotateCcw className="w-4 h-4" /> Ещё раз
        </button>
      </div>
    );
  }

  // Render question with ___ replaced by input slot
  const parts = q.question.split('___');

  return (
    <div className="bg-[#13162a] border border-[#262c40] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-white font-semibold text-sm">{exercise.title}</h4>
        <span className="text-[#8e95ae] text-xs">{current + 1} / {questions.length} · ✓ {score}</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-[#1e2640] rounded-full mb-5">
        <div
          className="h-full bg-[#4255ff] rounded-full transition-all duration-300"
          style={{ width: `${(current / questions.length) * 100}%` }}
        />
      </div>

      {/* Question */}
      <p className="text-white text-base font-medium mb-5 leading-relaxed">
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
          let cls = 'bg-[#1e2640] border-[#262c40] text-white hover:border-[#4255ff]/50';
          if (selected) {
            if (opt === q.correctAnswer) cls = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300';
            else if (opt === selected) cls = 'bg-red-500/15 border-red-500/50 text-red-300';
            else cls = 'bg-[#1e2640] border-[#262c40] text-[#8e95ae]';
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
            <div className={`flex gap-2 items-start p-3 rounded-xl text-sm ${isCorrect ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
              {isCorrect ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
              <span className="text-[#8e95ae]">
                {!isCorrect && <strong className="text-white">Правильно: {q.correctAnswer}. </strong>}
                {q.explanation}
              </span>
            </div>
          )}
          {!q.explanation && !isCorrect && (
            <div className="flex gap-2 items-center p-3 rounded-xl text-sm bg-red-500/10 text-red-300">
              <XCircle className="w-4 h-4 shrink-0" />
              Правильно: <strong className="text-white ml-1">{q.correctAnswer}</strong>
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
