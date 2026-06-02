// «Pro»-модули курса A2: FSRS-планировщик (диктанты/аудио), история письма,
// недельные цели, таблица лидеров, генерация вопросов через Ollama, PDF-отчёт.
// Состояние — в localStorage (клиентское), генерация и проверка — через существующие API.

import { A2Question } from "./frenchA2";

// ════════════════════════════════════════════════════════════
// 1) ГЕНЕРАЦИЯ ВОПРОСОВ ЧЕРЕЗ OLLAMA
// ════════════════════════════════════════════════════════════
interface RawGenerated {
  topic: string;
  type: "mc" | "text";
  prompt: string;
  options?: string[] | null;
  answer_index?: number | null;
  accept?: string[] | null;
  speak: string;
  explanation: string;
}

let genCounter = 90000; // id-пространство для сгенерированных вопросов

export async function generateQuestions(topics: string[], count: number, idToken?: string): Promise<A2Question[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;
  const res = await fetch("/api/ai/a2/generate-questions", {
    method: "POST", headers,
    body: JSON.stringify({ topics, count }),
  });
  if (!res.ok) throw new Error(`generate failed: ${res.status}`);
  const raw = await res.json() as RawGenerated[];
  return raw
    .filter((r) => r && r.prompt && (r.type === "mc" || r.type === "text"))
    .map((r) => {
      const q: A2Question = {
        id: genCounter++,
        unit: 0,
        skill: "grammar",
        grammarPoint: r.topic || "ИИ",
        type: r.type,
        prompt: r.prompt,
        speak: r.speak || r.prompt,
        explanation: r.explanation || "",
      };
      if (r.type === "mc" && Array.isArray(r.options)) {
        q.options = r.options;
        q.answerIndex = typeof r.answer_index === "number" ? r.answer_index : 0;
      } else {
        q.accept = Array.isArray(r.accept) && r.accept.length ? r.accept : [r.speak];
      }
      return q;
    });
}

// ════════════════════════════════════════════════════════════
// 2) FSRS-ПЛАНИРОВЩИК (упрощённый SM-2) для диктантов и аудирования
// ════════════════════════════════════════════════════════════
export interface SrsCard {
  key: string;        // уникальный ключ задания
  ease: number;       // фактор лёгкости (старт 2.5)
  interval: number;   // дни до следующего показа
  due: number;        // timestamp следующего показа
  reps: number;
  lapses: number;
}

type SrsStore = Record<string, SrsCard>;
const SRS_KEY = "memora_a2_srs";

function loadSrs(): SrsStore {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(SRS_KEY) || "{}"); } catch { return {}; }
}
function saveSrs(s: SrsStore) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(SRS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function getSrsCard(key: string): SrsCard {
  const store = loadSrs();
  return store[key] || { key, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
}

/** rating: "again" | "hard" | "good" | "easy" — обновляет интервал (SM-2). */
export function reviewSrs(key: string, rating: "again" | "hard" | "good" | "easy"): SrsCard {
  const store = loadSrs();
  const c = store[key] || { key, ease: 2.5, interval: 0, due: 0, reps: 0, lapses: 0 };
  const DAY = 86400000;
  if (rating === "again") {
    c.lapses++; c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = Date.now() + 10 * 60 * 1000; // через 10 минут
  } else {
    c.reps++;
    if (rating === "hard") c.ease = Math.max(1.3, c.ease - 0.15);
    if (rating === "easy") c.ease = c.ease + 0.15;
    if (c.reps === 1) c.interval = rating === "easy" ? 2 : 1;
    else if (c.reps === 2) c.interval = rating === "easy" ? 5 : 3;
    else c.interval = Math.round(c.interval * c.ease * (rating === "hard" ? 0.7 : 1));
    c.due = Date.now() + c.interval * DAY;
  }
  store[key] = c; saveSrs(store);
  return c;
}

export function isDue(key: string): boolean {
  const c = loadSrs()[key];
  return !c || c.due <= Date.now();
}
export function dueCount(keys: string[]): number {
  return keys.filter(isDue).length;
}

// ════════════════════════════════════════════════════════════
// 3) ИСТОРИЯ ПОПЫТОК ПИСЬМА
// ════════════════════════════════════════════════════════════
export interface WritingAttempt {
  taskId: number;
  taskTitle: string;
  date: string;       // ISO
  words: number;
  passed: boolean;
  excerpt: string;    // первые ~120 символов
}
const WRITING_KEY = "memora_a2_writing_history";

export function loadWritingHistory(): WritingAttempt[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(WRITING_KEY) || "[]"); } catch { return []; }
}
export function addWritingAttempt(a: WritingAttempt) {
  if (typeof window === "undefined") return;
  const list = loadWritingHistory();
  list.unshift(a);
  try { localStorage.setItem(WRITING_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* ignore */ }
}

// ════════════════════════════════════════════════════════════
// 4) НЕДЕЛЬНЫЕ ЦЕЛИ
// ════════════════════════════════════════════════════════════
export interface WeeklyGoal {
  weekKey: string;    // год-неделя
  targetXp: number;
  startXp: number;    // XP на момент старта недели
}
const GOAL_KEY = "memora_a2_weekly_goal";

function weekKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

export function getWeeklyGoal(currentXp: number, defaultTarget = 150): WeeklyGoal {
  const wk = weekKey();
  let g: WeeklyGoal | null = null;
  if (typeof window !== "undefined") {
    try { g = JSON.parse(localStorage.getItem(GOAL_KEY) || "null"); } catch { g = null; }
  }
  if (!g || g.weekKey !== wk) {
    g = { weekKey: wk, targetXp: g?.targetXp || defaultTarget, startXp: currentXp };
    if (typeof window !== "undefined") { try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)); } catch { /* ignore */ } }
  }
  return g;
}
export function setWeeklyTarget(target: number, currentXp: number): WeeklyGoal {
  const wk = weekKey();
  const g: WeeklyGoal = { weekKey: wk, targetXp: target, startXp: getWeeklyGoal(currentXp).startXp };
  if (typeof window !== "undefined") { try { localStorage.setItem(GOAL_KEY, JSON.stringify(g)); } catch { /* ignore */ } }
  return g;
}

