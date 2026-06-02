"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Volume2, Mic, Shuffle, CheckCircle2, XCircle, Loader2,
  ChevronLeft, Sparkles, ArrowRight, BookOpen, Headphones, MessageCircle,
  GraduationCap, Brain, RefreshCw, Trophy, Flame, Zap, Target, Award, Clock,
} from "lucide-react";
import {
  A2_UNITS, A2_DIAGNOSTIC, A2_SKILL_LABELS, normalizeA2,
  A2Question, A2Skill, A2VocabCard,
} from "@/lib/courses/frenchA2";
import {
  Tense, TENSE_LABELS, generateConjugation, checkConjugation, ConjugationItem,
  A2_DIALOGUES, A2_DICTATIONS, mistakeOfTheDay, VOCAB_EMOJI, buildExam,
  loadGamification, addXp, awardBadge, setWeakUnits, levelFromXp, Gamification,
} from "@/lib/courses/frenchA2Extra";
import { speakInworld, speakCardInworld } from "@/lib/courses/ttsInworld";

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

type Tab = "diagnostic" | "path" | "grammar" | "conjug" | "vocab" | "listening" | "dictation" | "dialogue" | "speaking" | "exam";

export default function FrenchA2CoursePage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("diagnostic");
  const [game, setGame] = useState<Gamification | null>(null);
  useEffect(() => { setGame(loadGamification()); }, [tab]);

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
          <div className="flex items-center gap-4 bg-qz-card border border-border rounded-2xl px-4 py-3 flex-wrap">
            <div className="flex items-center gap-1.5"><Trophy className="w-5 h-5 text-[#ffcd1f]" /><span className="font-semibold text-sm">Ур. {lvl.level} · {lvl.title}</span></div>
            <div className="flex items-center gap-1.5"><Zap className="w-5 h-5 text-[#4255ff]" /><span className="text-sm">{game.xp} XP</span></div>
            <div className="flex items-center gap-1.5"><Flame className={`w-5 h-5 ${game.streak > 0 ? "text-orange-500" : "text-qz-text-muted"}`} /><span className="text-sm">{game.streak} дн. подряд</span></div>
            <div className="flex-1 min-w-[100px] h-2 bg-background rounded-full overflow-hidden"><div className="h-full bg-[#ffcd1f]" style={{ width: `${(game.xp % 100)}%` }} /></div>
            {game.badges.length > 0 && <div className="flex items-center gap-1"><Award className="w-4 h-4 text-emerald-500" /><span className="text-sm">{game.badges.length}</span></div>}
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
            ["listening", "Аудирование", Headphones],
            ["dictation", "Диктанты", Headphones],
            ["dialogue", "Диалоги", MessageCircle],
            ["speaking", "Говорение", Mic],
            ["exam", "Экзамен DELF", Award],
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
        {tab === "listening" && <SkillTrainer session={session} skill="listening" title="Тренажёр аудирования" hint="Нажмите 🔊, послушайте и ответьте." />}
        {tab === "dictation" && <DictationTrainer session={session} />}
        {tab === "dialogue" && <DialogueTrainer />}
        {tab === "speaking" && <SkillTrainer session={session} skill="speaking" title="Тренажёр говорения" hint="Нажмите 🎙, произнесите фразу — оценим произношение." />}
        {tab === "exam" && <ExamMode session={session} />}
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
  const [order, setOrder] = useState<number[]>(() => A2_DIAGNOSTIC.map((_, i) => i));
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [pron, setPron] = useState<Record<number, { ok: boolean; heard: string; score: number }>>({});
  const [recId, setRecId] = useState<number | null>(null);

  const questions = useMemo(() => order.map((i) => A2_DIAGNOSTIC[i]), [order]);
  const total = A2_DIAGNOSTIC.length;
  const answered = Object.keys(answers).length;
  const right = Object.values(answers).filter((a) => a.status === "right").length;

  const record = useCallback((q: A2Question, status: Status, given: string, expl: string, ai = false) => {
    setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));
  }, []);
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
    A2_DIAGNOSTIC.forEach((q) => {
      byUnit[q.unit] = byUnit[q.unit] || { r: 0, t: 0 }; byUnit[q.unit].t++;
      bySkill[q.skill] = bySkill[q.skill] || { r: 0, t: 0 }; bySkill[q.skill].t++;
      if (answers[q.id]?.status === "right") { byUnit[q.unit].r++; bySkill[q.skill].r++; }
    });
    const units = Object.entries(byUnit).map(([u, v]) => ({ u: +u, ...v, p: Math.round(v.r / v.t * 100) })).sort((a, b) => a.u - b.u);
    const skills = Object.entries(bySkill).map(([s, v]) => ({ s: s as A2Skill, ...v, p: Math.round(v.r / v.t * 100) }));
    const weakUnits = units.filter((x) => x.p < 70).sort((a, b) => a.p - b.p);
    const wrong = A2_DIAGNOSTIC.filter((q) => answers[q.id]?.status === "wrong");
    return { units, skills, weakUnits, wrong, p: Math.round(right / total * 100) };
  }, [answers, right, total]);

  const finish = () => {
    setShowResults(true);
    onDone(results.weakUnits.map((u) => u.u));
    if (results.p >= 70) awardBadge("diagnostic-pass");
    setTimeout(() => document.getElementById("a2-results")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <>
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Диагностический тест A2.</b> 45 заданий по 12 юнитам и 4 навыкам. После завершения — разбор по юнитам, рекомендации и автосбор «Моего плана».</div>
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
  useEffect(() => { setGame(loadGamification()); }, []);
  const weak = game?.weakUnits ?? [];
  const items = useMemo(() => {
    if (weak.length === 0) return [];
    return A2_DIAGNOSTIC.filter((q) => weak.includes(q.unit));
  }, [weak]);

  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const record = (q: A2Question, status: Status, given: string, expl: string, ai = false) => setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));
  const handleText = async (q: A2Question) => {
    if (answers[q.id]) return; const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if ((q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v))) { record(q, "right", v, q.explanation); addXp(5); return; }
    setGradingId(q.id); const g = await aiGrade(session, q.prompt, q.accept?.[0] ?? "", v);
    if (g) { record(q, g.ok ? "right" : "wrong", v, `${g.explanation || q.explanation}${g.correct ? ` (Правильно: ${g.correct})` : ""}`, true); if (g.ok) addXp(5); } else record(q, "wrong", v, q.explanation);
    setGradingId(null);
  };
  const handleMc = (q: A2Question, idx: number) => { if (answers[q.id]) return; const ok = idx === q.answerIndex; record(q, ok ? "right" : "wrong", q.options![idx], q.explanation); if (ok) addXp(5); };

  if (!game) return null;
  if (weak.length === 0) return (
    <div className="bg-qz-card border border-border rounded-2xl p-8 text-center">
      <Target className="w-12 h-12 mx-auto text-[#4255ff] mb-3" />
      <h3 className="font-bold text-lg mb-1">План пока пуст</h3>
      <p className="text-qz-text-muted text-sm">Пройдите «Диагностику» — я автоматически соберу персональный план из заданий по вашим слабым юнитам.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-sm"><b className="text-emerald-600">Ваш персональный план.</b> Собран по слабым юнитам диагностики: {weak.map((u) => `U${u}`).join(", ")}. Проработайте эти задания, затем перепройдите диагностику.</div>
      {items.map((q) => (
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
function DictationTrainer({ session }: { session: ReturnType<typeof useSession>["data"] }) {
  const [answers, setAnswers] = useState<Record<number, { ok: boolean; given: string; expl: string }>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);

  const check = async (d: typeof A2_DICTATIONS[0]) => {
    if (answers[d.id]) return;
    const v = (inputs[d.id] ?? "").trim(); if (!v) return;
    if (similarity(normalizeA2(v), normalizeA2(d.fr)) >= 0.85) { setAnswers((p) => ({ ...p, [d.id]: { ok: true, given: v, expl: `Отлично! «${d.fr}»` } })); addXp(4); return; }
    setGradingId(d.id);
    const g = await aiGrade(session, `Диктант (запиши услышанное): ${d.ru}`, d.fr, v);
    setGradingId(null);
    if (g) setAnswers((p) => ({ ...p, [d.id]: { ok: g.ok, given: v, expl: `${g.explanation || ""} Эталон: «${d.fr}»` } }));
    else setAnswers((p) => ({ ...p, [d.id]: { ok: false, given: v, expl: `Эталон: «${d.fr}»` } }));
    if (g?.ok) addXp(4);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm"><b className="text-[#4255ff]">Аудио-диктанты.</b> Нажмите 🔊, прослушайте французскую фразу и запишите её. ИИ сверит и подсветит ошибки.</div>
      {A2_DICTATIONS.map((d) => {
        const a = answers[d.id];
        return (
          <div key={d.id} className="bg-qz-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4255ff]/10 text-[#4255ff]">U{d.unit} · Диктант</span>
              <button onClick={() => browserSpeak(d.fr)} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:bg-background text-sm"><Volume2 className="w-4 h-4 text-[#4255ff]" /> Прослушать</button>
            </div>
            <div className="text-sm text-qz-text-muted mb-2">Подсказка (перевод): {d.ru}</div>
            <div className="flex gap-2 flex-wrap">
              <input type="text" disabled={!!a} value={inputs[d.id] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [d.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") check(d); }} placeholder="Запишите услышанное по-французски…" className={`flex-1 min-w-[200px] px-3 py-2.5 rounded-xl border-2 bg-background ${a ? (a.ok ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
              <button disabled={!!a || gradingId === d.id} onClick={() => check(d)} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2">{gradingId === d.id ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}</button>
            </div>
            {a && (<div className={`mt-3 text-sm font-semibold ${a.ok ? "text-green-500" : "text-red-500"}`}>{a.ok ? "✔ Верно!" : "✗ Есть ошибки."}<div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-foreground font-normal">{a.expl}</div></div>)}
          </div>
        );
      })}
    </div>
  );
}

// ───────── Ролевые диалоги ─────────
function DialogueTrainer() {
  const [active, setActive] = useState<string | null>(null);
  const dlg = A2_DIALOGUES.find((d) => d.id === active);
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
          {A2_DIALOGUES.map((d) => (<button key={d.id} onClick={() => { setActive(d.id); setStep(0); setPron({}); }} className="bg-qz-card border border-border rounded-2xl p-5 text-left hover:border-[#4255ff]/50"><MessageCircle className="w-6 h-6 text-[#4255ff] mb-2" /><div className="font-semibold">{d.title}</div><div className="text-sm text-qz-text-muted mt-1">U{d.unit} · {d.scene}</div></button>))}
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
  const items = useMemo(() => A2_DIAGNOSTIC.filter((q) => q.skill === skill), [skill]);
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

  const start = () => { setQuestions(buildExam(20)); setAnswers({}); setInputs({}); setSeconds(0); setFinished(false); setStarted(true); };
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
  const passed = score >= 50; // DELF A2 порог ~50%

  const finish = () => { setFinished(true); addXp(passed ? 30 : 10); if (passed) awardBadge("delf-a2-blanche"); setTimeout(() => document.getElementById("exam-res")?.scrollIntoView({ behavior: "smooth" }), 50); };

  if (!started) return (
    <div className="bg-qz-card border border-border rounded-2xl p-8 text-center">
      <Award className="w-12 h-12 mx-auto text-[#ffcd1f] mb-3" />
      <h3 className="font-bold text-lg mb-1">Épreuve blanche DELF A2</h3>
      <p className="text-qz-text-muted text-sm mb-4">Пробный экзамен: 20 смешанных заданий со всех юнитов, с таймером. Порог сдачи — 50% (как в DELF A2). За успех — бейдж и 30 XP.</p>
      <button onClick={start} className="px-6 py-3 rounded-xl bg-[#ffcd1f] text-[#1a1d28] font-bold flex items-center gap-2 mx-auto"><Clock className="w-4 h-4" /> Начать экзамен</button>
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
          <p className="text-qz-text-muted text-sm">{right} из {questions.length} верно за {mm}:{ss}. {passed ? "Уровень соответствует A2 — отличная работа! Бейдж получен." : "Порог DELF A2 — 50%. Проработайте «Мой план» и попробуйте снова."}</p>
          {passed && <div className="inline-flex items-center gap-2 bg-emerald-500/15 text-emerald-600 px-4 py-2 rounded-full font-semibold"><Award className="w-5 h-5" /> Сертификат: DELF A2 blanche</div>}
          <div><button onClick={start} className="px-5 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold">Пройти заново</button></div>
        </div>
      )}
    </div>
  );
}
