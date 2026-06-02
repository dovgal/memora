"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Volume2, Mic, RotateCcw, Shuffle, CheckCircle2, XCircle,
  Loader2, ChevronLeft, Sparkles, ArrowRight,
} from "lucide-react";
import {
  FRENCH_A1_QUESTIONS, A1_CATEGORIES, normalizeAnswer, A1Question,
} from "@/lib/courses/frenchA1";
import { speakCardInworld } from "@/lib/courses/ttsInworld";

type Status = "right" | "wrong";

interface AnswerState {
  status: Status;
  given: string;       // что ответил пользователь (текст)
  explanation: string; // объяснение (из банка или от ИИ)
  aiChecked?: boolean;
}

const LETTERS = ["A", "B", "C", "D"];

// UUID карты в сид-наборе детерминирован от id вопроса (см. миграцию seed_french_a1_course).
function cardUuid(questionId: number): string {
  return `a1a1a1a1-0000-4a1a-8a1a-${questionId.toString(16).padStart(12, "0")}`;
}

// Озвучивание ТОЛЬКО через Inworld.ai: кэш карты в БД, иначе общий /api/tts.
// Браузерный SpeechSynthesis не используется (низкое качество).
async function speakQuestion(questionId: number, text: string) {
  await speakCardInworld(cardUuid(questionId), text);
}

