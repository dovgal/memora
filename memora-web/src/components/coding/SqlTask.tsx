"use client";

// SQL-задача: редактор + запуск в PGlite (настоящий PostgreSQL в браузере) + автопроверка.

import { useEffect, useState } from "react";
import { Play, Loader2, XCircle, Table2 } from "lucide-react";
import type { SqlTaskBlock } from "@/data/coding/types";
import { runSql, rowsEqual, warmupSql, type SqlResultSet } from "@/lib/coding/sqlRunner";
import CodeEditor from "./CodeEditor";
import { HintsAndSolution, StoryText, SuccessBanner } from "./TaskShell";

function ResultTable({ rs }: { rs: SqlResultSet }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-secondary">
            {rs.columns.map((c) => (
              <th key={c} className="text-left font-bold px-3 py-2 text-qz-text border-b border-border">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rs.rows.length === 0 ? (
            <tr>
              <td colSpan={rs.columns.length} className="px-3 py-3 text-qz-text-muted italic">
                Пусто — запрос не нашёл ни одной строки
              </td>
            </tr>
          ) : (
            rs.rows.map((row, i) => (
              <tr key={i} className={i % 2 ? "bg-secondary/50" : ""}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-1.5 font-mono text-[13px] text-qz-text">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function SqlTask({
  block,
  seedSql,
  done,
  onSolved,
}: {
  block: SqlTaskBlock;
  seedSql: string;
  done: boolean;
  onSolved: () => void;
}) {
  const [code, setCode] = useState(block.starterCode);
  const [results, setResults] = useState<SqlResultSet[] | null>(null);
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  // `done` — решено раньше (сохранённый прогресс), `justSolved` — в этот заход.
  const [justSolved, setJustSolved] = useState(false);
  const solved = done || justSolved;
  const [fails, setFails] = useState(0);

  useEffect(() => warmupSql(), []);

  const run = async () => {
    setRunning(true);
    setError(null);
    setVerdict(null);
    const res = await runSql(seedSql, code);
    setRunning(false);
    setResults(res.results);
    setNotice(res.notice);
    if (!res.ok) {
      setError(res.error || "Что-то пошло не так");
      setFails((f) => f + 1);
      return;
    }

    // Проверка решения
    const check = block.check;
    if (check.codeContains) {
      const lower = code.toLowerCase();
      for (const frag of check.codeContains) {
        if (!lower.includes(frag.toLowerCase())) {
          setVerdict(`В запросе нужно использовать \`${frag.trim()}\``);
          setFails((f) => f + 1);
          return;
        }
      }
    }
    if (check.expected) {
      const last = res.results[res.results.length - 1];
      if (!last) {
        setVerdict("Запрос не вернул таблицу с результатом. Нужен SELECT!");
        setFails((f) => f + 1);
        return;
      }
      if (!rowsEqual(last.rows, check.expected.rows, !!check.expected.orderMatters)) {
        setVerdict("Результат пока не совпадает с ожидаемым. Проверь условие ещё раз!");
        setFails((f) => f + 1);
        return;
      }
    }
    if (check.checkQuery && check.checkRows) {
      const combined = await runSql(seedSql, code + ";\n" + check.checkQuery);
      if (!combined.ok) {
        setVerdict("Не получилось проверить результат: " + (combined.error || ""));
        setFails((f) => f + 1);
        return;
      }
      const last = combined.results[combined.results.length - 1];
      if (!last || !rowsEqual(last.rows, check.checkRows, false)) {
        setVerdict("Данные в таблице пока не такие, как нужно по заданию. Попробуй ещё раз!");
        setFails((f) => f + 1);
        return;
      }
    }
    setJustSolved(true);
    onSolved();
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-lg text-qz-text">🕵️ {block.title}</h3>
        <span className="text-xs font-bold text-amber-500 bg-amber-500/10 border border-amber-500/30 rounded-full px-2.5 py-1 shrink-0">
          +{block.xp} XP
        </span>
      </div>
      <StoryText story={block.story} />
      <CodeEditor value={code} onChange={setCode} language="sql" minRows={4} />
      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={running}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-sky-600/20"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? "Выполняю…" : "Выполнить запрос"}
        </button>
        {running && <span className="text-xs text-qz-text-muted">Первый запуск может занять несколько секунд: PostgreSQL загружается в браузер</span>}
      </div>

      {notice && <p className="text-sm text-qz-text-muted">✅ {notice}</p>}
      {results !== null &&
        results.map((rs, i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-qz-text-muted flex items-center gap-1">
              <Table2 className="w-3.5 h-3.5" /> Результат {results.length > 1 ? i + 1 : ""}
            </p>
            <ResultTable rs={rs} />
          </div>
        ))}

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