// ════════════════════════════════════════════════════════════
// 5) ТАБЛИЦА ЛИДЕРОВ (демо: ученик + сгенерированные «одноклассники»)
// ════════════════════════════════════════════════════════════
export interface LeaderRow { name: string; xp: number; me?: boolean; }

const CLASSMATES = ["Sophie", "Lucas", "Emma", "Hugo", "Léa", "Nathan", "Chloé", "Tom", "Manon", "Louis"];

export function getLeaderboard(myName: string, myXp: number): LeaderRow[] {
  // Детерминированные «одноклассники» (стабильны в рамках сессии по дню).
  const seed = new Date().getDate();
  const rows: LeaderRow[] = CLASSMATES.map((name, i) => ({
    name,
    xp: Math.max(0, 60 + ((seed * 7 + i * 53) % 240)),
  }));
  rows.push({ name: myName || "Вы", xp: myXp, me: true });
  return rows.sort((a, b) => b.xp - a.xp);
}

// ════════════════════════════════════════════════════════════
// 6) PDF-ОТЧЁТ ДИАГНОСТИКИ (печать через окно браузера → Сохранить как PDF)
// ════════════════════════════════════════════════════════════
export interface DiagReport {
  studentName: string;
  date: string;
  scorePercent: number;
  rightCount: number;
  total: number;
  bySkill: { label: string; r: number; t: number; p: number }[];
  byUnit: { unit: number; title: string; r: number; t: number; p: number }[];
  weakTopics: string[];
}

export function openDiagnosticPdf(rep: DiagReport) {
  if (typeof window === "undefined") return;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] || c));
  const skillRows = rep.bySkill.map((s) => `<tr><td>${esc(s.label)}</td><td>${s.r}/${s.t}</td><td>${s.p}%</td></tr>`).join("");
  const unitRows = rep.byUnit.map((u) => `<tr><td>U${u.unit}. ${esc(u.title)}</td><td>${u.r}/${u.t}</td><td>${u.p}%</td></tr>`).join("");
  const weak = rep.weakTopics.length ? rep.weakTopics.map(esc).join(", ") : "нет — все темы выше порога";
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Отчёт диагностики A2</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1a1d28;padding:32px;max-width:800px;margin:0 auto}
    h1{color:#2e5496;margin-bottom:4px} .muted{color:#666;font-size:14px}
    .score{font-size:42px;font-weight:bold;color:#2e5496;margin:16px 0}
    table{width:100%;border-collapse:collapse;margin:12px 0}
    th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:14px}
    th{background:#eef2fa} h2{color:#2e5496;font-size:18px;margin-top:24px}
    .weak{background:#fbe9e8;border-left:4px solid #c5352f;padding:10px;border-radius:4px}
    @media print{button{display:none}}
  </style></head><body>
  <h1>Отчёт диагностики · Французский A2</h1>
  <div class="muted">Ученик: ${esc(rep.studentName || "—")} · Дата: ${esc(rep.date)}</div>
  <div class="score">${rep.scorePercent}% <span style="font-size:18px;color:#666">(${rep.rightCount} из ${rep.total})</span></div>
  <h2>По навыкам</h2>
  <table><tr><th>Навык</th><th>Верно</th><th>%</th></tr>${skillRows}</table>
  <h2>По юнитам (Édito A2)</h2>
  <table><tr><th>Юнит</th><th>Верно</th><th>%</th></tr>${unitRows}</table>
  <h2>Рекомендации преподавателю</h2>
  <div class="weak"><b>Слабые темы (&lt;70%):</b> ${weak}.</div>
  <p class="muted" style="margin-top:24px">Сгенерировано Memora · курс «Французский A2».</p>
  <button onclick="window.print()" style="margin-top:16px;padding:10px 20px;background:#2e5496;color:#fff;border:0;border-radius:8px;cursor:pointer">Печать / Сохранить в PDF</button>
  </body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}
