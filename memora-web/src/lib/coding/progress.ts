"use client";

// Прогресс раздела «Программирование»: XP, уровни, бейджи, выполненные задания.
// Хранится в localStorage браузера — ничего не уходит на сервер.
// Читается через useSyncExternalStore, поэтому все виджеты на странице
// (счётчик XP в шапке, прогресс-бары) обновляются одновременно.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "memora-coding-progress-v1";
const EVENT = "memora-coding-progress";

export interface CodingProgress {
  xp: number;
  /** id выполненных заданий и викторин: `${trackId}/${lessonId}/${blockId}` */
  done: string[];
  /** id полученных наград */
  badges: string[];
}

const EMPTY: CodingProgress = { xp: 0, done: [], badges: [] };

export interface LevelInfo {
  level: number;
  title: string;
  minXp: number;
  emoji: string;
}

// Пороги растянуты на суммарный опыт всех треков (~2385 XP при полном
// прохождении Python + SQL + аналитики данных + ООП), чтобы верхний уровень
// оставался стоящей целью, а не открывался на середине первого трека.
export const LEVELS: LevelInfo[] = [
  { level: 1, title: "Новичок", minXp: 0, emoji: "🥚" },
  { level: 2, title: "Искатель", minXp: 100, emoji: "🐣" },
  { level: 3, title: "Ученик мага", minXp: 250, emoji: "🧙" },
  { level: 4, title: "Кодовый рыцарь", minXp: 450, emoji: "⚔️" },
  { level: 5, title: "Мастер данных", minXp: 700, emoji: "🏆" },
  { level: 6, title: "Аналитик-виртуоз", minXp: 1000, emoji: "📊" },
  { level: 7, title: "Архитектор классов", minXp: 1300, emoji: "🏛️" },
  { level: 8, title: "Гуру алгоритмов", minXp: 1600, emoji: "🦉" },
  { level: 9, title: "Легенда кода", minXp: 1900, emoji: "🐉" },
  { level: 10, title: "Повелитель кода", minXp: 2200, emoji: "🔥" },
  { level: 11, title: "Легенда курса Memora", minXp: 2350, emoji: "👑" },
];

export function levelForXp(xp: number): { current: LevelInfo; next: LevelInfo | null } {
  let current: LevelInfo = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.minXp) current = l;
  const next = LEVELS.find((l) => l.minXp > xp) ?? null;
  return { current, next };
}

export function blockKey(trackId: string, lessonId: string, blockId: string): string {
  return `${trackId}/${lessonId}/${blockId}`;
}

// ── Внешнее хранилище ────────────────────────────────────────────────────────

// Кэш нужен, чтобы getSnapshot возвращал стабильную ссылку: иначе React
// уйдёт в бесконечный цикл перерисовок.
let cachedRaw: string | null = null;
let cachedValue: CodingProgress = EMPTY;

function parse(raw: string | null): CodingProgress {
  if (!raw) return EMPTY;
  try {
    const p = JSON.parse(raw) as Partial<CodingProgress>;
    return {
      xp: typeof p.xp === "number" ? p.xp : 0,
      done: Array.isArray(p.done) ? p.done : [],
      badges: Array.isArray(p.badges) ? p.badges : [],
    };
  } catch {
    return EMPTY;
  }
}

function read(): CodingProgress {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY; // приватный режим и т.п.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

function write(p: CodingProgress): void {
  try {
    const raw = JSON.stringify(p);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cachedRaw = raw;
    cachedValue = p;
  } catch {
    // Записать не удалось — прогресс останется только в памяти страницы.
    cachedRaw = null;
    cachedValue = p;
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const serverSnapshot = (): CodingProgress => EMPTY;
const clientReady = () => true;
const serverReady = () => false;

// ── Хук ──────────────────────────────────────────────────────────────────────

export function useCodingProgress() {
  const progress = useSyncExternalStore(subscribe, read, serverSnapshot);
  // false во время серверного рендера и гидрации, true после — чтобы виджеты
  // не «мигали» нулями и не ломали гидрацию.
  const ready = useSyncExternalStore(subscribe, clientReady, serverReady);

  /** Засчитать задание. XP начисляется только в первый раз. */
  const completeBlock = useCallback(
    (trackId: string, lessonId: string, blockId: string, xp: number): boolean => {
      const key = blockKey(trackId, lessonId, blockId);
      const p = read();
      if (p.done.includes(key)) return false;
      write({ ...p, xp: p.xp + xp, done: [...p.done, key] });
      return true;
    },
    []
  );

  /** Выдать награду. Возвращает true, если награда новая. */
  const awardBadge = useCallback((badgeId: string): boolean => {
    const p = read();
    if (p.badges.includes(badgeId)) return false;
    write({ ...p, badges: [...p.badges, badgeId] });
    return true;
  }, []);

  const resetAll = useCallback(() => write(EMPTY), []);

  return { progress, ready, completeBlock, awardBadge, resetAll };
}
