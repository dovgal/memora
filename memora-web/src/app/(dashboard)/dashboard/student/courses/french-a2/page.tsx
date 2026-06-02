"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Volume2, Mic, Shuffle, CheckCircle2, XCircle, Loader2,
  ChevronLeft, Sparkles, ArrowRight, BookOpen, Headphones, MessageCircle,
  GraduationCap, Brain, RefreshCw, Trophy, Flame, Zap, Target, Award, Clock,
  MessagesSquare, Quote, PenLine, FileDown, Link2, History, Users, Wand2,
} from "lucide-react";
import {
  A2_UNITS, A2_SKILL_LABELS, normalizeA2,
  A2Question, A2Skill, A2VocabCard,
} from "@/lib/courses/frenchA2";
import {
  Tense, TENSE_LABELS, generateConjugation, checkConjugation, ConjugationItem,
  A2_DIALOGUES, A2_DICTATIONS, mistakeOfTheDay, VOCAB_EMOJI, buildExam,
  loadGamification, addXp, awardBadge, setWeakUnits, levelFromXp, Gamification,
  A2_FULL_POOL,
} from "@/lib/courses/frenchA2Extra";
import {
  A2_PHRASES, phraseCategories, PHRASE_TEST, phraseCardUuid,
  A2_HARD_DICTATIONS, A2_DIALOGUES_EXTRA,
} from "@/lib/courses/frenchA2Phrases";
import {
  A2_WRITING_TASKS, buildWritingGradePrompt, countWords, WRITING_TYPE_LABELS, WritingTask,
} from "@/lib/courses/frenchA2Writing";
import { speakInworld, speakCardInworld } from "@/lib/courses/ttsInworld";
import {
  generateQuestions, reviewSrs, isDue, dueCount,
  loadWritingHistory, addWritingAttempt, WritingAttempt,
  getWeeklyGoal, setWeeklyTarget, getLeaderboard,
  openDiagnosticPdf, DiagReport,
  catInit, catNext, catUpdate, catScore, questionDifficulty,
} from "@/lib/courses/frenchA2Pro";
import {
  joinClass, classLeaderboard, submitXp, submitDiagnostic, reportErrorStat, myAssignments,
} from "@/lib/courses/frenchA2Api";
import { downloadForOffline, isOfflineReady, offlineSupported } from "@/lib/courses/frenchA2Offline";
import { Download } from "lucide-react";

type Status = "right" | "wrong";
interface AnswerState { status: Status; given: string; explanation: string; aiChecked?: boolean; }
const LETTERS = ["A", "B", "C", "D"];

// Озвучка ТОЛЬКО через Inworld (см. lib/courses/ttsInworld).
function browserSpeak(text: string) { void speakInworld(text); }
function vocabCardUuid(index: number): string {
  return `a2c0a2c0-0000-4a2c-8a2c-${index.toString(16).padStart(12, "0")}`;
}
async function speakServerOrBrowser(uuid: string, fallback: string) { await speakCardInworld(uuid, fallback); }
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) { const t = dp[j]; dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]); prev = t; }
  }
  return Math.max(0, 1 - dp[n] / Math.max(m, n, 1));
}
async function aiGrade(session: ReturnType<typeof useSession>["data"], question: string, expected: string, user: string): Promise<{ ok: boolean; explanation: string; correct: string } | null> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.id_token) headers["Authorization"] = `Bearer ${session.id_token}`;
    const res = await fetch("/api/ai/learn/grade", {
      method: "POST", headers,
      body: JSON.stringify({ setId: "00000000-0000-0000-0000-000000000000", cardId: "00000000-0000-0000-0000-000000000000", questionType: "translation", userAnswer: user, questionText: `${question}\nЭталон: ${expected}` }),
    });
    if (!res.ok) return null;
    const g = await res.json() as { isCorrect: boolean; explanation: string; correctAnswer: string };
    return { ok: g.isCorrect, explanation: g.explanation, correct: g.correctAnswer };
  } catch { return null; }
}

type Tab = "diagnostic" | "path" | "grammar" | "conjug" | "vocab" | "phrases" | "listening" | "dictation" | "dialogue" | "speaking" | "writing" | "exam" | "progress";

export default function FrenchA2CoursePage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("diagnostic");
  const [game, setGame] = useState<Gamification | null>(null);
  // читаем геймификацию из localStorage на клиенте при смене вкладки (без setState в effect-теле напрямую)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGame(loadGamification()));
    return () => cancelAnimationFrame(id);
  }, [tab]);

  const lvl = game ? levelFromXp(game.xp) : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/student" className="p-2 rounded-lg hover:bg-qz-card text-qz-text-muted"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Французский язык — уровень A2</h1>
            <p className="text-qz-text-muted text-sm">Édito A2 · 12 юнитов · диагностика, тренажёры, экзамен</p>
          </div>
        </div>

        {/* Геймификация */}
        {game && lvl && (
          <div className="bg-qz-card border border-border rounded-2xl px-4 py-3 space-y-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5"><Trophy className="w-5 h-5 text-[#ffcd1f]" /><span className="font-semibold text-sm">Ур. {lvl.level} · {lvl.title}</span></div>
              <div className="flex items-center gap-1.5"><Zap className="w-5 h-5 text-[#4255ff]" /><span className="text-sm">{game.xp} XP</span></div>
              <div className="flex items-center gap-1.5"><Flame className={`w-5 h-5 ${game.streak > 0 ? "text-orange-500" : "text-qz-text-muted"}`} /><span className="text-sm">{game.streak} дн. подряд</span></div>
              {game.badges.length > 0 && <div className="flex items-center gap-1 ml-auto"><Award className="w-4 h-4 text-emerald-500" /><span className="text-sm">{game.badges.length} бейджей</span></div>}
            </div>
            {/* Единый «энергобар» прогресса к B1 */}
            {(() => {
              const B1_GOAL = 2000;
              const pct = Math.min(100, Math.round((game.xp / B1_GOAL) * 100));
              return (
                <div>
                  <div className="flex justify-between text-xs text-qz-text-muted mb-1">
                    <span>Прогресс к B1 (грамматика · лексика · письмо · говорение · аудирование)</span>
                    <span>{game.xp} / {B1_GOAL} XP · {pct}%</span>
                  </div>
                  <div className="h-3 bg-background rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#4255ff] via-emerald-500 to-[#ffcd1f] transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {pct >= 100 && <div className="text-emerald-600 text-xs font-semibold mt-1">🎉 Вы накопили XP уровня A2→B1! Готовы двигаться к B1.</div>}
                </div>
              );
            })()}
          </div>
        )}

        <MistakeOfDay />

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            ["diagnostic", "Диагностика", GraduationCap],
            ["path", "Мой план", Target],
            ["grammar", "Грамматика", Brain],
            ["conjug", "Спряжения", RefreshCw],
            ["vocab", "Лексика", BookOpen],
            ["phrases", "Фразы", Quote],
            ["listening", "Аудирование", Headphones],
            ["dictation", "Диктанты", Headphones],
            ["dialogue", "Диалоги", MessagesSquare],
            ["speaking", "Говорение", Mic],
            ["writing", "Письмо", PenLine],
            ["exam", "Экзамен DELF", Award],
            ["progress", "Прогресс", Users],
          ] as [Tab, string, typeof Brain][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${tab === t ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted hover:bg-qz-card"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "diagnostic" && <DiagnosticTest session={session} onDone={(weak) => { setWeakUnits(weak); setGame(loadGamification()); }} />}
        {tab === "path" && <MyPath session={session} />}
        {tab === "grammar" && <GrammarTrainer />}
        {tab === "conjug" && <ConjugationTrainer session={session} />}
        {tab === "vocab" && <VocabTrainer />}
        {tab === "phrases" && <PhraseTrainer session={session} />}
        {tab === "listening" && <SkillTrainer session={session} skill="listening" title="Тренажёр аудирования" hint="Нажмите 🔊, послушайте и ответьте." />}
        {tab === "dictation" && <DictationTrainer session={session} />}
        {tab === "dialogue" && <DialogueTrainer />}
        {tab === "speaking" && <SkillTrainer session={session} skill="speaking" title="Тренажёр говорения" hint="Нажмите 🎙, произнесите фразу — оценим произношение." />}
        {tab === "writing" && <WritingTrainer session={session} />}
        {tab === "exam" && <ExamMode session={session} />}
        {tab === "progress" && <ProgressTab />}
      </div>
    </div>
  );
}

// ───────── Ошибка дня ─────────
function MistakeOfDay() {
  const m = useMemo(() => mistakeOfTheDay(), []);
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4">
      <div className="flex justify-between items-start gap-2">
        <div className="text-sm">
          <div className="font-bold text-amber-600 mb-1">⚡ Ошибка дня</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="line-through text-red-500">{m.wrong}</span>
            <ArrowRight className="w-4 h-4 text-qz-text-muted" />
            <span className="text-green-600 font-semibold">{m.right}</span>
            <button onClick={() => browserSpeak(m.right)} className="text-[#4255ff]"><Volume2 className="w-4 h-4" /></button>
          </div>
          <div className="text-qz-text-muted mt-1">{m.why}</div>
        </div>
        <button onClick={() => setOpen(false)} className="text-qz-text-muted text-xs">✕</button>
      </div>
    </div>
  );
}

