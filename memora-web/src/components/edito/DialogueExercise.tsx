'use client';
import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { EditoExercise, DialogueExchange } from '@/lib/courses/edito-a1';
import { AudioButton } from './AudioButton';

function Bubble({ exchange, revealed }: { exchange: DialogueExchange; revealed?: boolean }) {
  const isRight = exchange.side === 'right';
  const text = revealed ? (exchange.correctAnswer || '') : (exchange.text || '');

  return (
    <div className={`flex ${isRight ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[75%] ${isRight ? 'items-end' : 'items-start'} flex flex-col`}>
        <span className="text-qz-text-muted text-xs mb-1 px-1">{exchange.speaker}</span>
        <div className={`relative rounded-2xl px-4 py-2.5 text-sm ${
          isRight
            ? 'bg-[#4255ff]/20 border border-[#4255ff]/30 text-foreground rounded-tr-sm'
            : 'bg-muted border border-border text-foreground rounded-tl-sm'
        } ${exchange.isBlank && !revealed ? 'opacity-40 border-dashed' : ''}`}>
          {exchange.isBlank && !revealed ? '❓ ...' : text}
        </div>
        {text && <div className={`mt-1 ${isRight ? 'self-end' : 'self-start'}`}><AudioButton text={text} /></div>}
      </div>
    </div>
  );
}

export function DialogueExercise({ exercise, onComplete }: { exercise: EditoExercise; onComplete?: (result?: { correct: number; total: number }) => void }) {
  const exchanges: DialogueExchange[] = exercise.exchanges || [];
  const blanks = exchanges.filter(e => e.isBlank);

  const [answers, setAnswers] = useState<Record<number, { given: string; correct: boolean }>>({});
  const [activeBlankIdx, setActiveBlankIdx] = useState(0);
  const [finished, setFinished] = useState(false);
  const [optionsLocked, setOptionsLocked] = useState(false);

  // Guard against a fast double-click on "Далее" landing on the next
  // blank's options grid, which renders in the same screen position and
  // would otherwise auto-submit an answer the user never chose.
  useEffect(() => {
    setOptionsLocked(true);
    const t = setTimeout(() => setOptionsLocked(false), 350);
    return () => clearTimeout(t);
  }, [activeBlankIdx]);

  const currentBlankExchangeIdx = (() => {
    let blankCount = -1;
    for (let i = 0; i < exchanges.length; i++) {
      if (exchanges[i].isBlank) {
        blankCount++;
        if (blankCount === activeBlankIdx) return i;
      }
    }
    return -1;
  })();

  const activeExchange = blanks[activeBlankIdx];

  const handleChoice = (opt: string) => {
    if (optionsLocked || answers[activeBlankIdx]) return;
    const correct = opt === activeExchange.correctAnswer;
    setAnswers(prev => ({ ...prev, [activeBlankIdx]: { given: opt, correct } }));
  };

  const handleNext = () => {
    if (optionsLocked) return;
    setOptionsLocked(true);
    if (activeBlankIdx < blanks.length - 1) {
      setActiveBlankIdx(i => i + 1);
    } else {
      setFinished(true);
      onComplete?.({ correct: Object.values(answers).filter(a => a.correct).length, total: blanks.length });
    }
  };

  const correctCount = Object.values(answers).filter(a => a.correct).length;
  const isAnswered = !!answers[activeBlankIdx];
  const wasCorrect = answers[activeBlankIdx]?.correct;

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-foreground font-semibold text-sm">{exercise.title}</h4>
        {!finished && <span className="text-qz-text-muted text-xs">{activeBlankIdx + 1} / {blanks.length}</span>}
      </div>

      {exercise.context && (
        <p className="text-qz-text-muted text-xs italic mb-4 bg-muted px-3 py-2 rounded-lg">{exercise.context}</p>
      )}

      {/* Dialogue */}
      <div className="mb-5 space-y-1">
        {exchanges.map((ex, i) => {
          const blankOrder = (() => { let n = -1; for (let j = 0; j <= i; j++) if (exchanges[j].isBlank) n++; return n; })();
          const isAnsweredBlank = ex.isBlank && answers[blankOrder] !== undefined;
          return <Bubble key={i} exchange={ex} revealed={isAnsweredBlank} />;
        })}
      </div>

      {!finished && (
        <div>
          {/* Active blank prompt */}
          <div className="bg-[#4255ff]/10 border border-[#4255ff]/30 rounded-xl px-4 py-3 mb-3">
            <p className="text-[#4255ff] text-xs font-semibold mb-0.5">
              Что отвечает {activeExchange?.speaker}?
            </p>
          </div>

          {/* Options */}
          {!isAnswered ? (
            <div className="grid gap-2">
              {(activeExchange?.options || []).map(opt => (
                <button key={opt}
                  onClick={() => handleChoice(opt)}
                  className="text-left border border-border bg-muted rounded-xl px-4 py-3 text-sm text-foreground hover:border-[#4255ff]/50 hover:bg-[#4255ff]/5 transition-all flex items-center justify-between gap-2">
                  {opt}
                  <AudioButton text={opt} />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className={`flex gap-2 items-start text-sm p-3 rounded-xl ${wasCorrect ? 'dark:bg-emerald-500/10 bg-emerald-50' : 'dark:bg-red-500/10 bg-red-50'}`}>
                {wasCorrect
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                }
                <div className="dark:text-qz-text-muted text-foreground">
                  {!wasCorrect && <><strong className="dark:text-white text-foreground">{activeExchange.correctAnswer}</strong> — </>}
                  {activeExchange.explanation}
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleNext}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors">
                  {activeBlankIdx < blanks.length - 1 ? 'Далее' : 'Завершить'} <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {finished && (
        <div className="bg-muted rounded-xl p-4 text-center">
          <p className="text-foreground font-semibold mb-1">{correctCount}/{blanks.length} правильно</p>
          <p className="text-qz-text-muted text-sm">Диалог завершён!</p>
        </div>
      )}
    </div>
  );
}
