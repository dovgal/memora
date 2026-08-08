"use client";

// Общая обёртка игровой задачи: условие, подсказки, решение после 3 неудач,
// отметка «выполнено» и начисление XP.

import { useState } from "react";
import { Lightbulb, CheckCircle2, Eye, Sparkles } from "lucide-react";
import { InlineCode } from "./InlineCode";

export function StoryText({ story }: { story: string[] }) {
  return (
    <div className="space-y-2">
      {story.map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-qz-text">
          <InlineCode text={p} />
        </p>
      ))}
    </div>
  );
}

export function HintsAndSolution({
  hints,
  solution,
  fails,
  onUseSolution,
}: {
  hints: string[];
  solution: string;
  fails: number;
  onUseSolution?: () => void;
}) {
  const [shown, setShown] = useState(0);
  const [solutionShown, setSolutionShown] = useState(false);

  return (
    <div className="space-y-2">
      {hints.slice(0, shown).map((h, i) => (
        <div
          key={i}
          className="flex items-start gap-2 text-sm bg-amber-500/10 border border-amber-500/30 text-qz-text rounded-lg px-3 py-2"
        >
          <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <span><InlineCode text={h} /></span>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {shown < hints.length && (
          <button
            onClick={() => setShown((s) => s + 1)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 transition-colors"
          >
            💡 Подсказка {shown + 1} из {hints.length}
          </button>
        )}
        {fails >= 3 && !solutionShown && (
          <button
            onClick={() => {
              setSolutionShown(true);
              onUseSolution?.();
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-500/15 text-qz-text-muted hover:bg-zinc-500/25 transition-colors flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" /> Показать решение
          </button>
        )}
      </div>
      {solutionShown && (
        <pre className="bg-[#111527] text-emerald-100 font-mono text-sm rounded-xl p-3 overflow-x-auto border border-zinc-700">
          {solution}
        </pre>
      )}
    </div>
  );
}

export function SuccessBanner({ xp, alreadyDone }: { xp: number; alreadyDone: boolean }) {
  return (
    <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-4 py-3 animate-[pulse_1s_ease-in-out_1]">
      <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
      <div>
        <p className="font-bold text-emerald-600 dark:text-emerald-400">Задача решена! 🎉</p>
        <p className="text-sm text-qz-text-muted flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          {alreadyDone ? "Опыт за эту задачу уже получен" : `+${xp} XP`}
        </p>
      </div>
    </div>
  );
}
