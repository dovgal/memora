'use client';
import { useState, useMemo } from 'react';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { EditoExercise, BlankItem } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

export function FillBlank({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: () => void }) {
  const blanks: BlankItem[] = exercise.blanks || [];
  const parts = useMemo(() => (exercise.text || '').split('___'), [exercise.text]);

  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Array<{ answer: string; correct: boolean; given: string }>>([]);
  const [checked, setChecked] = useState(false);
  const [finished, setFinished] = useState(false);

  const isCorrect = useMemo(() => {
    const expected = (blanks[current]?.answer || '').toLowerCase().trim();
    return input.toLowerCase().trim() === expected;
  }, [input, current]);

  const handleCheck = () => {
    if (!input.trim()) return;
    setChecked(true);
    setResults(prev => [...prev, {
      answer: blanks[current].answer,
      correct: isCorrect,
      given: input.trim(),
    }]);
  };

  const handleNext = () => {
    if (current < blanks.length - 1) {
      setCurrent(c => c + 1);
      setInput('');
      setChecked(false);
    } else {
      setFinished(true);
      onComplete?.();
    }
  };

  const correctCount = results.filter(r => r.correct).length;

  if (finished) {
    const pct = Math.round((correctCount / blanks.length) * 100);
    return (
      <div className="bg-[#13162a] border border-[#262c40] rounded-2xl p-6">
        <div className="text-center mb-5">
          <div className="text-3xl mb-2">{pct >= 80 ? '🏆' : pct >= 60 ? '⭐' : '💪'}</div>
          <h4 className="text-white font-bold text-base mb-1">{exercise.title}</h4>
          <p className="text-[#8e95ae] text-sm">{correctCount} / {blanks.length} · {pct}%</p>
        </div>
        {/* Full text with answers */}
        <div className="bg-[#1e2640] rounded-xl p-4 text-sm leading-8">
          {parts.map((part, i) => (
            <span key={i}>
              <span className="text-[#c8cce0]">{part}</span>
              {i < results.length && (
                <span className={`inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded font-semibold ${results[i].correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  {results[i].correct ? results[i].answer : (
                    <><span className="line-through opacity-60">{results[i].given}</span> {results[i].answer}</>
                  )}
                  <AudioButton text={results[i].answer} />
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    );
  }

  const blank = blanks[current];

  return (
    <div className="bg-[#13162a] border border-[#262c40] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white font-semibold text-sm">{exercise.title}</h4>
        <span className="text-[#8e95ae] text-xs">{current + 1} / {blanks.length}</span>
      </div>

      {/* Progress */}
      <div className="h-1 bg-[#1e2640] rounded-full mb-5">
        <div className="h-full bg-[#4255ff] rounded-full transition-all"
          style={{ width: `${(current / blanks.length) * 100}%` }} />
      </div>

      {/* Text with current blank highlighted */}
      <div className="bg-[#1e2640] rounded-xl p-4 text-sm leading-8 mb-5">
        {parts.map((part, i) => (
          <span key={i}>
            <span className="text-[#c8cce0]">{part}</span>
            {i < blanks.length && (
              i < current ? (
                <span className={`inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded font-semibold text-xs ${results[i]?.correct ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                  {results[i]?.correct ? results[i].answer : blanks[i].answer}
                  <AudioButton text={blanks[i].answer} />
                </span>
              ) : i === current ? (
                <span className="inline-block mx-1 px-3 py-0.5 rounded border-2 border-[#4255ff] bg-[#4255ff]/10 text-[#4255ff] font-semibold text-sm min-w-[60px] text-center">
                  {checked ? (
                    <span className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>{blank.answer}</span>
                  ) : '?'}
                </span>
              ) : (
                <span className="inline-block mx-1 px-3 py-0.5 rounded border border-[#262c40] text-[#8e95ae]/40 font-semibold text-sm min-w-[50px] text-center">___</span>
              )
            )}
          </span>
        ))}
      </div>

      {/* Input */}
      {!checked ? (
        <div className="space-y-3">
          {blank?.hint && <p className="text-[#8e95ae] text-xs">💡 {blank.hint}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              placeholder="Введите слово..."
              className="flex-1 bg-[#1e2640] border border-[#262c40] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#4255ff] transition-colors placeholder:text-[#8e95ae]/50"
              autoFocus
            />
            <button onClick={handleCheck} disabled={!input.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors disabled:opacity-50">
              Проверить
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`flex gap-2 items-center p-3 rounded-xl text-sm ${isCorrect ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
            {isCorrect
              ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-emerald-300 font-semibold">Правильно!</span><AudioButton text={blank.answer} /></>
              : <><XCircle className="w-4 h-4 text-red-400" /><span className="text-[#8e95ae]">Правильно: <strong className="text-white">{blank.answer}</strong></span><AudioButton text={blank.answer} /></>
            }
          </div>
          <div className="flex justify-end">
            <button onClick={handleNext} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
              {current < blanks.length - 1 ? 'Далее' : 'Результат'} <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
