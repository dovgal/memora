'use client';
// Диктант (dictée, метод Projet Voltaire): фраза озвучивается через Inworld,
// учащийся печатает на слух, проверка — детерминированный пословный diff
// (lib/courses/dictation). Текст фразы до проверки не показывается.

import { useState } from 'react';
import { Volume2, Turtle, CheckCircle2, RotateCcw } from 'lucide-react';
import { EditoExercise } from '@/lib/courses/edito-a1';
import { speakInworld } from '@/lib/courses/ttsInworld';
import { checkDictation, type DictationCheck } from '@/lib/courses/dictation';
import { DiffChips } from './DiffChips';

export function DictationExercise({ exercise, onComplete }: {
  exercise: EditoExercise;
  onComplete?: (result?: { correct: number; total: number; wrongAnswers?: string[] }) => void;
}) {
  const sentence = exercise.sentence ?? '';
  const [input, setInput] = useState('');
  const [check, setCheck] = useState<DictationCheck | null>(null);

  const play = () => { void speakInworld(sentence); };

  // Медленно: по одному слову с паузами (как в тренажёре A2).
  const playSlow = () => {
    const words = sentence.split(/\s+/).filter(Boolean);
    let i = 0;
    const step = () => {
      if (i < words.length) { void speakInworld(words[i]); i++; setTimeout(step, 1100); }
    };
    step();
  };

  const handleCheck = () => {
    if (!input.trim() || check) return;
    const result = checkDictation(sentence, input);
    setCheck(result);
    onComplete?.({
      correct: result.correct,
      total: result.total,
      wrongAnswers: result.wrongGiven.length ? result.wrongGiven : undefined,
    });
  };

  const handleRetry = () => {
    setInput('');
    setCheck(null);
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-foreground font-semibold text-sm">{exercise.title || 'Диктант'}</h4>
        {check && (
          <span className="text-qz-text-muted text-xs">✓ {check.correct} / {check.total}</span>
        )}
      </div>

      {/* Озвучка */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={play}
          className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          <Volume2 className="w-4 h-4" /> Прослушать
        </button>
        <button
          onClick={playSlow}
          className="inline-flex items-center gap-2 border border-border text-qz-text-muted hover:text-foreground text-sm px-4 py-2.5 rounded-xl transition-colors"
          title="По одному слову"
        >
          <Turtle className="w-4 h-4" /> Медленно
        </button>
      </div>

      {!check ? (
        <>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCheck(); } }}
            rows={2}
            className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 resize-y mb-3"
            placeholder="Напишите услышанную фразу…"
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <div className="flex justify-end">
            <button
              onClick={handleCheck}
              disabled={!input.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#4255ff] disabled:opacity-40 text-white text-sm font-semibold hover:bg-[#3144e0] transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Проверить
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {/* Пословный diff: зелёное — верно, красное — как надо было */}
          <DiffChips ops={check.ops} />

          {exercise.translation && (
            <p className="text-qz-text-muted text-sm">Перевод: {exercise.translation}</p>
          )}
          {exercise.explanation && check.correct < check.total && (
            <p className="text-qz-text-muted text-sm">{exercise.explanation}</p>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-muted text-foreground text-sm hover:opacity-80 transition-opacity"
            >
              <RotateCcw className="w-4 h-4" /> Ещё раз
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
