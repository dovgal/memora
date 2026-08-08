#!/usr/bin/env node
/**
 * Копирует ассеты песочниц раздela «Программирование» из node_modules в public/.
 *
 * Зачем: Pyodide (CPython → WASM) и PGlite (PostgreSQL → WASM) исполняются
 * в браузере ученика. Мы раздаём их со своего домена, а не с CDN, потому что:
 *   • работает в офлайне и за корпоративными фаерволами (Memora — PWA);
 *   • не зависит от доступности сторонних CDN и не утекает трафик учеников;
 *   • версия зафиксирована в package.json, а не в строке URL.
 *
 * Файлы НЕ коммитятся в git (см. .gitignore) — скрипт запускается автоматически
 * перед `next dev` и `next build` (хуки predev/prebuild в package.json).
 */

import { cp, mkdir, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "sandbox");

// Pyodide: минимальный набор для чистого Python без сторонних пакетов.
const PYODIDE_FILES = [
  "pyodide.js",
  "pyodide.asm.js",
  "pyodide.asm.wasm",
  "pyodide-lock.json",
  "python_stdlib.zip",
];

// PGlite: ESM-бандл + чанки + WASM-образ Postgres. Архивы расширений
// (*.tar.gz) не нужны — базовый Postgres их не требует.
const PGLITE_FILES = ["index.js", "postgres.wasm", "postgres.data"];
const PGLITE_CHUNK_RE = /^chunk-.*\.js$/;

async function copyFiles(srcDir, destDir, files, label) {
  if (!existsSync(srcDir)) {
    throw new Error(
      `Не найден каталог ${label}: ${srcDir}. Запусти "npm install" перед сборкой.`
    );
  }
  await mkdir(destDir, { recursive: true });
  let bytes = 0;
  for (const f of files) {
    const src = path.join(srcDir, f);
    if (!existsSync(src)) {
      throw new Error(`Отсутствует файл ${label}: ${f}. Проверь версию пакета в package.json.`);
    }
    await cp(src, path.join(destDir, f));
    bytes += (await stat(src)).size;
  }
  console.log(`  ${label}: ${files.length} файлов, ${(bytes / 1024 / 1024).toFixed(1)} МБ`);
}

console.log("Копирую ассеты песочниц (Pyodide + PGlite) в public/sandbox …");

const pyodideSrc = path.join(root, "node_modules", "pyodide");
await copyFiles(pyodideSrc, path.join(outDir, "pyodide"), PYODIDE_FILES, "pyodide");

const pgliteSrc = path.join(root, "node_modules", "@electric-sql", "pglite", "dist");
const chunks = (await readdir(pgliteSrc)).filter((f) => PGLITE_CHUNK_RE.test(f));
await copyFiles(pgliteSrc, path.join(outDir, "pglite"), [...PGLITE_FILES, ...chunks], "pglite");

console.log("Готово.");
