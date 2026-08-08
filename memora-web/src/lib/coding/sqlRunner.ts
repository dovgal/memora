"use client";

// Настоящий PostgreSQL в браузере: PGlite (Postgres, скомпилированный в WASM).
// База живёт в памяти вкладки. Перед каждым запуском схема public полностью
// пересоздаётся и наполняется seed-скриптом урока, поэтому ученик не может
// ничего сломать надолго, а результат задачи всегда воспроизводим.

// PGlite раздаётся с нашего домена (см. scripts/copy-sandbox-assets.mjs).
// Грузим нативным dynamic import с webpackIgnore, чтобы 13 МБ WASM-ассетов
// не попали в бандл Next.js и подтягивались только при открытии песочницы.
const PGLITE_URL = "/sandbox/pglite/index.js";

export interface SqlResultSet {
  columns: string[];
  rows: string[][];
}

export interface SqlRunResult {
  ok: boolean;
  /** Результаты SELECT-запросов (последний — главный для проверки). */
  results: SqlResultSet[];
  /** Сообщение для команд без результата (INSERT/UPDATE/DELETE). */
  notice?: string;
  error?: string;
}

interface PgResult {
  rows: Record<string, unknown>[];
  fields: Array<{ name: string }>;
  affectedRows?: number;
}

interface PGliteInstance {
  exec: (sql: string) => Promise<PgResult[]>;
}

let dbPromise: Promise<PGliteInstance> | null = null;
/** Последовательная очередь: PGlite — один инстанс, параллельные запуски запрещены. */
let queue: Promise<unknown> = Promise.resolve();

function getDb(): Promise<PGliteInstance> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const mod = (await import(/* webpackIgnore: true */ PGLITE_URL)) as {
        PGlite: new (dataDir?: string) => PGliteInstance;
      };
      return new mod.PGlite();
    })();
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Прогреть PostgreSQL заранее (вызывать при открытии страницы с задачей). */
export function warmupSql(): void {
  if (typeof window !== "undefined") void getDb().catch(() => {});
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function toResultSets(raw: PgResult[]): { results: SqlResultSet[]; notice?: string } {
  const results: SqlResultSet[] = [];
  let notice: string | undefined;
  for (const r of raw) {
    if (r.fields && r.fields.length > 0) {
      const columns = r.fields.map((f) => f.name);
      const rows = (r.rows || []).map((row) => columns.map((c) => formatValue(row[c])));
      results.push({ columns, rows });
    } else if (typeof r.affectedRows === "number") {
      notice = `Готово. Затронуто строк: ${r.affectedRows}`;
    }
  }
  return { results, notice };
}

/**
 * Выполнить SQL ученика в чистой базе, предварительно применив seedSql.
 * Запуски сериализуются, поэтому две задачи не мешают друг другу.
 */
export function runSql(seedSql: string, userSql: string): Promise<SqlRunResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, results: [], error: "Песочница доступна только в браузере" });
  }

  const task = queue.then(async (): Promise<SqlRunResult> => {
    let db: PGliteInstance;
    try {
      db = await getDb();
      // Полный сброс: схема пересоздаётся, все таблицы прошлого запуска исчезают.
      await db.exec("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
      if (seedSql.trim()) await db.exec(seedSql);
    } catch (e) {
      return {
        ok: false,
        results: [],
        error:
          "Не удалось запустить PostgreSQL. Проверь интернет и обнови страницу. (" +
          String(e).slice(0, 160) +
          ")",
      };
    }

    try {
      const raw = await db.exec(userSql);
      const { results, notice } = toResultSets(raw);
      return { ok: true, results, notice };
    } catch (e) {
      return { ok: false, results: [], error: String(e instanceof Error ? e.message : e) };
    }
  });

  // Очередь не должна «залипать» из-за упавшей задачи.
  queue = task.catch(() => undefined);
  return task;
}

/** Сравнение результата с ожидаемым (значения — строками). */
export function rowsEqual(actual: string[][], expected: string[][], orderMatters: boolean): boolean {
  if (actual.length !== expected.length) return false;
  const norm = (rows: string[][]) => rows.map((r) => r.map((c) => c.trim()).join(""));
  const a = norm(actual);
  const b = norm(expected);
  if (orderMatters) return a.every((row, i) => row === b[i]);
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((row, i) => row === sortedB[i]);
}