// ───────── Диагностика ─────────
function DiagnosticTest({ session, onDone }: { session: ReturnType<typeof useSession>["data"]; onDone: (weakUnits: number[]) => void }) {
  const [order, setOrder] = useState<number[]>(() => A2_FULL_POOL.map((_, i) => i));
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [pron, setPron] = useState<Record<number, { ok: boolean; heard: string; score: number }>>({});
  const [recId, setRecId] = useState<number | null>(null);
  const [studentName, setStudentName] = useState("");

  const questions = useMemo(() => order.map((i) => A2_FULL_POOL[i]), [order]);
  const total = A2_FULL_POOL.length;
  const answered = Object.keys(answers).length;
  const right = Object.values(answers).filter((a) => a.status === "right").length;

  const record = useCallback((q: A2Question, status: Status, given: string, expl: string, ai = false) => {
    setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));
    // аналитика ошибок по грам.точкам (агрегируется на сервере)
    void reportErrorStat(q.grammarPoint, status === "right", session?.id_token);
  }, [session]);
  const checkText = (q: A2Question, v: string) => (q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v));

  const handleText = async (q: A2Question) => {
    if (answers[q.id]) return;
    const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if (checkText(q, v)) { record(q, "right", v, q.explanation); addXp(5); return; }
    setGradingId(q.id);
    const g = await aiGrade(session, q.prompt, q.accept?.[0] ?? "", v);
    if (g) { record(q, g.ok ? "right" : "wrong", v, `${g.explanation || q.explanation}${g.correct ? ` (Правильно: ${g.correct})` : ""}`, true); if (g.ok) addXp(5); }
    else record(q, "wrong", v, q.explanation);
    setGradingId(null);
  };
  const handleMc = (q: A2Question, idx: number) => { if (answers[q.id]) return; const ok = idx === q.answerIndex; record(q, ok ? "right" : "wrong", q.options![idx], q.explanation); if (ok) addXp(5); };

  const pronounce = async (q: A2Question) => {
    const target = q.speak || ""; if (!target) return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert("Распознавание речи доступно в Chrome/Edge."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Rec as any)(); rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1; setRecId(q.id);
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => { const heard = e.results[0][0].transcript; const score = similarity(normalizeA2(heard), normalizeA2(target)); setPron((p) => ({ ...p, [q.id]: { ok: score >= 0.7, heard, score } })); setRecId(null); };
    rec.onerror = () => setRecId(null); rec.onend = () => setRecId(null); rec.start();
  };

  const reshuffle = () => { setOrder((p) => [...p].sort(() => Math.random() - 0.5)); setAnswers({}); setInputs({}); setPron({}); setShowResults(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const results = useMemo(() => {
    const byUnit: Record<number, { r: number; t: number }> = {};
    const bySkill: Record<string, { r: number; t: number }> = {};
    A2_FULL_POOL.forEach((q) => {
      byUnit[q.unit] = byUnit[q.unit] || { r: 0, t: 0 }; byUnit[q.unit].t++;
      bySkill[q.skill] = bySkill[q.skill] || { r: 0, t: 0 }; bySkill[q.skill].t++;
      if (answers[q.id]?.status === "right") { byUnit[q.unit].r++; bySkill[q.skill].r++; }
    });
    const units = Object.entries(byUnit).map(([u, v]) => ({ u: +u, ...v, p: Math.round(v.r / v.t * 100) })).sort((a, b) => a.u - b.u);
    const skills = Object.entries(bySkill).map(([s, v]) => ({ s: s as A2Skill, ...v, p: Math.round(v.r / v.t * 100) }));
    const weakUnits = units.filter((x) => x.p < 70).sort((a, b) => a.p - b.p);
    const wrong = A2_FULL_POOL.filter((q) => answers[q.id]?.status === "wrong");
    return { units, skills, weakUnits, wrong, p: Math.round(right / total * 100) };
  }, [answers, right, total]);

  const finish = () => {
    setShowResults(true);
    onDone(results.weakUnits.map((u) => u.u));
    if (results.p >= 70) awardBadge("diagnostic-pass");
    // отправляем результат на сервер (для кабинета преподавателя), без блокировки UI
    const bySkill: Record<string, { r: number; t: number }> = {};
    results.skills.forEach((s) => { bySkill[s.s] = { r: s.r, t: s.t }; });
    void submitDiagnostic({
      score_pct: results.p, right_count: right, total,
      weak_units: results.weakUnits.map((u) => u.u), by_skill: bySkill,
    }, session?.id_token);
    setTimeout(() => document.getElementById("a2-results")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const exportPdf = () => {
    const rep: DiagReport = {
      studentName,
      date: new Date().toLocaleDateString("ru-RU"),
      scorePercent: results.p,
      rightCount: right,
      total,
      bySkill: results.skills.map((s) => ({ label: A2_SKILL_LABELS[s.s], r: s.r, t: s.t, p: s.p })),
      byUnit: results.units.map((u) => ({ unit: u.u, title: A2_UNITS.find((x) => x.n === u.u)?.titleRu || "", r: u.r, t: u.t, p: u.p })),
      weakTopics: results.weakUnits.map((u) => `U${u.u} ${A2_UNITS.find((x) => x.n === u.u)?.titleRu || ""}`),
    };
    openDiagnosticPdf(rep);
  };

  return (
    <>
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Полный диагностический тест A2.</b> {total} заданий по 12 юнитам и 4 навыкам — для точного выявления любых пробелов. После завершения — разбор по юнитам, рекомендации и автосбор «Моего плана». Можно «Перемешать» и проходить частями.</div>
      <div className="sticky top-0 z-10 bg-background py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px] h-2.5 bg-qz-card rounded-full overflow-hidden"><div className="h-full bg-[#ffcd1f]" style={{ width: `${(answered / total) * 100}%` }} /></div>
        <span className="text-sm font-semibold whitespace-nowrap">{answered}/{total} · <span className="text-green-500">✔ {right}</span> · <span className="text-red-500">✗ {answered - right}</span></span>
        <button onClick={reshuffle} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-qz-card"><Shuffle className="w-4 h-4" /> Перемешать</button>
      </div>
      <div className="space-y-4 mt-2">
        {questions.map((q) => (
          <QuestionCard key={q.id} q={q} ans={answers[q.id]} input={inputs[q.id] ?? ""} grading={gradingId === q.id} pron={pron[q.id]} recording={recId === q.id}
            onInput={(v) => setInputs((p) => ({ ...p, [q.id]: v }))} onText={() => handleText(q)} onMc={(j) => handleMc(q, j)} onPron={() => pronounce(q)} />
        ))}
      </div>
      <div className="flex justify-center py-4"><button onClick={finish} className="px-6 py-3 rounded-xl bg-[#4255ff] text-white font-semibold flex items-center gap-2">Завершить диагностику <ArrowRight className="w-4 h-4" /></button></div>

      {showResults && (
        <div id="a2-results" className="bg-qz-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="w-28 h-28 rounded-full grid place-items-center shrink-0" style={{ background: `conic-gradient(#ffcd1f ${results.p}%, var(--qz-card-border,#e2e6ef) 0)` }}><span className="w-[88px] h-[88px] bg-background rounded-full grid place-items-center text-2xl font-bold">{results.p}%</span></div>
            <div><div className="text-xl font-bold">{right} из {total} верно</div><div className="text-qz-text-muted text-sm">{results.p >= 85 ? "Сильный A2 — почти готов к DELF A2!" : results.p >= 65 ? "Хороший A2, есть точечные пробелы." : results.p >= 45 ? "Базовый A2, нужна проработка." : "Рекомендуется системно пройти тренажёры."}</div></div>
          </div>
          <div className="flex items-center gap-2 flex-wrap bg-background rounded-xl p-3">
            <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Имя ученика (для отчёта)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-border bg-qz-card text-sm" />
            <button onClick={exportPdf} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#2e5496] text-white text-sm font-semibold"><FileDown className="w-4 h-4" /> Отчёт для преподавателя (PDF)</button>
          </div>
          <div><h3 className="font-semibold mb-2">По навыкам</h3><div className="grid grid-cols-2 gap-2">{results.skills.map((s) => (<div key={s.s} className="flex items-center gap-2 text-sm bg-background rounded-lg px-3 py-2"><span className="flex-1">{A2_SKILL_LABELS[s.s]}</span><span className="font-semibold">{s.r}/{s.t}</span><span className={`text-xs px-2 py-0.5 rounded-full ${s.p >= 70 ? "bg-green-500/15 text-green-500" : "bg-amber-500/15 text-amber-500"}`}>{s.p}%</span></div>))}</div></div>
          <div><h3 className="font-semibold mb-2">По юнитам</h3><div className="space-y-1.5">{results.units.map((u) => { const unit = A2_UNITS.find((x) => x.n === u.u); return (<div key={u.u} className="flex items-center gap-2.5 text-sm"><span className="w-44 shrink-0 truncate">U{u.u}. {unit?.titleRu}</span><span className="flex-1 h-2 bg-red-500/15 rounded-full overflow-hidden"><span className="block h-full bg-green-500" style={{ width: `${u.p}%` }} /></span><span className="w-10 text-right font-semibold">{u.r}/{u.t}</span></div>); })}</div></div>
          <div><h3 className="font-semibold mb-2">Рекомендации</h3><div className="bg-[#4255ff]/5 rounded-lg px-3 py-2 text-sm">{results.weakUnits.length === 0 ? "Пробелов почти нет — закрепляйте лексику и тренируйте говорение." : <>Слабые юниты: {results.weakUnits.map((u) => `U${u.u}`).join(", ")}. Откройте вкладку «Мой план» — задания собраны автоматически.</>}</div></div>
          {results.wrong.length > 0 && (<div><h3 className="font-semibold mb-2">Разбор ошибок ({results.wrong.length})</h3><div className="space-y-2.5">{results.wrong.map((q) => { const correct = q.type === "mc" ? q.options![q.answerIndex!] : q.accept![0]; return (<div key={q.id} className="border-t border-border pt-2.5 text-sm"><div className="font-semibold flex items-start gap-2"><XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span>U{q.unit} · {q.grammarPoint}: {q.prompt}</span></div><div className="ml-6 mt-1">Ваш ответ: <span className="text-red-500 line-through">{answers[q.id]?.given || "—"}</span> · <span className="text-green-500 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {correct}</span></div><div className="ml-6 mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2"><b className="text-[#4255ff]">Правило:</b> {answers[q.id]?.explanation}</div></div>); })}</div></div>)}
        </div>
      )}
    </>
  );
}

// Переиспользуемая карточка вопроса
function QuestionCard({ q, ans, input, grading, pron, recording, onInput, onText, onMc, onPron }: {
  q: A2Question; ans?: AnswerState; input: string; grading: boolean;
  pron?: { ok: boolean; heard: string; score: number }; recording: boolean;
  onInput: (v: string) => void; onText: () => void; onMc: (j: number) => void; onPron: () => void;
}) {
  return (
    <div className="bg-qz-card border border-border rounded-2xl p-5">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4255ff]/10 text-[#4255ff]">U{q.unit} · {A2_SKILL_LABELS[q.skill]} · {q.grammarPoint}</span>
        <span className="text-xs text-qz-text-muted font-semibold">№ {q.id}</span>
      </div>
      <div className="flex items-start gap-2 mb-3"><p className="text-lg flex-1">{q.prompt}</p><button onClick={() => browserSpeak(q.speak || q.prompt)} className="p-2 rounded-lg hover:bg-background text-[#4255ff]"><Volume2 className="w-5 h-5" /></button></div>
      {q.type === "mc" && (<div className="grid gap-2">{q.options!.map((opt, j) => { let cls = "border-border hover:border-[#4255ff]"; if (ans) { if (j === q.answerIndex) cls = "border-green-500 bg-green-500/10"; else if (opt === ans.given) cls = "border-red-500 bg-red-500/10"; else cls = "border-border opacity-70"; } return (<button key={j} disabled={!!ans} onClick={() => onMc(j)} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 text-left transition-colors ${cls}`}><span className="font-bold text-[#4255ff] w-5">{LETTERS[j]}</span><span>{opt}</span></button>); })}</div>)}
      {q.type === "text" && (<div className="flex gap-2 flex-wrap"><input type="text" disabled={!!ans} value={input} onChange={(e) => onInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") onText(); }} placeholder="Введите ответ…" className={`flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border-2 bg-background ${ans ? (ans.status === "right" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} /><button disabled={!!ans || grading} onClick={onText} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2">{grading ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}</button></div>)}
      {q.skill === "speaking" && (<div className="mt-3 flex items-center gap-2 flex-wrap"><button onClick={onPron} disabled={recording} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-background"><Mic className={`w-4 h-4 ${recording ? "text-red-500 animate-pulse" : ""}`} /> {recording ? "Говорите…" : "Произнести"}</button>{pron && <span className={`text-sm ${pron.ok ? "text-green-500" : "text-amber-500"}`}>{pron.ok ? "✔" : "≈"} «{pron.heard}» ({Math.round(pron.score * 100)}%)</span>}</div>)}
      {ans && (<div className="mt-3"><div className={`text-sm font-semibold ${ans.status === "right" ? "text-green-500" : "text-red-500"}`}>{ans.status === "right" ? "✔ Верно!" : "✗ Неверно."}{ans.aiChecked && <span className="ml-2 text-[#4255ff] inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> ИИ</span>}</div><div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-sm"><b className="text-[#4255ff]">Правило:</b> {ans.explanation}</div></div>)}
    </div>
  );
}

// ───────── Мой план (адаптивный) ─────────
function MyPath({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [game, setGame] = useState<Gamification | null>(null);
  const [assignments, setAssignments] = useState<{ topics: string[]; note: string | null }[]>([]);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGame(loadGamification()));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    let alive = true;
    (async () => { try { const a = await myAssignments(session?.id_token); if (alive) setAssignments(a.filter((x) => !x.done).map((x) => ({ topics: x.topics, note: x.note }))); } catch { /* нет назначений */ } })();
    return () => { alive = false; };
  }, [session]);
  const weak = useMemo(() => game?.weakUnits ?? [], [game]);
  const items = useMemo(() => {
    if (weak.length === 0) return [];
    return A2_FULL_POOL.filter((q) => weak.includes(q.unit));
  }, [weak]);

  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [aiItems, setAiItems] = useState<A2Question[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const record = (q: A2Question, status: Status, given: string, expl: string, ai = false) => setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));
  const handleText = async (q: A2Question) => {
    if (answers[q.id]) return; const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if ((q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v))) { record(q, "right", v, q.explanation); addXp(5); return; }
    setGradingId(q.id); const g = await aiGrade(session, q.prompt, q.accept?.[0] ?? "", v);
    if (g) { record(q, g.ok ? "right" : "wrong", v, `${g.explanation || q.explanation}${g.correct ? ` (Правильно: ${g.correct})` : ""}`, true); if (g.ok) addXp(5); } else record(q, "wrong", v, q.explanation);
    setGradingId(null);
  };
  const handleMc = (q: A2Question, idx: number) => { if (answers[q.id]) return; const ok = idx === q.answerIndex; record(q, ok ? "right" : "wrong", q.options![idx], q.explanation); if (ok) addXp(5); };

  // Темы для генерации = грам.точки слабых юнитов из пула.
  const weakTopics = useMemo(() => {
    const set = new Set<string>();
    A2_FULL_POOL.filter((q) => weak.includes(q.unit)).forEach((q) => set.add(q.grammarPoint));
    return [...set].slice(0, 8);
  }, [weak]);

  const generateMore = async () => {
    setGenerating(true); setGenError(null);
    try {
      const fresh = await generateQuestions(weakTopics.length ? weakTopics : ["passé composé", "imparfait", "futur", "subjonctif"], 8, session?.id_token);
      if (fresh.length === 0) setGenError("ИИ не вернул заданий, попробуйте ещё раз.");
      setAiItems((p) => [...fresh, ...p]);
    } catch {
      setGenError("Не удалось сгенерировать (ИИ недоступен). Попробуйте позже.");
    } finally { setGenerating(false); }
  };

  if (!game) return null;

  const genButton = (
    <button onClick={generateMore} disabled={generating} className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold disabled:opacity-60 flex items-center gap-2">
      {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерирую…</> : <><Wand2 className="w-4 h-4" /> Ещё задания (ИИ)</>}
    </button>
  );

  if (weak.length === 0 && aiItems.length === 0) return (
    <div className="bg-qz-card border border-border rounded-2xl p-8 text-center">
      <Target className="w-12 h-12 mx-auto text-[#4255ff] mb-3" />
      <h3 className="font-bold text-lg mb-1">План пока пуст</h3>
      <p className="text-qz-text-muted text-sm mb-4">Пройдите «Диагностику» — я соберу план из заданий по слабым юнитам. Или сразу сгенерируйте свежие задания через ИИ.</p>
      <div className="flex justify-center">{genButton}</div>
      {genError && <p className="text-amber-500 text-sm mt-2">{genError}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span><b className="text-emerald-600">Ваш персональный план.</b> {weak.length ? `Слабые юниты: ${weak.map((u) => `U${u}`).join(", ")}.` : "Свежие задания от ИИ."} Бесконечная генерация по вашим темам.</span>
        {genButton}
      </div>
      {assignments.length > 0 && (
        <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm">
          <b className="text-[#4255ff]">Задания от преподавателя:</b>
          <ul className="list-disc ml-5 mt-1 space-y-1">
            {assignments.map((a, i) => (<li key={i}>{a.topics.join(", ")}{a.note ? ` — ${a.note}` : ""}</li>))}
          </ul>
        </div>
      )}
      {genError && <p className="text-amber-500 text-sm">{genError}</p>}
      {aiItems.length > 0 && (
        <div className="text-xs text-qz-text-muted flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Сгенерировано ИИ: {aiItems.length}</div>
      )}
      {[...aiItems, ...items].map((q) => (
        <QuestionCard key={q.id} q={q} ans={answers[q.id]} input={inputs[q.id] ?? ""} grading={gradingId === q.id} recording={false}
          onInput={(v) => setInputs((p) => ({ ...p, [q.id]: v }))} onText={() => handleText(q)} onMc={(j) => handleMc(q, j)} onPron={() => {}} />
      ))}
    </div>
  );
}

// ───────── Грамматика ─────────
function GrammarTrainer() {
  const [openUnit, setOpenUnit] = useState<number | null>(1);
  return (
    <div className="space-y-3">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Справочник грамматики A2.</b> Все правила Édito A2 с примерами. Озвучка примеров — 🔊.</div>
      {A2_UNITS.map((u) => (
        <div key={u.n} className="bg-qz-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => setOpenUnit(openUnit === u.n ? null : u.n)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-background/50"><span className="font-semibold">U{u.n}. {u.title} <span className="text-qz-text-muted font-normal">— {u.titleRu}</span></span><span className="text-xs text-qz-text-muted hidden sm:block">{u.grammar.map((g) => g.point).join(" · ")}</span></button>
          {openUnit === u.n && (<div className="px-5 pb-4 space-y-4"><div className="text-sm text-qz-text-muted">Цели: {u.objectives.join("; ")}.</div>{u.grammar.map((g) => (<div key={g.point} className="bg-background rounded-xl p-4"><div className="font-semibold text-[#4255ff] mb-1">{g.point}</div><div className="text-sm mb-2">{g.rule}</div><div className="space-y-1">{g.examples.map((ex, i) => (<div key={i} className="flex items-center gap-2 text-sm"><button onClick={() => browserSpeak(ex)} className="text-[#4255ff] shrink-0"><Volume2 className="w-4 h-4" /></button><span className="italic">{ex}</span></div>))}</div></div>))}</div>)}
        </div>
      ))}
    </div>
  );
}

// ───────── Тренажёр спряжений (генеративный) ─────────
function ConjugationTrainer({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [tense, setTense] = useState<Tense>("passe_compose");
  const [item, setItem] = useState<ConjugationItem>(() => generateConjugation("passe_compose"));
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ ok: boolean; expl: string } | null>(null);
  const [grading, setGrading] = useState(false);
  const [streak, setStreak] = useState(0);

  const newItem = useCallback((t: Tense) => { setItem(generateConjugation(t)); setInput(""); setResult(null); }, []);

  const submit = async () => {
    if (result) return;
    if (!input.trim()) return;
    if (checkConjugation(item, input)) {
      setResult({ ok: true, expl: item.hint });
      setStreak((s) => s + 1); addXp(3);
      return;
    }
    // спорные формы — спросить ИИ
    setGrading(true);
    const g = await aiGrade(session, `Спряжение ${item.verb} (${TENSE_LABELS[item.tense]}), ${item.pronoun}`, item.display, input);
    setGrading(false);
    if (g?.ok) { setResult({ ok: true, expl: g.explanation || item.hint }); setStreak((s) => s + 1); addXp(3); }
    else { setResult({ ok: false, expl: `Правильно: ${item.display}. ${item.hint}` }); setStreak(0); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Тренажёр спряжений.</b> Бесконечные примеры. Выберите время, проспрягайте глагол. Спорные формы проверяет ИИ. Серия: <b>{streak}</b> 🔥</div>
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TENSE_LABELS) as Tense[]).map((t) => (<button key={t} onClick={() => { setTense(t); newItem(t); }} className={`px-3 py-1.5 rounded-full text-sm border ${tense === t ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>{TENSE_LABELS[t]}</button>))}
      </div>
      <div className="bg-qz-card border border-border rounded-2xl p-6">
        <div className="text-sm text-qz-text-muted mb-1">{TENSE_LABELS[item.tense]} · {item.verb} ({item.ru})</div>
        <div className="text-2xl font-bold mb-4">{item.pronoun} <span className="text-[#4255ff]">____</span> {item.tense === "passe_compose" ? "" : ""}</div>
        <div className="flex gap-2 flex-wrap">
          <input type="text" disabled={!!result} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Введите форму…" className={`flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border-2 bg-background ${result ? (result.ok ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
          {!result ? <button disabled={grading} onClick={submit} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold flex items-center gap-2">{grading ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}</button>
            : <button onClick={() => newItem(tense)} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold flex items-center gap-2"><RefreshCw className="w-4 h-4" /> Дальше</button>}
          <button onClick={() => browserSpeak(item.display)} className="px-3 py-2.5 rounded-xl border border-border"><Volume2 className="w-5 h-5 text-[#4255ff]" /></button>
        </div>
        {result && (<div className={`mt-3 text-sm ${result.ok ? "text-green-500" : "text-red-500"} font-semibold`}>{result.ok ? "✔ Верно!" : "✗ Неверно."}<div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-foreground font-normal">{result.expl}</div></div>)}
      </div>
    </div>
  );
}

// ───────── Лексика (флешкарты + эмодзи) ─────────
function VocabTrainer() {
  const allCards = useMemo(() => {
    const cards: (A2VocabCard & { unit: number; idx: number })[] = [];
    let idx = 0;
    A2_UNITS.forEach((u) => u.vocab.forEach((c) => { cards.push({ ...c, unit: u.n, idx: idx++ }); }));
    return cards;
  }, []);
  const [unitFilter, setUnitFilter] = useState<number | "all">("all");
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const cards = useMemo(() => unitFilter === "all" ? allCards : allCards.filter((c) => c.unit === unitFilter), [allCards, unitFilter]);
  const card = cards[pos % Math.max(cards.length, 1)];
  const next = () => { setFlipped(false); setPos((p) => (p + 1) % cards.length); addXp(1); };
  const prev = () => { setFlipped(false); setPos((p) => (p - 1 + cards.length) % cards.length); };
  const shuffle = () => { setFlipped(false); setPos(Math.floor(Math.random() * cards.length)); };
  if (!card) return null;
  const emoji = VOCAB_EMOJI[card.fr] || "🇫🇷";
  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Карточки лексики A2.</b> {allCards.length} слов с эмодзи-образами и TTS. После деплоя сид-набора слова доступны в режимах Memora с FSRS-повторением.</div>
      <div className="flex gap-2 flex-wrap"><button onClick={() => { setUnitFilter("all"); setPos(0); }} className={`px-3 py-1.5 rounded-full text-sm border ${unitFilter === "all" ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>Все</button>{A2_UNITS.map((u) => (<button key={u.n} onClick={() => { setUnitFilter(u.n); setPos(0); }} className={`px-3 py-1.5 rounded-full text-sm border ${unitFilter === u.n ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>U{u.n}</button>))}</div>
      <button onClick={() => setFlipped((f) => !f)} className="w-full bg-qz-card border border-border rounded-2xl p-10 text-center min-h-[220px] flex flex-col items-center justify-center gap-3 hover:border-[#4255ff]/40 transition-colors">
        <span className="text-6xl">{emoji}</span>
        <span className="text-xs text-qz-text-muted">U{card.unit} · {flipped ? "перевод" : "français"} · нажмите, чтобы перевернуть</span>
        <span className="text-3xl font-bold">{flipped ? card.ru : card.fr}</span>
        {!flipped && card.example && <span className="text-sm text-qz-text-muted italic">{card.example}</span>}
        <span onClick={(e) => { e.stopPropagation(); speakServerOrBrowser(vocabCardUuid(card.idx), card.fr); }} className="mt-2 inline-flex items-center gap-1.5 text-[#4255ff] text-sm cursor-pointer"><Volume2 className="w-4 h-4" /> Озвучить</span>
      </button>
      <div className="flex items-center justify-between"><button onClick={prev} className="px-4 py-2 rounded-xl border border-border hover:bg-qz-card">← Назад</button><span className="text-sm text-qz-text-muted">{(pos % cards.length) + 1} / {cards.length}</span><div className="flex gap-2"><button onClick={shuffle} className="px-4 py-2 rounded-xl border border-border hover:bg-qz-card"><RefreshCw className="w-4 h-4" /></button><button onClick={next} className="px-4 py-2 rounded-xl bg-[#4255ff] text-white">Далее →</button></div></div>
    </div>
  );
}

// ───────── Аудио-диктанты ─────────
interface MergedDictation { key: string; unit: number; fr: string; ru: string; level: number; }
function DictationTrainer({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [answers, setAnswers] = useState<Record<string, { ok: boolean; given: string; expl: string }>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<number | "all">("all");
  const [slow, setSlow] = useState(false);

  const all: MergedDictation[] = useMemo(() => [
    ...A2_DICTATIONS.map((d) => ({ key: `s${d.id}`, unit: d.unit, fr: d.fr, ru: d.ru, level: 1 })),
    ...A2_HARD_DICTATIONS.map((d) => ({ key: `h${d.id}`, unit: d.unit, fr: d.fr, ru: d.ru, level: d.level })),
  ], []);
  const items = useMemo(() => levelFilter === "all" ? all : all.filter((d) => d.level === levelFilter), [all, levelFilter]);

  // «Медленный» режим читает фразу по словам с паузами — для тренировки до автоматизма.
  const playDictation = (fr: string) => {
    if (!slow) { speakInworld(fr); return; }
    const words = fr.split(" ");
    let i = 0;
    const step = () => { if (i < words.length) { speakInworld(words[i]); i++; setTimeout(step, 900); } };
    step();
  };

  const [dueOnly, setDueOnly] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [, forceTick] = useState(0); // для перерисовки после SRS-оценки

  const visible = useMemo(() => dueOnly ? items.filter((d) => isDue(`dict_${d.key}`)) : items, [items, dueOnly]);
  const due = useMemo(() => dueCount(items.map((d) => `dict_${d.key}`)), [items]);

  const check = async (d: MergedDictation) => {
    if (answers[d.key]) return;
    const v = (inputs[d.key] ?? "").trim(); if (!v) return;
    if (similarity(normalizeA2(v), normalizeA2(d.fr)) >= 0.85) { setAnswers((p) => ({ ...p, [d.key]: { ok: true, given: v, expl: `Отлично! «${d.fr}»` } })); addXp(d.level * 3); return; }
    setGradingId(d.key);
    const g = await aiGrade(session, `Диктант (запиши услышанное): ${d.ru}`, d.fr, v);
    setGradingId(null);
    if (g) setAnswers((p) => ({ ...p, [d.key]: { ok: g.ok, given: v, expl: `${g.explanation || ""} Эталон: «${d.fr}»` } }));
    else setAnswers((p) => ({ ...p, [d.key]: { ok: false, given: v, expl: `Эталон: «${d.fr}»` } }));
    if (g?.ok) addXp(d.level * 3);
  };

  const rate = (d: MergedDictation, r: "again" | "hard" | "good" | "easy") => {
    reviewSrs(`dict_${d.key}`, r);
    forceTick((x) => x + 1);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Аудио-диктанты (до автоматизма + интервальные повторения).</b> Прослушайте и запишите фразу. После проверки оцените сложность — трудные вернутся раньше (FSRS). Режим «по словам» помогает разбирать речь.</div>

      {/* Импорт личного аудио учебника по ссылке (без хостинга) */}
      <div className="bg-qz-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Link2 className="w-4 h-4 text-[#4255ff]" /> Своё аудио по ссылке</div>
        <p className="text-xs text-qz-text-muted mb-2">Вставьте прямую ссылку на аудиофайл (например, mp3 из вашего облака/учебника). Мы только проигрываем его — файл не загружается и не хранится на сервере.</p>
        <div className="flex gap-2 flex-wrap">
          <input type="url" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://…/audio.mp3" className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border-2 border-border bg-background text-sm" />
          <button disabled={!audioUrl.trim()} onClick={() => { try { new Audio(audioUrl).play(); } catch { alert("Не удалось воспроизвести ссылку."); } }} className="px-4 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-1.5"><Volume2 className="w-4 h-4" /> Слушать</button>
        </div>
        {audioUrl.trim() && <audio controls src={audioUrl} className="w-full mt-2" />}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {(["all", 1, 2, 3] as const).map((l) => (<button key={l} onClick={() => setLevelFilter(l)} className={`px-3 py-1.5 rounded-full text-sm border ${levelFilter === l ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>{l === "all" ? "Все" : `Уровень ${l}`}</button>))}
        <button onClick={() => setDueOnly((v) => !v)} className={`px-3 py-1.5 rounded-full text-sm border ${dueOnly ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-qz-text-muted"}`}>К повторению ({due})</button>
        <label className="ml-auto flex items-center gap-1.5 text-sm cursor-pointer"><input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> по словам</label>
      </div>
      {visible.length === 0 && <div className="text-sm text-qz-text-muted text-center py-6">На сегодня к повторению ничего нет — отличная работа!</div>}
      {visible.map((d) => {
        const a = answers[d.key];
        return (
          <div key={d.key} className="bg-qz-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4255ff]/10 text-[#4255ff]">U{d.unit} · Диктант · ур.{d.level}</span>
              <button onClick={() => playDictation(d.fr)} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-background text-sm"><Volume2 className="w-4 h-4 text-[#4255ff]" /> Прослушать</button>
            </div>
            <div className="text-sm text-qz-text-muted mb-2">Подсказка (перевод): {d.ru}</div>
            <div className="flex gap-2 flex-wrap">
              <input type="text" disabled={!!a} value={inputs[d.key] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [d.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") check(d); }} placeholder="Запишите услышанное по-французски…" className={`flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border-2 bg-background ${a ? (a.ok ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
              <button disabled={!!a || gradingId === d.key} onClick={() => check(d)} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2">{gradingId === d.key ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}</button>
            </div>
            {a && (
              <div className="mt-3">
                <div className={`text-sm font-semibold ${a.ok ? "text-green-500" : "text-red-500"}`}>{a.ok ? "✔ Верно!" : "✗ Есть ошибки."}<div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-foreground font-normal">{a.expl}</div></div>
                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-qz-text-muted">Когда повторить?</span>
                  <button onClick={() => rate(d, "again")} className="px-2.5 py-1 rounded-full border border-red-500/40 text-red-500">Снова</button>
                  <button onClick={() => rate(d, "hard")} className="px-2.5 py-1 rounded-full border border-amber-500/40 text-amber-500">Трудно</button>
                  <button onClick={() => rate(d, "good")} className="px-2.5 py-1 rounded-full border border-emerald-500/40 text-emerald-600">Хорошо</button>
                  <button onClick={() => rate(d, "easy")} className="px-2.5 py-1 rounded-full border border-emerald-500/40 text-emerald-600">Легко</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ───────── Ролевые диалоги ─────────
const ALL_DIALOGUES = [...A2_DIALOGUES, ...A2_DIALOGUES_EXTRA];
function DialogueTrainer() {
  const [active, setActive] = useState<string | null>(null);
  const dlg = ALL_DIALOGUES.find((d) => d.id === active);
  const [step, setStep] = useState(0);
  const [pron, setPron] = useState<Record<number, { ok: boolean; heard: string; score: number }>>({});
  const [recIdx, setRecIdx] = useState<number | null>(null);

  const pronounce = (line: { fr: string }, idx: number) => {
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert("Распознавание речи доступно в Chrome/Edge."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Rec as any)(); rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1; setRecIdx(idx);
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => { const heard = e.results[0][0].transcript; const score = similarity(normalizeA2(heard), normalizeA2(line.fr)); setPron((p) => ({ ...p, [idx]: { ok: score >= 0.65, heard, score } })); setRecIdx(null); if (score >= 0.65) addXp(3); };
    rec.onerror = () => setRecIdx(null); rec.onend = () => setRecIdx(null); rec.start();
  };

  if (!dlg) {
    return (
      <div className="space-y-4">
        <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Ролевые диалоги.</b> Выберите сценарий. Бот говорит свои реплики, вы произносите свои — мы оцениваем произношение.</div>
        <div className="grid sm:grid-cols-3 gap-3">
          {ALL_DIALOGUES.map((d) => (<button key={d.id} onClick={() => { setActive(d.id); setStep(0); setPron({}); }} className="bg-qz-card border border-border rounded-2xl p-5 text-left hover:border-[#4255ff]/50"><MessageCircle className="w-6 h-6 text-[#4255ff] mb-2" /><div className="font-semibold">{d.title}</div><div className="text-sm text-qz-text-muted mt-1">U{d.unit} · {d.scene}</div></button>))}
        </div>
      </div>
    );
  }

  const visibleLines = dlg.lines.slice(0, step + 1);
  return (
    <div className="space-y-4">
      <button onClick={() => setActive(null)} className="text-sm text-[#4255ff] flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> К списку диалогов</button>
      <div className="bg-qz-card border border-border rounded-2xl p-5">
        <div className="font-bold mb-1">{dlg.title}</div>
        <div className="text-sm text-qz-text-muted mb-4">{dlg.scene}</div>
        <div className="space-y-3">
          {visibleLines.map((line, i) => (
            <div key={i} className={`flex ${line.speaker === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${line.speaker === "user" ? "bg-[#4255ff] text-white" : "bg-background border border-border"}`}>
                <div className="flex items-center gap-2"><span>{line.fr}</span><button onClick={() => browserSpeak(line.fr)} className={line.speaker === "user" ? "text-white/80" : "text-[#4255ff]"}><Volume2 className="w-4 h-4" /></button></div>
                <div className={`text-xs mt-0.5 ${line.speaker === "user" ? "text-white/70" : "text-qz-text-muted"}`}>{line.ru}</div>
                {line.speaker === "user" && (<div className="mt-1.5 flex items-center gap-2"><button onClick={() => pronounce(line, i)} disabled={recIdx === i} className="text-xs flex items-center gap-1 bg-white/15 rounded-full px-2 py-1"><Mic className={`w-3 h-3 ${recIdx === i ? "animate-pulse" : ""}`} /> {recIdx === i ? "Говорите…" : "Произнести"}</button>{pron[i] && <span className="text-xs">{pron[i].ok ? "✔" : "≈"} {Math.round(pron[i].score * 100)}%</span>}</div>)}
              </div>
            </div>
          ))}
        </div>
        {step < dlg.lines.length - 1 ? (<button onClick={() => setStep((s) => s + 1)} className="mt-4 px-4 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold">Следующая реплика →</button>)
          : (<div className="mt-4 text-green-500 text-sm font-semibold">✔ Диалог завершён! Отличная практика.</div>)}
      </div>
    </div>
  );
}

// ───────── Аудирование / Говорение (общий тренажёр) ─────────
function SkillTrainer({ session, skill, title, hint }: { session: ReturnType<typeof useSession>["data"]; skill: A2Skill; title: string; hint: string; }) {
  const items = useMemo(() => A2_FULL_POOL.filter((q) => q.skill === skill), [skill]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [pron, setPron] = useState<Record<number, { ok: boolean; heard: string; score: number }>>({});
  const [recId, setRecId] = useState<number | null>(null);
  const [gradingId, setGradingId] = useState<number | null>(null);
  const record = (q: A2Question, status: Status, given: string, expl: string, ai = false) => setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));
  const handleText = async (q: A2Question) => {
    if (answers[q.id]) return; const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if ((q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v))) { record(q, "right", v, q.explanation); addXp(4); return; }
    setGradingId(q.id); const g = await aiGrade(session, q.prompt, q.accept?.[0] ?? "", v);
    if (g) { record(q, g.ok ? "right" : "wrong", v, `${g.explanation || q.explanation}${g.correct ? ` (Правильно: ${g.correct})` : ""}`, true); if (g.ok) addXp(4); } else record(q, "wrong", v, q.explanation);
    setGradingId(null);
  };
  const handleMc = (q: A2Question, idx: number) => { if (answers[q.id]) return; const ok = idx === q.answerIndex; record(q, ok ? "right" : "wrong", q.options![idx], q.explanation); if (ok) addXp(4); };
  const pronounce = async (q: A2Question) => {
    const target = q.speak || ""; if (!target) return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert("Распознавание речи доступно в Chrome/Edge."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Rec as any)(); rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1; setRecId(q.id);
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => { const heard = e.results[0][0].transcript; const score = similarity(normalizeA2(heard), normalizeA2(target)); setPron((p) => ({ ...p, [q.id]: { ok: score >= 0.7, heard, score } })); setRecId(null); if (score >= 0.7) addXp(4); };
    rec.onerror = () => setRecId(null); rec.onend = () => setRecId(null); rec.start();
  };
  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">{title}.</b> {hint}</div>
      {items.map((q) => (
        <QuestionCard key={q.id} q={q} ans={answers[q.id]} input={inputs[q.id] ?? ""} grading={gradingId === q.id} pron={pron[q.id]} recording={recId === q.id}
          onInput={(v) => setInputs((p) => ({ ...p, [q.id]: v }))} onText={() => handleText(q)} onMc={(j) => handleMc(q, j)} onPron={() => pronounce(q)} />
      ))}
    </div>
  );
}

// ───────── Épreuve blanche DELF A2 (экзамен с таймером) ─────────
function ExamMode({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [mode, setMode] = useState<"menu" | "classic" | "cat">("menu");
  if (mode === "cat") return <AdaptiveExam session={session} onExit={() => setMode("menu")} />;
  return <ClassicExam session={session} setMode={setMode} />;
}

function ClassicExam({ session, setMode }: { session: ReturnType<typeof useSession>["data"]; setMode: (m: "menu" | "classic" | "cat") => void }) {
  const [started, setStarted] = useState(false);
  const [questions, setQuestions] = useState<A2Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!started || finished) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, finished]);

  const start = () => { setQuestions(buildExam(100)); setAnswers({}); setInputs({}); setSeconds(0); setFinished(false); setStarted(true); };
  const record = (q: A2Question, status: Status, given: string, expl: string, ai = false) => setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));
  const handleText = async (q: A2Question) => {
    if (answers[q.id]) return; const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if ((q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v))) { record(q, "right", v, q.explanation); return; }
    setGradingId(q.id); const g = await aiGrade(session, q.prompt, q.accept?.[0] ?? "", v);
    if (g) record(q, g.ok ? "right" : "wrong", v, `${g.explanation || q.explanation}`, true); else record(q, "wrong", v, q.explanation);
    setGradingId(null);
  };
  const handleMc = (q: A2Question, idx: number) => { if (answers[q.id]) return; record(q, idx === q.answerIndex ? "right" : "wrong", q.options![idx], q.explanation); };

  const right = Object.values(answers).filter((a) => a.status === "right").length;
  const score = questions.length ? Math.round(right / questions.length * 100) : 0;
  const passed = score >= 60; // повышенная строгость

  const finish = () => { setFinished(true); addXp(passed ? 50 : 15); if (passed) awardBadge("delf-a2-blanche"); setTimeout(() => document.getElementById("exam-res")?.scrollIntoView({ behavior: "smooth" }), 50); };

  if (!started) return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-qz-card border border-border rounded-2xl p-6 text-center">
          <Award className="w-10 h-10 mx-auto text-[#ffcd1f] mb-2" />
          <h3 className="font-bold mb-1">Épreuve blanche (классика)</h3>
          <p className="text-qz-text-muted text-sm mb-4">100 случайных заданий из банка 400+, таймер, порог 60%. Бейдж + 50 XP.</p>
          <button onClick={start} className="px-5 py-2.5 rounded-xl bg-[#ffcd1f] text-[#1a1d28] font-bold flex items-center gap-2 mx-auto"><Clock className="w-4 h-4" /> Начать</button>
        </div>
        <div className="bg-qz-card border border-emerald-500/30 rounded-2xl p-6 text-center">
          <GraduationCap className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
          <h3 className="font-bold mb-1">Адаптивный экзамен (CAT)</h3>
          <p className="text-qz-text-muted text-sm mb-4">Сложность подстраивается под ответы — точная оценка уровня за ~12 вопросов вместо 100.</p>
          <button onClick={() => setMode("cat")} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2 mx-auto"><Sparkles className="w-4 h-4" /> Запустить CAT</button>
        </div>
      </div>
    </div>
  );

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 bg-background py-3 flex items-center gap-3 flex-wrap">
        <span className="flex items-center gap-1.5 font-semibold"><Clock className="w-4 h-4 text-[#4255ff]" /> {mm}:{ss}</span>
        <span className="text-sm text-qz-text-muted">{Object.keys(answers).length}/{questions.length} отвечено</span>
        {!finished && <button onClick={finish} className="ml-auto px-4 py-2 rounded-xl bg-[#4255ff] text-white text-sm font-semibold">Завершить экзамен</button>}
      </div>
      {!finished && questions.map((q) => (
        <QuestionCard key={q.id} q={q} ans={answers[q.id]} input={inputs[q.id] ?? ""} grading={gradingId === q.id} recording={false}
          onInput={(v) => setInputs((p) => ({ ...p, [q.id]: v }))} onText={() => handleText(q)} onMc={(j) => handleMc(q, j)} onPron={() => {}} />
      ))}
      {finished && (
        <div id="exam-res" className="bg-qz-card border border-border rounded-2xl p-6 text-center space-y-4">
          <div className={`w-28 h-28 rounded-full grid place-items-center mx-auto ${passed ? "bg-green-500/10" : "bg-amber-500/10"}`}><span className="text-3xl font-bold">{score}%</span></div>
          <div className="text-xl font-bold">{passed ? "🎉 Экзамен сдан!" : "Почти получилось"}</div>
          <p className="text-qz-text-muted text-sm">{right} из {questions.length} верно за {mm}:{ss}. {passed ? "Уровень соответствует A2 — отличная работа! Бейдж получен." : "Порог — 60%. Проработайте «Мой план» и попробуйте снова."}</p>
          {passed && <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-600 px-4 py-2 rounded-full font-semibold"><Award className="w-5 h-5" /> Сертификат: DELF A2 blanche</div>}
          <div className="flex gap-2 justify-center"><button onClick={start} className="px-5 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold">Пройти заново</button><button onClick={() => setMode("menu")} className="px-5 py-2.5 rounded-xl border border-border font-semibold">К выбору режима</button></div>
        </div>
      )}
    </div>
  );
}

// ───────── Адаптивный экзамен (CAT) ─────────
function AdaptiveExam({ session, onExit }: { session: ReturnType<typeof useSession>["data"]; onExit: () => void }) {
  const pool = A2_FULL_POOL;
  const MAX_Q = 12;
  const [cat, setCat] = useState(() => catInit());
  const [curIdx, setCurIdx] = useState<number>(() => catNext(pool, catInit()));
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; expl: string } | null>(null);
  const [grading, setGrading] = useState(false);
  const [done, setDone] = useState(false);

  const q = pool[curIdx];
  const score = catScore(cat);

  const advance = (correct: boolean, expl: string) => {
    setFeedback({ ok: correct, expl });
    void reportErrorStat(q.grammarPoint, correct, session?.id_token);
  };

  const submitMc = (j: number) => {
    if (feedback) return;
    const correct = j === q.answerIndex;
    advance(correct, q.explanation);
  };
  const submitText = async () => {
    if (feedback || !input.trim()) return;
    const v = input.trim();
    if ((q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v))) { advance(true, q.explanation); return; }
    setGrading(true);
    const g = await aiGrade(session, q.prompt, q.accept?.[0] ?? "", v);
    setGrading(false);
    advance(g ? g.ok : false, g ? (g.explanation || q.explanation) : q.explanation);
  };

  const nextQuestion = () => {
    const correct = feedback?.ok ?? false;
    const ns = catUpdate(cat, curIdx, correct, questionDifficulty(q));
    setCat(ns);
    setFeedback(null); setInput("");
    if (ns.asked.length >= MAX_Q) {
      setDone(true);
      const sc = catScore(ns);
      if (sc.percent >= 60) { addXp(40); awardBadge("cat-a2"); } else addXp(10);
      return;
    }
    setCurIdx(catNext(pool, ns));
  };

  if (done) {
    const sc = catScore(cat);
    return (
      <div className="bg-qz-card border border-border rounded-2xl p-6 text-center space-y-4">
        <div className={`w-28 h-28 rounded-full grid place-items-center mx-auto ${sc.percent >= 60 ? "bg-green-500/10" : "bg-amber-500/10"}`}><span className="text-3xl font-bold">{sc.percent}%</span></div>
        <div className="text-xl font-bold">Адаптивная оценка</div>
        <p className="text-qz-text-muted text-sm">{sc.verdict} Оценка получена за {cat.asked.length} вопросов (вместо 100). Верных: {cat.history.filter(Boolean).length}.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => { const i = catInit(); setCat(i); setCurIdx(catNext(pool, i)); setDone(false); setFeedback(null); setInput(""); }} className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold">Пройти заново</button>
          <button onClick={onExit} className="px-5 py-2.5 rounded-xl border border-border font-semibold">К выбору режима</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onExit} className="text-sm text-[#4255ff] flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Выйти</button>
        <span className="text-sm text-qz-text-muted">Вопрос {cat.asked.length + 1} / {MAX_Q}</span>
        <span className="ml-auto text-sm flex items-center gap-1.5"><GraduationCap className="w-4 h-4 text-emerald-600" /> Уровень: ~{score.percent}%</span>
      </div>
      <div className="h-2 bg-qz-card rounded-full overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${(cat.asked.length / MAX_Q) * 100}%` }} /></div>

      <div className="bg-qz-card border border-border rounded-2xl p-5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-600">{q.grammarPoint} · сложность {Math.round(questionDifficulty(q) * 100)}%</span>
        </div>
        <div className="flex items-start gap-2 mb-3"><p className="text-lg flex-1">{q.prompt}</p><button onClick={() => speakInworld(q.speak || q.prompt)} className="p-2 rounded-lg hover:bg-background text-[#4255ff]"><Volume2 className="w-5 h-5" /></button></div>

        {q.type === "mc" && (
          <div className="grid gap-2">
            {q.options!.map((opt, j) => {
              let cls = "border-border hover:border-[#4255ff]";
              if (feedback) { if (j === q.answerIndex) cls = "border-green-500 bg-green-500/10"; else cls = "border-border opacity-70"; }
              return <button key={j} disabled={!!feedback} onClick={() => submitMc(j)} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 text-left ${cls}`}><span className="font-bold text-[#4255ff] w-5">{LETTERS[j]}</span><span>{opt}</span></button>;
            })}
          </div>
        )}
        {q.type === "text" && (
          <div className="flex gap-2 flex-wrap">
            <input type="text" disabled={!!feedback} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitText(); }} placeholder="Введите ответ…" className={`flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border-2 bg-background ${feedback ? (feedback.ok ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
            {!feedback && <button disabled={grading} onClick={submitText} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold flex items-center gap-2">{grading ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Ответить"}</button>}
          </div>
        )}
        {feedback && (
          <div className="mt-3">
            <div className={`text-sm font-semibold ${feedback.ok ? "text-green-500" : "text-red-500"}`}>{feedback.ok ? "✔ Верно!" : "✗ Неверно."}</div>
            <div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-sm"><b className="text-[#4255ff]">Правило:</b> {feedback.expl}</div>
            <button onClick={nextQuestion} className="mt-3 px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-2">{cat.asked.length + 1 >= MAX_Q ? "Завершить" : "Следующий"} <ArrowRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Тренажёр ФРАЗ (карточки + тест RU→FR) ─────────
function PhraseTrainer({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [mode, setMode] = useState<"cards" | "test">("cards");
  const [catFilter, setCatFilter] = useState<string>("Все");
  const cats = useMemo(() => ["Все", ...phraseCategories()], []);
  const phrases = useMemo(() => catFilter === "Все" ? A2_PHRASES : A2_PHRASES.filter((p) => p.category === catFilter), [catFilter]);

  // карточки
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = phrases[pos % Math.max(phrases.length, 1)];

  // тест
  const test = useMemo(() => catFilter === "Все" ? PHRASE_TEST : PHRASE_TEST.filter((p) => p.category === catFilter), [catFilter]);
  const [answers, setAnswers] = useState<Record<number, { ok: boolean; given: string; expl: string }>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);

  const checkPhrase = async (q: typeof PHRASE_TEST[0]) => {
    if (answers[q.id]) return;
    const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if (q.accept.some((a) => normalizeA2(a) === normalizeA2(v))) { setAnswers((p) => ({ ...p, [q.id]: { ok: true, given: v, expl: `Отлично! «${q.fr}»` } })); addXp(3); return; }
    setGradingId(q.id);
    const g = await aiGrade(session, `Скажи по-французски: ${q.ru}`, q.fr, v);
    setGradingId(null);
    if (g) setAnswers((p) => ({ ...p, [q.id]: { ok: g.ok, given: v, expl: `${g.explanation || ""} Вариант: «${q.fr}»` } }));
    else setAnswers((p) => ({ ...p, [q.id]: { ok: false, given: v, expl: `Вариант: «${q.fr}»` } }));
    if (g?.ok) addXp(3);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Ходовые фразы A2.</b> {A2_PHRASES.length} выражений для реальных ситуаций. Учите карточками (с озвучкой Inworld и FSRS после сидинга) или проверьте себя тестом RU→FR — так соберётся персональный план фраз.</div>
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setMode("cards")} className={`px-3 py-1.5 rounded-full text-sm border ${mode === "cards" ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>Карточки</button>
        <button onClick={() => setMode("test")} className={`px-3 py-1.5 rounded-full text-sm border ${mode === "test" ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>Тест фраз</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {cats.map((c) => (<button key={c} onClick={() => { setCatFilter(c); setPos(0); setFlipped(false); }} className={`px-3 py-1.5 rounded-full text-sm border ${catFilter === c ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-qz-text-muted"}`}>{c}</button>))}
      </div>

      {mode === "cards" && card && (
        <>
          <button onClick={() => setFlipped((f) => !f)} className="w-full bg-qz-card border border-border rounded-2xl p-10 text-center min-h-[200px] flex flex-col items-center justify-center gap-3 hover:border-[#4255ff]/40">
            <span className="text-xs text-qz-text-muted">{card.category} · {flipped ? "français" : "русский"} · нажмите, чтобы перевернуть</span>
            <span className="text-2xl font-bold">{flipped ? card.fr : card.ru}</span>
            {flipped && card.note && <span className="text-sm text-qz-text-muted italic">{card.note}</span>}
            <span onClick={(e) => { e.stopPropagation(); speakCardInworld(phraseCardUuid(card.id), card.fr); }} className="mt-2 inline-flex items-center gap-1.5 text-[#4255ff] text-sm cursor-pointer"><Volume2 className="w-4 h-4" /> Озвучить</span>
          </button>
          <div className="flex items-center justify-between">
            <button onClick={() => { setFlipped(false); setPos((p) => (p - 1 + phrases.length) % phrases.length); }} className="px-4 py-2 rounded-xl border border-border hover:bg-qz-card">← Назад</button>
            <span className="text-sm text-qz-text-muted">{(pos % phrases.length) + 1} / {phrases.length}</span>
            <button onClick={() => { setFlipped(false); setPos((p) => (p + 1) % phrases.length); addXp(1); }} className="px-4 py-2 rounded-xl bg-[#4255ff] text-white">Далее →</button>
          </div>
        </>
      )}

      {mode === "test" && test.map((q) => {
        const a = answers[q.id];
        return (
          <div key={q.id} className="bg-qz-card border border-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-2"><span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-600">{q.category}</span></div>
            <p className="text-lg mb-3">{q.prompt}</p>
            <div className="flex gap-2 flex-wrap">
              <input type="text" disabled={!!a} value={inputs[q.id] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [q.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") checkPhrase(q); }} placeholder="Введите фразу по-французски…" className={`flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border-2 bg-background ${a ? (a.ok ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
              <button disabled={!!a || gradingId === q.id} onClick={() => checkPhrase(q)} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2">{gradingId === q.id ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}</button>
              <button onClick={() => speakCardInworld(phraseCardUuid(q.id), q.fr)} className="px-3 py-2.5 rounded-xl border border-border"><Volume2 className="w-5 h-5 text-[#4255ff]" /></button>
            </div>
            {a && (<div className={`mt-3 text-sm font-semibold ${a.ok ? "text-green-500" : "text-red-500"}`}>{a.ok ? "✔ Верно!" : "✗ Неточно."}<div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-foreground font-normal">{a.expl}</div></div>)}
          </div>
        );
      })}
    </div>
  );
}

// ───────── Тренажёр письменной речи (production écrite) ─────────
function WritingTrainer({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [taskId, setTaskId] = useState<number>(A2_WRITING_TASKS[0].id);
  const task: WritingTask = A2_WRITING_TASKS.find((t) => t.id === taskId)!;
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; explanation: string; correct: string } | null>(null);
  const [grading, setGrading] = useState(false);
  const [history, setHistory] = useState<WritingAttempt[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setHistory(loadWritingHistory()));
    return () => cancelAnimationFrame(id);
  }, []);

  const words = countWords(text);
  const inRange = words >= task.minWords && words <= task.maxWords;

  const submit = async () => {
    if (grading || !text.trim()) return;
    setResult(null);
    setGrading(true);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.id_token) headers["Authorization"] = `Bearer ${session.id_token}`;
      const res = await fetch("/api/ai/learn/grade", {
        method: "POST", headers,
        body: JSON.stringify({
          setId: "00000000-0000-0000-0000-000000000000",
          cardId: "00000000-0000-0000-0000-000000000000",
          questionType: "writing",
          userAnswer: text,
          questionText: buildWritingGradePrompt(task, text),
        }),
      });
      if (res.ok) {
        const g = await res.json() as { isCorrect: boolean; explanation: string; correctAnswer: string };
        setResult({ ok: g.isCorrect, explanation: g.explanation, correct: g.correctAnswer });
        if (g.isCorrect) addXp(15);
        addWritingAttempt({ taskId: task.id, taskTitle: task.title, date: new Date().toISOString(), words, passed: g.isCorrect, excerpt: text.slice(0, 120) });
        setHistory(loadWritingHistory());
      } else {
        setResult({ ok: false, explanation: "ИИ-проверка недоступна. Сверьтесь с опорными фразами и обязательными пунктами выше.", correct: "" });
      }
    } catch {
      setResult({ ok: false, explanation: "Ошибка сети при проверке.", correct: "" });
    } finally {
      setGrading(false);
    }
  };

  const reset = () => { setText(""); setResult(null); };

  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm flex items-center justify-between gap-3 flex-wrap">
        <span><b className="text-[#4255ff]">Письменная речь (production écrite) A2.</b> Задание формата DELF A2 → ИИ-проверка по критериям, ошибки и улучшенная версия.</span>
        <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm whitespace-nowrap"><History className="w-4 h-4" /> История ({history.length})</button>
      </div>

      {showHistory && (
        <div className="bg-qz-card border border-border rounded-2xl p-4">
          <div className="font-semibold text-sm mb-2">История попыток и прогресс</div>
          {history.length === 0 ? <p className="text-sm text-qz-text-muted">Пока нет попыток. Напишите и проверьте первый текст.</p> : (
            <>
              <div className="text-xs text-qz-text-muted mb-2">Зачётов: {history.filter((h) => h.passed).length} из {history.length} ({Math.round(history.filter((h) => h.passed).length / history.length * 100)}%)</div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm border-b border-border pb-1.5">
                    <span className={h.passed ? "text-green-500" : "text-amber-500"}>{h.passed ? "✔" : "↻"}</span>
                    <span className="flex-1 truncate">{h.taskTitle}</span>
                    <span className="text-xs text-qz-text-muted">{h.words} сл.</span>
                    <span className="text-xs text-qz-text-muted">{new Date(h.date).toLocaleDateString("ru-RU")}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {A2_WRITING_TASKS.map((t) => (
          <button key={t.id} onClick={() => { setTaskId(t.id); reset(); }} className={`px-3 py-1.5 rounded-full text-sm border ${taskId === t.id ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>
            {WRITING_TYPE_LABELS[t.type]}
          </button>
        ))}
      </div>

      <div className="bg-qz-card border border-border rounded-2xl p-5 space-y-3">
        <div className="font-semibold">{task.title}</div>
        <div className="text-sm">{task.prompt}</div>
        <div className="text-xs text-qz-text-muted">Объём: {task.minWords}–{task.maxWords} слов · Грамматика: {task.grammarFocus}</div>
        <div className="bg-background rounded-lg p-3 text-sm">
          <div className="mb-1"><b className="text-[#4255ff]">Нужно отразить:</b> {task.mustInclude.join("; ")}.</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {task.usefulPhrases.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-[#4255ff]/10 text-[#4255ff] rounded-full px-2 py-1">
                {p}<button onClick={() => speakInworld(p)}><Volume2 className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={grading}
          placeholder="Écrivez votre texte ici…"
          rows={8}
          className="w-full px-3 py-2.5 rounded-xl border-2 border-border bg-background text-sm resize-y"
        />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className={`text-xs ${inRange ? "text-green-500" : "text-amber-500"}`}>
            {words} слов {inRange ? "✓ в рамках" : `(нужно ${task.minWords}–${task.maxWords})`}
          </span>
          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 rounded-xl border border-border text-sm">Очистить</button>
            <button onClick={submit} disabled={grading || !text.trim()} className="px-5 py-2 rounded-xl bg-[#4255ff] text-white font-semibold text-sm disabled:opacity-60 flex items-center gap-2">
              {grading ? <><Loader2 className="w-4 h-4 animate-spin" /> Проверяю…</> : <><Sparkles className="w-4 h-4" /> Проверить ИИ</>}
            </button>
          </div>
        </div>

        {result && (
          <div className="mt-2">
            <div className={`text-sm font-semibold ${result.ok ? "text-green-500" : "text-amber-500"}`}>
              {result.ok ? "✔ Соответствует уровню A2" : "↻ Есть что улучшить"}
            </div>
            <div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-sm whitespace-pre-wrap">{result.explanation}</div>
            {result.correct && (
              <div className="mt-2 text-sm"><b className="text-green-600">Улучшенный вариант:</b> <span className="italic">{result.correct}</span></div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────── Прогресс: недельная цель + таблица лидеров ─────────
function ProgressTab() {
  const { data: session } = useSession();
  const [game, setGame] = useState<Gamification | null>(null);
  const [name, setName] = useState("");
  const [target, setTarget] = useState(150);
  const [, tick] = useState(0);

  // класс / реальный лидерборд
  const [joinCode, setJoinCode] = useState("");
  const [joinedCode, setJoinedCode] = useState<string | null>(null);
  const [realBoard, setRealBoard] = useState<{ name: string; xp: number; me: boolean }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);
  useEffect(() => { isOfflineReady().then(setOfflineReady); }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const g = loadGamification();
      setGame(g);
      setTarget(getWeeklyGoal(g.xp).targetXp);
      if (typeof window !== "undefined") {
        setName(localStorage.getItem("memora_a2_name") || "");
        setJoinedCode(localStorage.getItem("memora_a2_class") || null);
      }
    });
    return () => cancelAnimationFrame(id);
  }, []);

  // при наличии класса — тянем реальный лидерборд и отправляем свой XP
  useEffect(() => {
    if (!joinedCode || !game) return;
    let alive = true;
    (async () => {
      try {
        await submitXp(game.xp, game.streak, session?.id_token);
        const rows = await classLeaderboard(joinedCode, session?.id_token);
        if (alive) setRealBoard(rows.map((r) => ({ name: r.name, xp: r.xp, me: r.me })));
      } catch { if (alive) setRealBoard(null); }
    })();
    return () => { alive = false; };
  }, [joinedCode, game, session]);

  if (!game) return null;

  const goal = getWeeklyGoal(game.xp);
  const earnedThisWeek = Math.max(0, game.xp - goal.startXp);
  const goalPct = Math.min(100, Math.round((earnedThisWeek / goal.targetXp) * 100));
  const demoBoard = getLeaderboard(name || "Вы", game.xp);
  const board = realBoard ?? demoBoard;

  const saveName = (v: string) => { setName(v); if (typeof window !== "undefined") localStorage.setItem("memora_a2_name", v); };
  const applyTarget = (t: number) => { setTarget(t); setWeeklyTarget(t, game.xp); tick((x) => x + 1); };

  const doDownload = async () => {
    setOfflineBusy(true);
    const r = await downloadForOffline();
    setOfflineBusy(false);
    setOfflineReady(r.ok);
    setOfflineMsg(r.ok ? `Готово к офлайну (${r.cached} файлов). Можно учиться без сети.` : "Не удалось сохранить офлайн в этом браузере.");
  };

  const doJoin = async () => {
    if (!joinCode.trim()) return;
    setBusy(true); setMsg(null);
    try {
      await joinClass(joinCode.trim(), name || "Ученик", session?.id_token);
      const code = joinCode.trim().toUpperCase();
      if (typeof window !== "undefined") localStorage.setItem("memora_a2_class", code);
      setJoinedCode(code); setMsg("Вы вступили в класс!");
    } catch { setMsg("Не удалось вступить: проверьте код или войдите в аккаунт."); }
    finally { setBusy(false); }
  };
  const leaveClass = () => { if (typeof window !== "undefined") localStorage.removeItem("memora_a2_class"); setJoinedCode(null); setRealBoard(null); };

  return (
    <div className="space-y-4">
      {/* Недельная цель */}
      <div className="bg-qz-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 font-semibold mb-2"><Target className="w-5 h-5 text-emerald-600" /> Цель недели</div>
        <div className="text-sm text-qz-text-muted mb-2">Заработано на этой неделе: <b className="text-foreground">{earnedThisWeek}</b> / {goal.targetXp} XP</div>
        <div className="h-3 bg-background rounded-full overflow-hidden mb-3"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${goalPct}%` }} /></div>
        {goalPct >= 100 ? <div className="text-green-500 text-sm font-semibold">🎉 Цель недели достигнута!</div> : (
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className="text-qz-text-muted">Изменить цель:</span>
            {[100, 150, 250, 400].map((t) => (
              <button key={t} onClick={() => applyTarget(t)} className={`px-3 py-1 rounded-full border ${target === t ? "bg-emerald-600 text-white border-emerald-600" : "border-border text-qz-text-muted"}`}>{t} XP</button>
            ))}
          </div>
        )}
      </div>

      {/* Класс */}
      <div className="bg-qz-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 font-semibold mb-3"><Users className="w-5 h-5 text-[#4255ff]" /> Класс</div>
        <input type="text" value={name} onChange={(e) => saveName(e.target.value)} placeholder="Ваше имя" className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm mb-2" />
        {joinedCode ? (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-600 font-semibold">Класс: {joinedCode}</span>
            <button onClick={leaveClass} className="px-3 py-1 rounded-full border border-border text-qz-text-muted">Выйти</button>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Код класса (от преподавателя)" className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            <button onClick={doJoin} disabled={busy} className="px-4 py-2 rounded-lg bg-[#4255ff] text-white text-sm font-semibold disabled:opacity-60">{busy ? "…" : "Вступить"}</button>
          </div>
        )}
        {msg && <p className="text-xs text-qz-text-muted mt-2">{msg}</p>}
      </div>

      {/* Офлайн-режим */}
      <div className="bg-qz-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 font-semibold mb-2"><Download className="w-5 h-5 text-[#4255ff]" /> Офлайн-режим (в дороге)</div>
        <p className="text-sm text-qz-text-muted mb-3">Сохраните курс на устройство — карточки, диктанты и задания будут работать без интернета (ИИ-проверка и озвучка требуют сети). {offlineReady && <span className="text-emerald-600">✓ Уже сохранено.</span>}</p>
        {offlineSupported() ? (
          <button onClick={doDownload} disabled={offlineBusy} className="px-4 py-2 rounded-lg bg-[#4255ff] text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2">
            {offlineBusy ? <><Loader2 className="w-4 h-4 animate-spin" /> Сохраняю…</> : <><Download className="w-4 h-4" /> {offlineReady ? "Обновить офлайн-копию" : "Скачать для офлайна"}</>}
          </button>
        ) : <p className="text-xs text-amber-500">Этот браузер не поддерживает офлайн-кэш.</p>}
        {offlineMsg && <p className="text-xs text-qz-text-muted mt-2">{offlineMsg}</p>}
      </div>

      {/* Таблица лидеров */}
      <div className="bg-qz-card border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2 font-semibold mb-3"><Trophy className="w-5 h-5 text-[#ffcd1f]" /> Таблица лидеров {realBoard ? "класса" : "(демо)"}</div>
        <div className="space-y-1.5">
          {board.map((row, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${row.me ? "bg-[#4255ff]/10 font-semibold" : "bg-background"}`}>
              <span className={`w-6 text-center ${i === 0 ? "text-[#ffcd1f]" : "text-qz-text-muted"}`}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}</span>
              <span className="flex-1">{row.name}{row.me && " (вы)"}</span>
              <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-[#4255ff]" /> {row.xp}</span>
            </div>
          ))}
        </div>
        {!realBoard && <p className="text-xs text-qz-text-muted mt-3">Вступите в класс по коду — таблица станет реальной для вашей группы.</p>}
      </div>
    </div>
  );
}