export default function FrenchA1CoursePage() {
  const { data: session } = useSession();

  // Перемешиваемый порядок вопросов (для «смены заданий»)
  const [order, setOrder] = useState<number[]>(() => FRENCH_A1_QUESTIONS.map((_, i) => i));
  const [filter, setFilter] = useState<string>("Все");
  const [answers, setAnswers] = useState<Record<number, AnswerState>>({});
  const [textInputs, setTextInputs] = useState<Record<number, string>>({});
  const [gradingId, setGradingId] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);

  // Произношение
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [pronFeedback, setPronFeedback] = useState<Record<number, { ok: boolean; heard: string; score: number }>>({});
  const recognitionRef = useRef<unknown>(null);

  const questions = useMemo(() => order.map((i) => FRENCH_A1_QUESTIONS[i]), [order]);
  const visible = useMemo(
    () => (filter === "Все" ? questions : questions.filter((q) => q.category === filter)),
    [questions, filter]
  );

  const total = FRENCH_A1_QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;
  const rightCount = Object.values(answers).filter((a) => a.status === "right").length;

  // ---- Проверка ответа ----
  const recordAnswer = useCallback((q: A1Question, status: Status, given: string, explanation: string, aiChecked = false) => {
    setAnswers((prev) => ({ ...prev, [q.id]: { status, given, explanation, aiChecked } }));
  }, []);

  const handleMc = (q: A1Question, idx: number) => {
    if (answers[q.id]) return;
    const ok = idx === q.answerIndex;
    recordAnswer(q, ok ? "right" : "wrong", q.options![idx], q.explanation);
  };

  const localCheckText = (q: A1Question, value: string): boolean => {
    const v = normalizeAnswer(value);
    return (q.accept ?? []).some((a) => normalizeAnswer(a) === v);
  };

  // Текстовый ответ: сначала локально, при несовпадении — ИИ (Ollama)
  const handleText = async (q: A1Question) => {
    if (answers[q.id]) return;
    const value = (textInputs[q.id] ?? "").trim();
    if (!value) return;

    if (localCheckText(q, value)) {
      recordAnswer(q, "right", value, q.explanation);
      return;
    }

    // Локально не совпало — спросим у ИИ (семантическая проверка)
    setGradingId(q.id);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.id_token) headers["Authorization"] = `Bearer ${session.id_token}`;
      const res = await fetch("/api/ai/learn/grade", {
        method: "POST",
        headers,
        body: JSON.stringify({
          setId: "00000000-0000-0000-0000-000000000000",
          cardId: "00000000-0000-0000-0000-000000000000",
          questionType: q.type === "text" ? "translation" : "grammar",
          userAnswer: value,
          questionText: `${q.prompt}\nЭталонный ответ: ${q.accept?.[0] ?? ""}`,
        }),
      });
      if (res.ok) {
        const g = await res.json() as { isCorrect: boolean; explanation: string; correctAnswer: string };
        const expl = `${g.explanation || q.explanation}${g.correctAnswer ? ` (Правильно: ${g.correctAnswer})` : ""}`;
        recordAnswer(q, g.isCorrect ? "right" : "wrong", value, expl, true);
      } else {
        // ИИ недоступен — засчитываем по строгой проверке как неверно
        recordAnswer(q, "wrong", value, q.explanation);
      }
    } catch {
      recordAnswer(q, "wrong", value, q.explanation);
    } finally {
      setGradingId(null);
    }
  };

  // ---- Смена заданий ----
  const reshuffle = () => {
    setOrder((prev) => [...prev].sort(() => Math.random() - 0.5));
    setAnswers({});
    setTextInputs({});
    setPronFeedback({});
    setShowResults(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetAll = () => {
    setAnswers({});
    setTextInputs({});
    setPronFeedback({});
    setShowResults(false);
    setFilter("Все");
  };

  // Запись 3 сек + отправка на серверный STT. Возвращает true, если сервер ответил.
  const recordAndTranscribe = async (q: A1Question, target: string): Promise<boolean> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks: BlobPart[] = [];
    const mr = new MediaRecorder(stream);
    setRecordingId(q.id);

    const stopped: Promise<Blob> = new Promise((resolve) => {
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mr.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));
    });
    mr.start();
    await new Promise((r) => setTimeout(r, 3000));
    mr.stop();
    stream.getTracks().forEach((t) => t.stop());

    const blob = await stopped;
    const fd = new FormData();
    fd.append("audio", blob, "speech.webm");
    fd.append("expected", target);
    fd.append("lang", "fr");

    const headers: Record<string, string> = {};
    if (session?.id_token) headers["Authorization"] = `Bearer ${session.id_token}`;

    const res = await fetch("/api/audio/transcribe", { method: "POST", headers, body: fd });
    setRecordingId(null);
    if (!res.ok) return false; // STT не включён на сервере → фоллбэк
    const data = await res.json() as { transcript: string; similarity: number; isCorrect?: boolean; is_correct?: boolean };
    const ok = data.isCorrect ?? data.is_correct ?? data.similarity >= 0.7;
    setPronFeedback((prev) => ({ ...prev, [q.id]: { ok, heard: data.transcript, score: data.similarity } }));
    return true;
  };

  // ---- Произношение ----
  // Сначала пробуем серверный STT (whisper, /api/audio/transcribe). Если он недоступен —
  // откатываемся к браузерному Web Speech API (fr-FR).
  const startPronunciation = async (q: A1Question) => {
    const target = q.speak || q.options?.[q.answerIndex ?? 0] || q.accept?.[0] || "";
    if (!target) return;

    // 1. Пробуем записать через MediaRecorder и отправить на сервер.
    const canRecord = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    if (canRecord) {
      try {
        const ok = await recordAndTranscribe(q, target);
        if (ok) return; // успешно проверили на сервере
      } catch {
        // упадём в браузерный путь ниже
      }
    }

    // 2. Fallback: Web Speech API.
    const SR = (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown });
    const Rec = SR.SpeechRecognition || SR.webkitSpeechRecognition;
    if (!Rec) {
      alert("Распознавание речи недоступно. Используйте Chrome/Edge, либо включите серверный STT (whisper) на бэкенде.");
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new (Rec as any)();
    rec.lang = "fr-FR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    recognitionRef.current = rec;
    setRecordingId(q.id);

    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const heard = e.results[0][0].transcript;
      const a = normalizeAnswer(heard);
      const b = normalizeAnswer(target);
      const score = similarity(a, b);
      setPronFeedback((prev) => ({ ...prev, [q.id]: { ok: score >= 0.7, heard, score } }));
      setRecordingId(null);
    };
    rec.onerror = () => setRecordingId(null);
    rec.onend = () => setRecordingId(null);
    rec.start();
  };

  // ---- Итоги ----
  const results = useMemo(() => {
    const byCat: Record<string, { r: number; t: number }> = {};
    FRENCH_A1_QUESTIONS.forEach((q) => {
      byCat[q.category] = byCat[q.category] || { r: 0, t: 0 };
      byCat[q.category].t++;
      if (answers[q.id]?.status === "right") byCat[q.category].r++;
    });
    const cats = Object.entries(byCat).map(([c, v]) => ({ c, r: v.r, t: v.t, p: Math.round((v.r / v.t) * 100) }));
    const weak = cats.filter((x) => x.p < 70).sort((a, b) => a.p - b.p);
    const wrong = FRENCH_A1_QUESTIONS.filter((q) => answers[q.id]?.status === "wrong");
    const p = Math.round((rightCount / total) * 100);
    return { cats: cats.sort((a, b) => a.p - b.p), weak, wrong, p };
  }, [answers, rightCount, total]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard/student" className="p-2 rounded-lg hover:bg-qz-card text-qz-text-muted">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Французский язык — уровень A1</h1>
            <p className="text-qz-text-muted text-sm">100 заданий · озвучивание · произношение · ИИ-проверка</p>
          </div>
        </div>

        {/* Sticky bar */}
        <div className="sticky top-0 z-10 bg-background py-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px] h-2.5 bg-qz-card rounded-full overflow-hidden">
            <div className="h-full bg-[#ffcd1f] transition-all" style={{ width: `${answeredCount}%` }} />
          </div>
          <span className="text-sm font-semibold whitespace-nowrap">
            {answeredCount}/100 · <span className="text-green-500">✔ {rightCount}</span> ·{" "}
            <span className="text-red-500">✗ {answeredCount - rightCount}</span>
          </span>
          <button onClick={reshuffle} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-qz-card">
            <Shuffle className="w-4 h-4" /> Сменить задания
          </button>
          <button onClick={resetAll} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-qz-card">
            <RotateCcw className="w-4 h-4" /> Сброс
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {["Все", ...A1_CATEGORIES].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                filter === cat ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted hover:bg-qz-card"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {visible.map((q) => {
            const ans = answers[q.id];
            const pron = pronFeedback[q.id];
            return (
              <div key={q.id} className="bg-qz-card border border-border rounded-2xl p-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#4255ff]/10 text-[#4255ff]">{q.category}</span>
                  <span className="text-xs text-qz-text-muted font-semibold">№ {q.id} / 100</span>
                </div>

                <div className="flex items-start gap-2 mb-3">
                  <p className="text-lg flex-1">{q.prompt}</p>
                  <button onClick={() => speakQuestion(q.id, q.speak || q.prompt)} title="Озвучить (Inworld)" className="p-2 rounded-lg hover:bg-background text-[#4255ff]">
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>

                {/* MC */}
                {q.type === "mc" && (
                  <div className="grid gap-2">
                    {q.options!.map((opt, j) => {
                      let cls = "border-border hover:border-[#4255ff]";
                      if (ans) {
                        if (j === q.answerIndex) cls = "border-green-500 bg-green-500/10";
                        else if (opt === ans.given) cls = "border-red-500 bg-red-500/10";
                        else cls = "border-border opacity-70";
                      }
                      return (
                        <button
                          key={j}
                          disabled={!!ans}
                          onClick={() => handleMc(q, j)}
                          className={`flex items-center gap-3 border-2 rounded-xl px-3 py-2.5 text-left transition-colors ${cls}`}
                        >
                          <span className="font-bold text-[#4255ff] w-5">{LETTERS[j]}</span>
                          <span>{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* TEXT */}
                {q.type === "text" && (
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="text"
                      disabled={!!ans}
                      value={textInputs[q.id] ?? ""}
                      onChange={(e) => setTextInputs((p) => ({ ...p, [q.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") handleText(q); }}
                      placeholder="Введите ответ…"
                      className={`flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border-2 bg-background ${
                        ans ? (ans.status === "right" ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10") : "border-border"
                      }`}
                    />
                    <button
                      disabled={!!ans || gradingId === q.id}
                      onClick={() => handleText(q)}
                      className="px-4 py-2.5 rounded-xl bg-[#4255ff] text-white font-semibold disabled:opacity-60 flex items-center gap-2"
                    >
                      {gradingId === q.id ? <><Loader2 className="w-4 h-4 animate-spin" /> ИИ…</> : "Проверить"}
                    </button>
                  </div>
                )}

                {/* Pronunciation */}
                <div className="mt-3 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => startPronunciation(q)}
                    disabled={recordingId === q.id}
                    className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-border hover:bg-background"
                  >
                    <Mic className={`w-4 h-4 ${recordingId === q.id ? "text-red-500 animate-pulse" : ""}`} />
                    {recordingId === q.id ? "Говорите…" : "Произнести"}
                  </button>
                  {pron && (
                    <span className={`text-sm ${pron.ok ? "text-green-500" : "text-amber-500"}`}>
                      {pron.ok ? "✔" : "≈"} услышано: «{pron.heard}» ({Math.round(pron.score * 100)}%)
                    </span>
                  )}
                </div>

                {/* Feedback */}
                {ans && (
                  <div className="mt-3">
                    <div className={`text-sm font-semibold ${ans.status === "right" ? "text-green-500" : "text-red-500"}`}>
                      {ans.status === "right" ? "✔ Верно!" : "✗ Неверно."}
                      {ans.aiChecked && <span className="ml-2 text-[#4255ff] inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> проверено ИИ</span>}
                    </div>
                    <div className="mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2 text-sm">
                      <b className="text-[#4255ff]">Почему:</b> {ans.explanation}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Finish */}
        <div className="flex justify-center py-4">
          <button onClick={() => { setShowResults(true); if (typeof window !== "undefined") setTimeout(() => document.getElementById("a1-results")?.scrollIntoView({ behavior: "smooth" }), 50); }}
            className="px-6 py-3 rounded-xl bg-[#4255ff] text-white font-semibold flex items-center gap-2">
            Завершить тест и посмотреть результат <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {showResults && (
          <div id="a1-results" className="bg-qz-card border border-border rounded-2xl p-6 space-y-5">
            <div className="flex items-center gap-5 flex-wrap">
              <div
                className="w-28 h-28 rounded-full grid place-items-center shrink-0"
                style={{ background: `conic-gradient(#ffcd1f ${results.p}%, var(--qz-card-border, #e2e6ef) 0)` }}
              >
                <span className="w-[88px] h-[88px] bg-background rounded-full grid place-items-center text-2xl font-bold">{results.p}%</span>
              </div>
              <div>
                <div className="text-xl font-bold">{rightCount} из {total} верно</div>
                <div className="text-qz-text-muted text-sm">
                  {results.p >= 90 ? "Отличный результат — A1 уверенно освоен!"
                    : results.p >= 75 ? "Хороший результат — база A1 есть."
                    : results.p >= 50 ? "Средний результат — есть пробелы."
                    : "Стоит повторить базовые темы A1."}
                </div>
                {answeredCount < total && (
                  <div className="text-amber-500 text-sm mt-1">⚠ Без ответа: {total - answeredCount} (засчитаны как неверные).</div>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Результат по темам</h3>
              <div className="space-y-1.5">
                {results.cats.map((x) => (
                  <div key={x.c} className="flex items-center gap-2.5 text-sm">
                    <span className="w-40 shrink-0">{x.c}</span>
                    <span className="flex-1 h-2 bg-red-500/15 rounded-full overflow-hidden">
                      <span className="block h-full bg-green-500" style={{ width: `${x.p}%` }} />
                    </span>
                    <span className="w-12 text-right font-semibold">{x.r}/{x.t}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Что повторить</h3>
              {results.weak.length === 0 ? (
                <div className="bg-[#4255ff]/5 rounded-lg px-3 py-2 text-sm">Слабых тем нет — отличное владение всеми разделами A1!</div>
              ) : (
                <div className="bg-[#4255ff]/5 rounded-lg px-3 py-2 text-sm">
                  Рекомендуем повторить темы (меньше 70% верных):
                  <ul className="list-disc ml-5 mt-1.5 space-y-1">
                    {results.weak.map((x) => (<li key={x.c}><b>{x.c}</b> — {x.r}/{x.t} ({x.p}%)</li>))}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold mb-2">Разбор ошибок ({results.wrong.length})</h3>
              {results.wrong.length === 0 ? (
                <p className="text-green-500 font-semibold text-sm">Ошибок нет — поздравляем! 🎉</p>
              ) : (
                <div className="space-y-2.5">
                  {results.wrong.map((q) => {
                    const correct = q.type === "mc" ? q.options![q.answerIndex!] : q.accept![0];
                    return (
                      <div key={q.id} className="border-t border-border pt-2.5 text-sm">
                        <div className="font-semibold flex items-start gap-2">
                          <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                          <span>№{q.id} · {q.category}: {q.prompt}</span>
                        </div>
                        <div className="ml-6 mt-1">
                          Ваш ответ: <span className="text-red-500 line-through">{answers[q.id]?.given || "—"}</span> ·{" "}
                          <span className="text-green-500 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> {correct}</span>
                        </div>
                        <div className="ml-6 mt-1.5 bg-[#4255ff]/5 border-l-[3px] border-[#4255ff] rounded-r-lg px-3 py-2">
                          <b className="text-[#4255ff]">Почему:</b> {answers[q.id]?.explanation}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Похожесть двух строк (по словам, для оценки произношения)
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const wordsA = a.split(" ");
  const wordsB = b.split(" ");
  const setB = new Set(wordsB);
  const matches = wordsA.filter((w) => setB.has(w)).length;
  const denom = Math.max(wordsA.length, wordsB.length) || 1;
  // комбинируем покрытие слов и грубое посимвольное сходство
  const charSim = 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);
  return Math.max(matches / denom, charSim);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}
