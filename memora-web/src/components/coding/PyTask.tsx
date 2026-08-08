"use client";

// Python-задача: редактор + запуск в Pyodide + автопроверка решения.

import { useEffect, useState } from "react";
import { Play, Loader2, XCircle } from "lucide-react";
import type { PyTaskBlock } from "@/data/coding/types";
import { runPython, warmupPython } from "@/lib/coding/pyRunner";
import CodeEditor from "./CodeEditor";
import { HintsAndSolution, StoryText, SuccessBanner } from "./TaskShell";

function checkResult(code: string, output: string, check: PyTaskBlock["check"]): string | null {
  // null = всё верно, иначе — текст, почему не засчитано
  if (check.codeContains) {
    for (const frag of check.codeContains) {
      if (!code.includes(frag)) return `В решении нужно использовать \`${frag.trim()}\``;
    }
  }
  const norm = (s: string) =>
    s
      .split("\n")
      .map((l) => l.replace(/\s+$/g, ""))
      .join("\n")
      .trim();
  if (check.expectedOutput !== undefined) {
    if (norm(output) !== norm(check.expectedOutput)) {
      return "Вывод программы пока не совпадает с ожидаемым. Сравни внимательно, до каждой буквы!";
    }
  }
  if (check.outputContains) {
    for (const frag of check.outputContains) {
      if (!output.includes(frag)) return `В выводе должно быть: «${frag}»`;
    }
  }
  return null;
}

export default function PyTask({
  block,
  done,
  onSolved,
}: {
  block: PyTaskBlock;
  done: boolean;
  onSolved: () => void;
}) {
  const [code, setCode] = useState(block.starterCode);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // `done` — задача была решена раньше (из сохранённого прогресса),
  // `justSolved` — решена в этот заход. Оба состояния показывают «решено»,
  // но XP празднуем только за новое решение.
  const [justSolved, setJustSolved] = useState(false);
  const solved = done || justSolved;
  const [fails, setFails] = useState(0);

  useEffect(() => warmupPython(), []);

  const run = async () => {
    setRunning(true);
    setError(null);
    setVerdict(null);
    const res = await runPython(code);
    setRunning(false);
    setOutput(res.output || "");
    if (!res.ok) {
      setError(res.error || "Что-то пошло не так");
      setFails((f) => f + 1);
      return;
    }
    const problem = checkResult(code, res.output || "", block.check);
    if (problem) {
      setVerdict(problem);
      setFails((f) => f + 1);
    } else {
      setJustSolved(true);
      onSolved();
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-lg text-qz-text">🎮 {block.title}</h3>
        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1 shrink-0">
          +{block.xp} XP
        </span>
      </div>
      <StoryText story={block.story} />
      <CodeEditor value={code} onChange={setCode} language="python" />
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Выполняю…" : "Запустить"}
        </button>
        {running && <span className="text-xs text-qz-text-muted">Первый запуск может занять ~10 секунд: Python загружается в браузер</span>}
      </div>

      {output !== null && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-qz-text-muted mb-1">Вывод программы</p>
          <pre className="bg-[#0b0e1c] text-zinc-100 font-mono text-sm rounded-xl p-3 min-h-[3rem] whitespace-pre-wrap border border-zinc-800">
            {output || <span className="text-zinc-500">(программа ничего не вывела)</span>}
          </pre>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">
          <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <pre className="whitespace-pre-wrap font-mono text-xs">{error}</pre>
        </div>
      )}
      {verdict && !error && (
        <div className="text-sm bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 rounded-lg px-3 py-2">
          🤔 {verdict}
        </div>
      )}

      {solved ? (
        <SuccessBanner xp={block.xp} alreadyDone={!justSolved} />
      ) : (
        <HintsAndSolution hints={block.hints} solution={block.solution} fails={fails} />
      )}
    </div>
  );
}
