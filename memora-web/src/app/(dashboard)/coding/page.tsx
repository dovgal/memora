"use client";

// Хаб раздела «Программирование»: треки, уровень, XP, награды.

import Link from "next/link";
import { Code2, FlaskConical, ChevronRight, Award, Sparkles } from "lucide-react";
import { tracks } from "@/data/coding";
import { useCodingProgress, levelForXp, blockKey } from "@/lib/coding/progress";
import type { Track } from "@/data/coding/types";

// Полные литералы классов на каждый цвет трека — Tailwind ищет классы
// статическим сканированием исходников, поэтому собирать имя класса из
// строки на лету (`border-${accent}-500`) ненадёжно: такой класс может не
// попасть в итоговый CSS. Здесь все варианты выписаны буквально.
const TRACK_STYLE: Record<Track["color"], { border: string; bar: string }> = {
  green: { border: "hover:border-emerald-500/50", bar: "bg-gradient-to-r from-emerald-400 to-emerald-600" },
  blue: { border: "hover:border-sky-500/50", bar: "bg-gradient-to-r from-sky-400 to-sky-600" },
  purple: { border: "hover:border-purple-500/50", bar: "bg-gradient-to-r from-purple-400 to-purple-600" },
  orange: { border: "hover:border-orange-500/50", bar: "bg-gradient-to-r from-orange-400 to-orange-600" },
  teal: { border: "hover:border-teal-500/50", bar: "bg-gradient-to-r from-teal-400 to-teal-600" },
  pink: { border: "hover:border-pink-500/50", bar: "bg-gradient-to-r from-pink-400 to-pink-600" },
  cyan: { border: "hover:border-cyan-500/50", bar: "bg-gradient-to-r from-cyan-400 to-cyan-600" },
  amber: { border: "hover:border-amber-500/50", bar: "bg-gradient-to-r from-amber-400 to-amber-600" },
};

export default function CodingHubPage() {
  const { progress, ready } = useCodingProgress();
  const { current, next } = levelForXp(progress.xp);
  const pctToNext = next
    ? Math.min(100, Math.round(((progress.xp - current.minXp) / (next.minXp - current.minXp)) * 100))
    : 100;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-black text-qz-text flex items-center gap-3">
          <Code2 className="w-9 h-9 text-indigo-500" /> Программирование
        </h1>
        <p className="text-qz-text-muted mt-2 text-lg">
          Учись кодить играя: Python и настоящий PostgreSQL — прямо в браузере, без установки.
        </p>
      </div>

      {/* Уровень и XP */}
      {ready && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{current.emoji}</span>
              <div>
                <p className="font-black text-xl text-qz-text">
                  Уровень {current.level}: {current.title}
                </p>
                <p className="text-sm text-qz-text-muted flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-500" /> {progress.xp} XP
                  {next && ` · до уровня «${next.title}» ещё ${next.minXp - progress.xp} XP`}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-3 h-3 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${pctToNext}%` }}
            />
          </div>
          {progress.badges.length > 0 && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Award className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-qz-text">Наград: {progress.badges.length}</span>
            </div>
          )}
        </div>
      )}

      {/* Треки */}
      <div className="grid md:grid-cols-2 gap-5">
        {tracks.map((track) => {
          const graded = track.lessons.flatMap((l) =>
            l.blocks.filter((b) => b.kind !== "theory").map((b) => blockKey(track.id, l.id, b.id))
          );
          const doneCount = graded.filter((k) => progress.done.includes(k)).length;
          const pct = graded.length ? Math.round((doneCount / graded.length) * 100) : 0;
          const style = TRACK_STYLE[track.color];
          return (
            <Link
              key={track.id}
              href={`/coding/${track.id}`}
              className={`group bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-lg ${style.border} transition-all`}
            >
              <div className="flex items-start justify-between">
                <span className="text-5xl">{track.emoji}</span>
                <ChevronRight className="w-5 h-5 text-qz-text-muted group-hover:translate-x-1 transition-transform" />
              </div>
              <h2 className="font-black text-xl text-qz-text mt-4">{track.title}</h2>
              <p className="text-sm text-qz-text-muted mt-1">{track.tagline}</p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-qz-text-muted">{pct}%</span>
              </div>
              <p className="text-xs text-qz-text-muted mt-2">
                {track.lessons.length} уроков · {doneCount} / {graded.length} заданий решено
              </p>
            </Link>
          );
        })}
      </div>

      {/* Свободная песочница */}
      <Link
        href="/coding/playground"
        className="flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-2xl p-6 shadow-lg shadow-indigo-600/20 transition-all group"
      >
        <FlaskConical className="w-10 h-10 shrink-0" />
        <div className="flex-1">
          <h2 className="font-black text-xl">Свободная песочница</h2>
          <p className="text-indigo-100 text-sm">
            Экспериментируй без заданий: пиши любой Python-код и любые SQL-запросы
          </p>
        </div>
        <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>
  );
}
