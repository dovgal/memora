"use client";

// Мини-викторина в конце урока: вопросы с вариантами, XP за все правильные ответы.

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import type { QuizBlock } from "@/data/coding/types";
import { InlineCode } from "./InlineCode";
import { SuccessBanner } from "./TaskShell";

export default function Quiz({
  block,
  done,
  onSolved,
}: {
  block: QuizBlock;
  done: boolean;
  onSolved: () => void;
}) {
  const [answers, setAnswers] = useState<(number | null)[]>(block.questions.map(() => null));
  const [checked, setChecked] = useState(false);
  // `done` — викторина пройдена раньше, `justSolved` — пройдена в этот заход.
  const [justSolved, setJustSolved] = useState(false);
  const solved = done || justSolved;

  const allAnswered = answers.every((a) => a !== null);
  const allCorrect = block.questions.every((q, i) => answers[i] === q.correctIndex);

  const submit = () => {
    setChecked(true);
    if (allCorrect) {
      setJustSolved(true);
      onSolved();
    }
  };

  const retry = () => {
    setChecked(false);
    setAnswers(block.questions.map(() => null));
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-lg text-qz-text">🧠 {block.title}</h3>
        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1 shrink-0">
          +{block.xp} XP
        </span>
      </div>

      {block.questions.map((q, qi) => {
        const chosen = answers[qi];
        const isCorrect = checked && chosen === q.correctIndex;
        const isWrong = checked && chosen !== null && chosen !== q.correctIndex;
        return (
          <div key={qi} className="space-y-2">
            <p className="font-semibold text-qz-text">
              {qi + 1}. <InlineCode text={q.question} />
            </p>
            <div className="grid gap-2">
              {q.options.map((opt, oi) => {
                const active = chosen === oi;
                let cls = "border-border bg-secondary/40 hover:border-indigo-400";
                if (checked && oi === q.correctIndex) cls = "border-emerald-500 bg-emerald-500/10";
                else if (checked && active && oi !== q.correctIndex) cls = "border-red-500 bg-red-500/10";
                else if (active) cls = "border-indigo-500 bg-indigo-500/10";
                return (
                  <button
                    key={oi}
                    disabled={checked && allCorrect}
                    onClick={() => {
                      if (!checked) {
                        setAnswers((a) => a.map((v, i) => (i === qi ? oi : v)));
                      }
                    }}
                    className={`text-left px-4 py-2.5 rounded-xl border transition-colors text-sm text-qz-text ${cls}`}
                  >
                    <InlineCode text={opt} />
                  </button>
                );
              })}
            </div>
            {isCorrect && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-start gap-1.5">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <InlineCode text={q.explain} />
              </p>
            )}
            {isWrong && (
              <p className="text-sm text-red-500 flex items-start gap-1.5">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> Не совсем. Попробуй ещё раз!
              </p>
            )}
          </div>
        );
      })}

      {solved ? (
        <SuccessBanner xp={block.xp} alreadyDone={!justSolved} />
      ) : checked && !allCorrect ? (
        <button
          onClick={retry}
          className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          Попробовать снова
        </button>
      ) : (
        <button
          onClick={submit}
          disabled={!allAnswered}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
        >
          Проверить ответы
        </button>
      )}
    </div>
  );
}
