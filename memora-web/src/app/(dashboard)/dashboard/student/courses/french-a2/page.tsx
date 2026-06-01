"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Volume2, Mic, RotateCcw, Shuffle, CheckCircle2, XCircle, Loader2,
  ChevronLeft, Sparkles, ArrowRight, BookOpen, Headphones, MessageCircle,
  GraduationCap, Brain, RefreshCw,
} from "lucide-react";
import {
  A2_UNITS, A2_DIAGNOSTIC, A2_SKILL_LABELS, normalizeA2,
  A2Question, A2Skill, A2VocabCard,
} from "@/lib/courses/frenchA2";

type Status = "right" | "wrong";
interface AnswerState { status: Status; given: string; explanation: string; aiChecked?: boolean; }
const LETTERS = ["A", "B", "C", "D"];

// ── TTS: браузерный синтез (fallback) ──
function browserSpeak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = 0.95;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.startsWith("fr"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}
// Для лексических карточек используем серверный Inworld-TTS по UUID карты (сид A2), fallback — браузер.
function vocabCardUuid(index: number): string {
  // a2-карты: префикс a2c0... + индекс
  return `a2c0a2c0-0000-4a2c-8a2c-${index.toString(16).padStart(12, "0")}`;
}
async function speakServerOrBrowser(uuid: string, fallback: string) {
  try {
    const res = await fetch(`/api/audio/${uuid}/term_audio`, { cache: "force-cache" });
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size > 0) { await new Audio(URL.createObjectURL(blob)).play(); return; }
    }
  } catch { /* fallthrough */ }
  browserSpeak(fallback);
}

// ── Levenshtein для произношения ──
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return Math.max(0, 1 - dp[n] / Math.max(m, n, 1));
}

type Tab = "diagnostic" | "grammar" | "vocab" | "listening" | "speaking";

export default function FrenchA2CoursePage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("diagnostic");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/student" className="p-2 rounded-lg hover:bg-qz-card text-qz-text-muted">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Французский язык — уровень A2</h1>
            <p className="text-qz-text-muted text-sm">Édito A2 · 12 юнитов · диагностика + тренажёры · ИИ-проверка</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            ["diagnostic", "Диагностика", GraduationCap],
            ["grammar", "Грамматика", Brain],
            ["vocab", "Лексика", BookOpen],
            ["listening", "Аудирование", Headphones],
            ["speaking", "Говорение", MessageCircle],
          ] as [Tab, string, typeof Brain][]).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                tab === t ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted hover:bg-qz-card"
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {tab === "diagnostic" && <DiagnosticTest session={session} />}
        {tab === "grammar" && <GrammarTrainer />}
        {tab === "vocab" && <VocabTrainer />}
        {tab === "listening" && <SkillTrainer session={session} skill="listening" title="Тренажёр аудирования" hint="Нажмите 🔊, послушайте и ответьте." />}
        {tab === "speaking" && <SkillTrainer session={session} skill="speaking" title="Тренажёр говорения" hint="Нажмите 🎙, произнесите фразу — мы оценим произношение." />}
      </div>
    </div>
  );
}

