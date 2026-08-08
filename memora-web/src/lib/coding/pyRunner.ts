"use client";

// Запуск Python-кода в браузере через Pyodide (CPython → WebAssembly).
// Код исполняется в Web Worker, поэтому вечный цикл `while True:` не вешает
// страницу — по таймауту воркер просто убивается и создаётся заново.

// Pyodide раздаётся с нашего домена (см. scripts/copy-sandbox-assets.mjs),
// поэтому песочница работает офлайн и не зависит от сторонних CDN.
const PYODIDE_BASE = "/sandbox/pyodide/";

export interface PyRunResult {
  ok: boolean;
  output: string;
  error?: string;
  timedOut?: boolean;
}

const WORKER_SOURCE = `
importScripts(BASE + "pyodide.js");

let pyodideReady = loadPyodide({ indexURL: BASE });

self.onmessage = async (e) => {
  const { code } = e.data;
  let out = [];
  try {
    const pyodide = await pyodideReady;
    pyodide.setStdout({ batched: (s) => out.push(s) });
    pyodide.setStderr({ batched: (s) => out.push(s) });
    // Каждый запуск — в чистом пространстве имён, чтобы задачи не влияли друг на друга.
    const ns = pyodide.globals.get("dict")();
    try {
      await pyodide.runPythonAsync(code, { globals: ns });
      self.postMessage({ ok: true, output: out.join("\\n") });
    } finally {
      ns.destroy();
    }
  } catch (err) {
    // Показываем только питоновскую часть traceback — детям он понятнее.
    let msg = String(err && err.message ? err.message : err);
    const lines = msg.split("\\n").filter(Boolean);
    const short = lines.slice(-3).join("\\n");
    self.postMessage({ ok: false, output: out.join("\\n"), error: short });
  }
};

// Сообщаем главному потоку, что Pyodide загрузился (для индикатора).
pyodideReady.then(() => self.postMessage({ ready: true })).catch((e) => {
  self.postMessage({ loadError: String(e) });
});
`;

let worker: Worker | null = null;
let workerReady: Promise<void> | null = null;
let busy = false;

function createWorker(): { w: Worker; ready: Promise<void> } {
  // Воркер создаётся из blob, поэтому относительные пути в нём не работают:
  // базовый URL считаем на главном потоке и передаём готовой константой.
  const base = new URL(PYODIDE_BASE, window.location.origin).href;
  const source = `const BASE = ${JSON.stringify(base)};\n${WORKER_SOURCE}`;
  const blob = new Blob([source], { type: "application/javascript" });
  const w = new Worker(URL.createObjectURL(blob));
  const ready = new Promise<void>((resolve, reject) => {
    const onMsg = (e: MessageEvent) => {
      if (e.data && e.data.ready) {
        w.removeEventListener("message", onMsg);
        resolve();
      } else if (e.data && e.data.loadError) {
        w.removeEventListener("message", onMsg);
        reject(new Error(e.data.loadError));
      }
    };
    w.addEventListener("message", onMsg);
  });
  return { w, ready };
}

/** Прогреть Pyodide заранее (вызвать при открытии урока). */
export function warmupPython(): void {
  if (typeof window === "undefined") return;
  if (!worker) {
    const { w, ready } = createWorker();
    worker = w;
    workerReady = ready.catch(() => {
      worker = null;
      workerReady = null;
    }) as Promise<void>;
  }
}

/** Выполнить код. timeoutMs — защита от вечных циклов. */
export async function runPython(code: string, timeoutMs = 15000): Promise<PyRunResult> {
  if (typeof window === "undefined") {
    return { ok: false, output: "", error: "Песочница доступна только в браузере" };
  }
  if (busy) {
    return { ok: false, output: "", error: "Подожди, предыдущий запуск ещё выполняется…" };
  }
  warmupPython();
  if (!worker || !workerReady) {
    return { ok: false, output: "", error: "Не удалось загрузить Python. Проверь интернет и обнови страницу." };
  }
  busy = true;
  try {
    await workerReady;
  } catch {
    busy = false;
    worker = null;
    workerReady = null;
    return { ok: false, output: "", error: "Не удалось загрузить Python. Проверь интернет и обнови страницу." };
  }

  const w = worker;
  return new Promise<PyRunResult>((resolve) => {
    const timer = window.setTimeout(() => {
      // Вечный цикл: убиваем воркер, пересоздаём для следующего запуска.
      w.terminate();
      worker = null;
      workerReady = null;
      busy = false;
      warmupPython();
      resolve({
        ok: false,
        output: "",
        timedOut: true,
        error: "⏰ Программа выполнялась слишком долго. Возможно, в ней бесконечный цикл?",
      });
    }, timeoutMs);

    const onMsg = (e: MessageEvent) => {
      if (e.data && (e.data.ready || e.data.loadError)) return; // служебные сообщения
      window.clearTimeout(timer);
      w.removeEventListener("message", onMsg);
      busy = false;
      resolve(e.data as PyRunResult);
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ code });
  });
}
