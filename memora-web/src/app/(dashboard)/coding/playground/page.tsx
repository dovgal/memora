"use client";

// Свободная песочница: Python и SQL без заданий — как pythontutor, только своя.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Loader2, Table2, XCircle } from "lucide-react";
import CodeEditor from "@/components/coding/CodeEditor";
import { runPython, warmupPython } from "@/lib/coding/pyRunner";
import { runSql, warmupSql, type SqlResultSet } from "@/lib/coding/sqlRunner";

const PY_DEFAULT = `# Свободная песочница Python — пиши что хочешь!
imya = "мир"
print(f"Привет, {imya}!")

for i in range(3):
    print("Python — это весело!")
`;

const SQL_SEED = `
CREATE TABLE igry (
  id INT PRIMARY KEY,
  nazvanie TEXT,
  zhanr TEXT,
  ocenka INT
);
INSERT INTO igry VALUES
  (1, 'Майнкрафт', 'песочница', 10),
  (2, 'Тетрис', 'головоломка', 9),
  (3, 'Шахматы', 'стратегия', 8);
`;

const SQL_DEFAULT = `-- Свободная песочница PostgreSQL.
-- Для тебя уже создана таблица igry (id, nazvanie, zhanr, ocenka).
-- Можешь создавать свои таблицы командой CREATE TABLE!

SELECT * FROM igry;
`;

export default function PlaygroundPage() {
  const [tab, setTab] = useState<"python" | "sql">("python");

  const [pyCode, setPyCode] = useState(PY_DEFAULT);
  const [pyOut, setPyOut] = useState<string | null>(null);
  const [pyErr, setPyErr] = useState<string | null>(null);
  const [pyRunning, setPyRunning] = useState(false);

  const [sqlCode, setSqlCode] = useState(SQL_DEFAULT);
  const [sqlResults, setSqlResults] = useState<SqlResultSet[] | null>(null);
  const [sqlNotice, setSqlNotice] = useState<string | undefined>();
  const [sqlErr, setSqlErr] = useState<string | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);

  useEffect(() => {
    warmupPython();
    warmupSql();
  }, []);

  const runPy = async () => {
    setPyRunning(true);
    setPyErr(null);
    const res = await runPython(pyCode);
    setPyRunning(false);
    setPyOut(res.output || "");
    if (!res.ok) setPyErr(res.error || "Ошибка");
  };

  const runQuery = async () => {
    setSqlRunning(true);
    setSqlErr(null);
    const res = await runSql(SQL_SEED, sqlCode);
    setSqlRunning(false);
    setSqlResults(res.results);
    setSqlNotice(res.notice);
    if (!res.ok) setSqlErr(res.error || "Ошибка");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Link
        href="/coding"
        className="flex items-center gap-1.5 text-sm font-semibold text-qz-text-muted hover:text-qz-accent transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Программирование
      </Link>

      <div>
        <h1 className="text-3xl font-black text-qz-text">🧪 Свободная песочница</h1>
        <p className="text-qz-text-muted mt-1">
          Здесь нет заданий и проверок — просто экспериментируй! Код выполняется у тебя в браузере.
        </p>
      </div>

      {/* Переключатель */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("python")}
          className={`px-5 py-2.5 rounded-xl font-bold transition-colors ${
            tab === "python"
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/20"
              : "bg-secondary text-qz-text-muted hover:text-qz-text"
          }`}
        >
          🐍 Python
        </button>
        <button
          onClick={() => setTab("sql")}
          className={`px-5 py-2.5 rounded-xl font-bold transition-colors ${
            tab === "sql"
              ? "bg-sky-600 text-white shadow-lg shadow-sky-600/20"
              : "bg-secondary text-qz-text-muted hover:text-qz-text"
          }`}
        >
          🐘 SQL · PostgreSQL
        </button>
      </div>

      {tab === "python" ? (
        <div className="space-y-4">
          <CodeEditor value={pyCode} onChange={setPyCode} language="python" minRows={10} />
          <button
            onClick={runPy}
            disabled={pyRunning}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-emerald-600/20"
          >
            {pyRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {pyRunning ? "Выполняю…" : "Запустить"}
          </button>
          {pyOut !== null && (
            <pre className="bg-[#0b0e1c] text-zinc-100 font-mono text-sm rounded-xl p-3 min-h-[3rem] whitespace-pre-wrap border border-zinc-800">
              {pyOut || <span className="text-zinc-500">(программа ничего не вывела)</span>}
            </pre>
          )}
          {pyErr && (
            <div className="flex items-start gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap font-mono text-xs">{pyErr}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <CodeEditor value={sqlCode} onChange={setSqlCode} language="sql" minRows={10} />
          <button
            onClick={runQuery}
            disabled={sqlRunning}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-sky-600/20"
          >
            {sqlRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {sqlRunning ? "Выполняю…" : "Выполнить запрос"}
          </button>
          {sqlNotice && <p className="text-sm text-qz-text-muted">✅ {sqlNotice}</p>}
          {sqlResults !== null &&
            sqlResults.map((rs, i) => (
              <div key={i} className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-qz-text-muted flex items-center gap-1">
                  <Table2 className="w-3.5 h-3.5" /> Результат {sqlResults.length > 1 ? i + 1 : ""}
                </p>
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
                      {rs.rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 ? "bg-secondary/50" : ""}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-1.5 font-mono text-[13px] text-qz-text">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          {sqlErr && (
            <div className="flex items-start gap-2 text-sm bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap font-mono text-xs">{sqlErr}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