// ════════════════════ ДИАГНОСТИКА ════════════════════
function DiagnosticTest({ session }: { session: ReturnType<typeof useSession>["data"] }) {
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
    const v = (inputs[q.id] ?? "").trim();
    if (!v) return;
    if (checkText(q, v)) { record(q, "right", v, q.explanation); return; }
    setGradingId(q.id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.id_token) headers["Authorization"] = `Bearer ${session.id_token}`;
      const res = await fetch("/api/ai/learn/grade", {
        method: "POST", headers,
        body: JSON.stringify({
          setId: "00000000-0000-0000-0000-000000000000",
          cardId: "00000000-0000-0000-0000-000000000000",
          questionType: "translation",
          userAnswer: v,
          questionText: `${q.prompt}\nЭталон: ${q.accept?.[0] ?? ""}`,
        }),
      });
      if (res.ok) {
        const g = await res.json() as { isCorrect: boolean; explanation: string; correctAnswer: string };
        record(q, g.isCorrect ? "right" : "wrong", v, `${g.explanation || q.explanation}${g.correctAnswer ? ` (Правильно: ${g.correctAnswer})` : ""}`, true);
      } else record(q, "wrong", v, q.explanation);
    } catch { record(q, "wrong", v, q.explanation); }
    finally { setGradingId(null); }
  };

  const handleMc = (q: A2Question, idx: number) => {
    if (answers[q.id]) return;
    record(q, idx === q.answerIndex ? "right" : "wrong", q.options![idx], q.explanation);
  };

  const pronounce = async (q: A2Question) => {
    const target = q.speak || "";
    if (!target) return;
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) { alert("Распознавание речи доступно в Chrome/Edge, либо включите серверный STT."); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Rec as any)();
    rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1;
    setRecId(q.id);
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const heard = e.results[0][0].transcript;
      const score = similarity(normalizeA2(heard), normalizeA2(target));
      setPron((p) => ({ ...p, [q.id]: { ok: score >= 0.7, heard, score } }));
      setRecId(null);
    };
    rec.onerror = () => setRecId(null); rec.onend = () => setRecId(null);
    rec.start();
  };

  const reshuffle = () => { setOrder((p) => [...p].sort(() => Math.random() - 0.5)); setAnswers({}); setInputs({}); setPron({}); setShowResults(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  // итоги по юнитам
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

  return (
    <>
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm">
        <b className="text-[#4255ff]">Диагностический тест A2.</b> 45 заданий по всем 12 юнитам Édito A2 и 4 навыкам.
        Цель — выявить пробелы. После завершения вы увидите разбор по юнитам и рекомендации, какие тренажёры открыть.
      </div>

      <div className="sticky top-0 z-10 bg-background py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px] h-2.5 bg-qz-card rounded-full overflow-hidden">
          <div className="h-full bg-[#ffcd1f] transition-all" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
        <span className="text-sm font-semibold whitespace-nowrap">{answered}/{total} · <span className="text-green-500">✔ {right}</span> · <span className="text-red-500">✗ {answered - right}</span></span>
        <button onClick={reshuffle} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-qz-card"><Shuffle className="w-4 h-4" /> Перемешать</button>
      </div>

      <div className="space-y-4 mt-2">
        {questions.map((q) => {
          const ans = answers[q.id]; const pf = pron[q.id];
          return (
            <div key={q.id} className="bg-qz-card border border-border rounded-2xl p-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4255ff]/10 text-[#4255ff]">U{q.unit} · {A2_SKILL_LABELS[q.skill]} · {q.grammarPoint}</span>
                <span className="text-xs text-qz-text-muted font-semibold">№ {q.id}/{total}</span>
              </div>
              <div className="flex items-start gap-2 mb-3">
                <p className="text-lg flex-1">{q.prompt}</p>
                <button onClick={() => browserSpeak(q.speak || q.prompt)} title="Озвучить" className="p-2 rounded-lg hover:bg-background text-[#4255ff]"><Volume2 className="w-5 h-5" /></button>
              </div>

              {q.type === "mc" && (
                <div className="grid gap-2">
                  {q.options!.map((opt, j) => {
                    let cls = "border-border hover:border-[#4255ff]";
                    if (ans) { if (j === q.answerIndex) cls = "border-green-500 bg-green-500/10"; else if (opt === ans.given) cls = "border-red-500 bg-red-500/10"; else cls = "border-border opacity-70"; }
                    return (
                      <button key={j} disabled={!!ans} onClick={() => handleMc(q, j)} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 text-left transition-colors ${cls}`}>
                        <span className="font-bold text-[#4255ff] w-5">{LETTERS[j]}</span><span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "text" && (
                <div className="flex gap-2 flex-wrap">
                  <input type="text" disabled={!!ans} value={inputs[q.id] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [q.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") handleText(q); }} placeholder="Введите ответ…"
                    className={`flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border-2 bg-background ${ans ? (ans.status === "right" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
                  <button disabled={!!ans || gradingId === q.id} onClick={() => handleText(q)} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2">
                    {gradingId === q.id ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}
                  </button>
                </div>
              )}

              {q.skill === "speaking" && (
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button onClick={() => pronounce(q)} disabled={recId === q.id} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-background">
                    <Mic className={`w-4 h-4 ${recId === q.id ? "text-red-500 animate-pulse" : ""}`} /> {recId === q.id ? "Говорите…" : "Произнести"}
                  </button>
                  {pf && <span className={`text-sm ${pf.ok ? "text-green-500" : "text-amber-500"}`}>{pf.ok ? "✔" : "≈"} «{pf.heard}» ({Math.round(pf.score * 100)}%)</span>}
                </div>
              )}

              {ans && (
                <div className="mt-3">
                  <div className={`text-sm font-semibold ${ans.status === "right" ? "text-green-500" : "text-red-500"}`}>
                    {ans.status === "right" ? "✔ Верно!" : "✗ Неверно."}
                    {ans.aiChecked && <span className="ml-2 text-[#4255ff] inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> проверено ИИ</span>}
                  </div>
                  <div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-sm"><b className="text-[#4255ff]">Правило:</b> {ans.explanation}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-center py-4">
        <button onClick={() => { setShowResults(true); setTimeout(() => document.getElementById("a2-results")?.scrollIntoView({ behavior: "smooth" }), 50); }}
          className="px-6 py-3 rounded-xl bg-[#4255ff] text-white font-semibold flex items-center gap-2">Завершить диагностику <ArrowRight className="w-4 h-4" /></button>
      </div>

      {showResults && (
        <div id="a2-results" className="bg-qz-card border border-border rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-5 flex-wrap">
            <div className="w-28 h-28 rounded-full grid place-items-center shrink-0" style={{ background: `conic-gradient(#ffcd1f ${results.p}%, var(--qz-card-border,#e2e6ef) 0)` }}>
              <span className="w-[88px] h-[88px] bg-background rounded-full grid place-items-center text-2xl font-bold">{results.p}%</span>
            </div>
            <div>
              <div className="text-xl font-bold">{right} из {total} верно</div>
              <div className="text-qz-text-muted text-sm">{results.p >= 85 ? "Сильный A2 — почти готов к DELF A2!" : results.p >= 65 ? "Хороший A2, есть точечные пробелы." : results.p >= 45 ? "Базовый A2, нужна проработка." : "Рекомендуется системно пройти тренажёры."}</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">По навыкам</h3>
            <div className="grid grid-cols-2 gap-2">
              {results.skills.map((s) => (
                <div key={s.s} className="flex items-center gap-2 text-sm bg-background rounded-lg px-3 py-2">
                  <span className="flex-1">{A2_SKILL_LABELS[s.s]}</span>
                  <span className="font-semibold">{s.r}/{s.t}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.p >= 70 ? "bg-green-500/15 text-green-500" : "bg-amber-500/15 text-amber-500"}`}>{s.p}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">По юнитам Édito A2</h3>
            <div className="space-y-1.5">
              {results.units.map((u) => {
                const unit = A2_UNITS.find((x) => x.n === u.u);
                return (
                  <div key={u.u} className="flex items-center gap-2.5 text-sm">
                    <span className="w-44 shrink-0 truncate">U{u.u}. {unit?.titleRu}</span>
                    <span className="flex-1 h-2 bg-red-500/15 rounded-full overflow-hidden"><span className="block h-full bg-green-500" style={{ width: `${u.p}%` }} /></span>
                    <span className="w-10 text-right font-semibold">{u.r}/{u.t}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Рекомендации</h3>
            <div className="bg-[#4255ff]/5 rounded-lg px-3 py-2 text-sm">
              {results.weakUnits.length === 0 ? "Пробелов почти нет — закрепляйте лексику в тренажёре карточек и тренируйте говорение." : (
                <>Слабые юниты (меньше 70%): {results.weakUnits.map((u) => `U${u.u}`).join(", ")}. Откройте вкладку «Грамматика» по этим темам и «Лексика» для слов этих юнитов.</>
              )}
            </div>
          </div>

          {results.wrong.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Разбор ошибок ({results.wrong.length})</h3>
              <div className="space-y-2.5">
                {results.wrong.map((q) => {
                  const correct = q.type === "mc" ? q.options![q.answerIndex!] : q.accept![0];
                  return (
                    <div key={q.id} className="border-t border-border pt-2.5 text-sm">
                      <div className="font-semibold flex items-start gap-2"><XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" /><span>U{q.unit} · {q.grammarPoint}: {q.prompt}</span></div>
                      <div className="ml-6 mt-1">Ваш ответ: <span className="text-red-500 line-through">{answers[q.id]?.given || "—"}</span> · <span className="text-green-500 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {correct}</span></div>
                      <div className="ml-6 mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2"><b className="text-[#4255ff]">Правило:</b> {answers[q.id]?.explanation}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ════════════════════ ГРАММАТИКА (правила по юнитам) ════════════════════
function GrammarTrainer() {
  const [openUnit, setOpenUnit] = useState<number | null>(1);
  return (
    <div className="space-y-3">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm">
        <b className="text-[#4255ff]">Справочник грамматики A2.</b> Все ключевые правила Édito A2 с примерами — нажмите на юнит, чтобы раскрыть. Озвучивайте примеры кнопкой 🔊.
      </div>
      {A2_UNITS.map((u) => (
        <div key={u.n} className="bg-qz-card border border-border rounded-2xl overflow-hidden">
          <button onClick={() => setOpenUnit(openUnit === u.n ? null : u.n)} className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-background/50">
            <span className="font-semibold">U{u.n}. {u.title} <span className="text-qz-text-muted font-normal">— {u.titleRu}</span></span>
            <span className="text-xs text-qz-text-muted">{u.grammar.map((g) => g.point).join(" · ")}</span>
          </button>
          {openUnit === u.n && (
            <div className="px-5 pb-4 space-y-4">
              <div className="text-sm text-qz-text-muted">Цели: {u.objectives.join("; ")}.</div>
              {u.grammar.map((g) => (
                <div key={g.point} className="bg-background rounded-xl p-4">
                  <div className="font-semibold text-[#4255ff] mb-1">{g.point}</div>
                  <div className="text-sm mb-2">{g.rule}</div>
                  <div className="space-y-1">
                    {g.examples.map((ex, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <button onClick={() => browserSpeak(ex)} className="text-[#4255ff] shrink-0"><Volume2 className="w-4 h-4" /></button>
                        <span className="italic">{ex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ════════════════════ ЛЕКСИКА (флешкарты с TTS) ════════════════════
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

  const next = () => { setFlipped(false); setPos((p) => (p + 1) % cards.length); };
  const prev = () => { setFlipped(false); setPos((p) => (p - 1 + cards.length) % cards.length); };
  const shuffle = () => { setFlipped(false); setPos(Math.floor(Math.random() * cards.length)); };

  if (!card) return null;
  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm">
        <b className="text-[#4255ff]">Карточки лексики A2.</b> {allCards.length} слов по 12 юнитам. Нажмите на карточку, чтобы перевернуть, 🔊 — озвучить (Inworld/браузер). После деплоя сид-набора эти слова также доступны в режимах Memora с FSRS-повторением.
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { setUnitFilter("all"); setPos(0); }} className={`px-3 py-1.5 rounded-full text-sm border ${unitFilter === "all" ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>Все</button>
        {A2_UNITS.map((u) => (
          <button key={u.n} onClick={() => { setUnitFilter(u.n); setPos(0); }} className={`px-3 py-1.5 rounded-full text-sm border ${unitFilter === u.n ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>U{u.n}</button>
        ))}
      </div>

      <button onClick={() => setFlipped((f) => !f)} className="w-full bg-qz-card border border-border rounded-2xl p-10 text-center min-h-[200px] flex flex-col items-center justify-center gap-3 hover:border-[#4255ff]/40 transition-colors">
        <span className="text-xs text-qz-text-muted">U{card.unit} · {flipped ? "перевод" : "français"} · нажмите, чтобы перевернуть</span>
        <span className="text-3xl font-bold">{flipped ? card.ru : card.fr}</span>
        {!flipped && card.example && <span className="text-sm text-qz-text-muted italic">{card.example}</span>}
        <span
          onClick={(e) => { e.stopPropagation(); speakServerOrBrowser(vocabCardUuid(card.idx), card.fr); }}
          className="mt-2 inline-flex items-center gap-1.5 text-[#4255ff] text-sm cursor-pointer"
        ><Volume2 className="w-4 h-4" /> Озвучить</span>
      </button>

      <div className="flex items-center justify-between">
        <button onClick={prev} className="px-4 py-2 rounded-xl border border-border hover:bg-qz-card">← Назад</button>
        <span className="text-sm text-qz-text-muted">{(pos % cards.length) + 1} / {cards.length}</span>
        <div className="flex gap-2">
          <button onClick={shuffle} className="px-4 py-2 rounded-xl border border-border hover:bg-qz-card flex items-center gap-1.5"><RefreshCw className="w-4 h-4" /></button>
          <button onClick={next} className="px-4 py-2 rounded-xl bg-[#4255ff] text-white">Далее →</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════ АУДИРОВАНИЕ / ГОВОРЕНИЕ ════════════════════
function SkillTrainer({ session, skill, title, hint }: { session: ReturnType<typeof useSession>["data"]; skill: A2Skill; title: string; hint: string; }) {
  const items = useMemo(() => A2_DIAGNOSTIC.filter((q) => q.skill === skill), [skill]);
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [inputs, setInputs] = useState<Record<number, string>>({});
  const [pron, setPron] = useState<Record<number, { ok: boolean; heard: string; score: number }>>({});
  const [recId, setRecId] = useState<number | null>(null);
  const [gradingId, setGradingId] = useState<number | null>(null);

  const record = (q: A2Question, status: Status, given: string, expl: string, ai = false) =>
    setAnswers((p) => ({ ...p, [q.id]: { status, given, explanation: expl, aiChecked: ai } }));

  const handleText = async (q: A2Question) => {
    if (answers[q.id]) return;
    const v = (inputs[q.id] ?? "").trim(); if (!v) return;
    if ((q.accept ?? []).some((a) => normalizeA2(a) === normalizeA2(v))) { record(q, "right", v, q.explanation); return; }
    setGradingId(q.id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.id_token) headers["Authorization"] = `Bearer ${session.id_token}`;
      const res = await fetch("/api/ai/learn/grade", { method: "POST", headers, body: JSON.stringify({ setId: "00000000-0000-0000-0000-000000000000", cardId: "00000000-0000-0000-0000-000000000000", questionType: "translation", userAnswer: v, questionText: `${q.prompt}\nЭталон: ${q.accept?.[0] ?? ""}` }) });
      if (res.ok) { const g = await res.json() as { isCorrect: boolean; explanation: string; correctAnswer: string }; record(q, g.isCorrect ? "right" : "wrong", v, `${g.explanation || q.explanation}${g.correctAnswer ? ` (Правильно: ${g.correctAnswer})` : ""}`, true); }
      else record(q, "wrong", v, q.explanation);
    } catch { record(q, "wrong", v, q.explanation); } finally { setGradingId(null); }
  };

  const handleMc = (q: A2Question, idx: number) => { if (answers[q.id]) return; record(q, idx === q.answerIndex ? "right" : "wrong", q.options![idx], q.explanation); };

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

  return (
    <div className="space-y-4">
      <div className="bg-[#4255ff]/5 border border-[#4255ff]/20 rounded-xl p-4 text-sm">
        <b className="text-[#4255ff]">{title}.</b> {hint}
      </div>
      {items.map((q) => {
        const ans = answers[q.id]; const pf = pron[q.id];
        return (
          <div key={q.id} className="bg-qz-card border border-border rounded-2xl p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4255ff]/10 text-[#4255ff]">U{q.unit} · {q.grammarPoint}</span>
            </div>
            <div className="flex items-start gap-2 mb-3">
              <p className="text-lg flex-1">{q.prompt}</p>
              <button onClick={() => browserSpeak(q.speak || q.prompt)} title="Прослушать" className="p-2 rounded-lg hover:bg-background text-[#4255ff]"><Volume2 className="w-5 h-5" /></button>
            </div>

            {q.type === "mc" && (
              <div className="grid gap-2">
                {q.options!.map((opt, j) => {
                  let cls = "border-border hover:border-[#4255ff]";
                  if (ans) { if (j === q.answerIndex) cls = "border-green-500 bg-green-500/10"; else if (opt === ans.given) cls = "border-red-500 bg-red-500/10"; else cls = "border-border opacity-70"; }
                  return <button key={j} disabled={!!ans} onClick={() => handleMc(q, j)} className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 text-left ${cls}`}><span className="font-bold text-[#4255ff] w-5">{LETTERS[j]}</span><span>{opt}</span></button>;
                })}
              </div>
            )}
            {q.type === "text" && (
              <div className="flex gap-2 flex-wrap">
                <input type="text" disabled={!!ans} value={inputs[q.id] ?? ""} onChange={(e) => setInputs((p) => ({ ...p, [q.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") handleText(q); }} placeholder="Введите ответ…" className={`flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border-2 bg-background ${ans ? (ans.status === "right" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"}`} />
                <button disabled={!!ans || gradingId === q.id} onClick={() => handleText(q)} className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2">{gradingId === q.id ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}</button>
              </div>
            )}

            {skill === "speaking" && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button onClick={() => pronounce(q)} disabled={recId === q.id} className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-background"><Mic className={`w-4 h-4 ${recId === q.id ? "text-red-500 animate-pulse" : ""}`} /> {recId === q.id ? "Говорите…" : "Произнести"}</button>
                {pf && <span className={`text-sm ${pf.ok ? "text-green-500" : "text-amber-500"}`}>{pf.ok ? "✔" : "≈"} «{pf.heard}» ({Math.round(pf.score * 100)}%)</span>}
              </div>
            )}

            {ans && (
              <div className="mt-3">
                <div className={`text-sm font-semibold ${ans.status === "right" ? "text-green-500" : "text-red-500"}`}>{ans.status === "right" ? "✔ Верно!" : "✗ Неверно."}{ans.aiChecked && <span className="ml-2 text-[#4255ff] inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> ИИ</span>}</div>
                <div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-sm"><b className="text-[#4255ff]">Правило:</b> {ans.explanation}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
