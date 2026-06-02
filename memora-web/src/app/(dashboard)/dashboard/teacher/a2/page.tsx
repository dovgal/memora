"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ChevronLeft, Users, Plus, Copy, BarChart3, Send, Loader2, GraduationCap, TrendingDown,
} from "lucide-react";
import {
  myClasses, createClass, teacherOverview, createAssignment, errorAnalytics,
  ClassInfo, TeacherStudent, ErrorStat,
} from "@/lib/courses/frenchA2Api";
import { A2_UNITS } from "@/lib/courses/frenchA2";

export default function TeacherA2Page() {
  const { data: session } = useSession();
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [activeClass, setActiveClass] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<TeacherStudent[]>([]);
  const [analytics, setAnalytics] = useState<ErrorStat[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);

  const idToken = session?.id_token;

  const loadClasses = useCallback(async () => {
    try { const c = await myClasses(idToken); setClasses(c); setActiveClass((prev) => prev ?? (c.length ? c[0] : null)); }
    catch { setErr("Не удалось загрузить классы. Войдите как преподаватель."); }
  }, [idToken]);
  useEffect(() => { const t = requestAnimationFrame(() => { void loadClasses(); }); return () => cancelAnimationFrame(t); }, [loadClasses]);

  useEffect(() => {
    if (!activeClass) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [s, a] = await Promise.all([teacherOverview(activeClass.id, idToken), errorAnalytics(idToken)]);
        if (alive) { setStudents(s); setAnalytics(a); }
      } catch { if (alive) setErr("Не удалось загрузить данные класса."); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [activeClass, idToken]);

  const create = async () => {
    if (!newName.trim()) return;
    try { const c = await createClass(newName.trim(), idToken); setNewName(""); await loadClasses(); setActiveClass(c); }
    catch { setErr("Не удалось создать класс."); }
  };

  const code = (c: ClassInfo) => c.joinCode || c.join_code || "";

  const assignPlan = async (st: TeacherStudent) => {
    if (!activeClass) return;
    const weak = Array.isArray(st.weak_units) ? st.weak_units : [];
    const topics = weak.length ? weak.map((u) => `U${u} ${A2_UNITS.find((x) => x.n === u)?.titleRu || ""}`) : ["Повторение всех тем A2"];
    try {
      await createAssignment(activeClass.id, st.user_id, topics, "Авто-план по слабым темам диагностики", idToken);
      setAssignMsg(`План назначен: ${st.name}`);
      setTimeout(() => setAssignMsg(null), 2500);
    } catch { setAssignMsg("Ошибка назначения"); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/teacher" className="p-2 rounded-lg hover:bg-qz-card text-qz-text-muted"><ChevronLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="w-6 h-6 text-[#4255ff]" /> Кабинет преподавателя · A2</h1>
            <p className="text-qz-text-muted text-sm">Классы, диагностики учеников, назначение планов, аналитика ошибок</p>
          </div>
        </div>

        {err && <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-sm text-amber-600">{err}</div>}

        {/* Классы */}
        <div className="bg-qz-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 font-semibold mb-3"><Users className="w-5 h-5 text-[#4255ff]" /> Мои классы</div>
          <div className="flex gap-2 flex-wrap mb-3">
            {classes.map((c) => (
              <button key={c.id} onClick={() => setActiveClass(c)} className={`px-3 py-1.5 rounded-full text-sm border ${activeClass?.id === c.id ? "bg-[#4255ff] text-white border-[#4255ff]" : "border-border text-qz-text-muted"}`}>{c.name}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название нового класса" className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-border bg-background text-sm" />
            <button onClick={create} className="px-4 py-2 rounded-lg bg-[#4255ff] text-white text-sm font-semibold flex items-center gap-1.5"><Plus className="w-4 h-4" /> Создать</button>
          </div>
          {activeClass && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-qz-text-muted">Код для учеников:</span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-600/10 text-emerald-600 font-mono font-bold tracking-wider">{code(activeClass)}</span>
              <button onClick={() => { navigator.clipboard?.writeText(code(activeClass)); }} className="text-[#4255ff]" title="Скопировать"><Copy className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        {/* Ученики */}
        <div className="bg-qz-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 font-semibold mb-3"><Users className="w-5 h-5 text-emerald-600" /> Ученики класса {loading && <Loader2 className="w-4 h-4 animate-spin" />}</div>
          {assignMsg && <div className="text-sm text-emerald-600 mb-2">{assignMsg}</div>}
          {students.length === 0 ? (
            <p className="text-sm text-qz-text-muted">Учеников пока нет. Дайте им код класса — они вступят на вкладке «Прогресс» в курсе A2.</p>
          ) : (
            <div className="space-y-2">
              {students.map((st) => {
                const weak = Array.isArray(st.weak_units) ? st.weak_units : [];
                return (
                  <div key={st.user_id} className="flex items-center gap-3 bg-background rounded-lg px-3 py-2.5 text-sm flex-wrap">
                    <span className="flex-1 min-w-[120px] font-medium">{st.name}</span>
                    <span className="text-qz-text-muted">XP: {st.xp}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${st.last_score == null ? "bg-zinc-500/15 text-zinc-500" : st.last_score >= 70 ? "bg-green-500/15 text-green-500" : "bg-amber-500/15 text-amber-500"}`}>
                      {st.last_score == null ? "нет диагностики" : `диагностика ${st.last_score}%`}
                    </span>
                    {weak.length > 0 && <span className="text-xs text-qz-text-muted">слабые: {weak.map((u) => `U${u}`).join(", ")}</span>}
                    <button onClick={() => assignPlan(st)} className="px-3 py-1 rounded-full bg-[#4255ff] text-white text-xs font-semibold flex items-center gap-1"><Send className="w-3 h-3" /> Назначить план</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Аналитика ошибок */}
        <div className="bg-qz-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 font-semibold mb-3"><BarChart3 className="w-5 h-5 text-red-500" /> Аналитика ошибок (по всем ученикам)</div>
          {analytics.length === 0 ? (
            <p className="text-sm text-qz-text-muted">Пока недостаточно данных. Статистика появляется после прохождения учениками заданий (от 3 попыток на тему).</p>
          ) : (
            <div className="space-y-1.5">
              {analytics.map((s) => (
                <div key={s.grammar_point} className="flex items-center gap-3 text-sm">
                  <TrendingDown className={`w-4 h-4 ${s.error_rate >= 50 ? "text-red-500" : "text-amber-500"}`} />
                  <span className="flex-1 truncate">{s.grammar_point}</span>
                  <span className="flex-1 h-2 bg-green-500/15 rounded-full overflow-hidden max-w-[160px]"><span className="block h-full bg-red-500" style={{ width: `${s.error_rate}%` }} /></span>
                  <span className="w-24 text-right text-xs text-qz-text-muted">{s.error_rate}% ошибок ({s.errors}/{s.attempts})</span>
                </div>
              ))}
              <p className="text-xs text-qz-text-muted mt-2">Темы вверху — самые проблемные: на них стоит сделать акцент в курсе.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
