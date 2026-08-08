"use client";

// Страница трека: вступление и карта уроков с прогрессом.

import Link from "next/link";
import { use } from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, Lock } from "lucide-react";
import { getTrack } from "@/data/coding";
import { useCodingProgress, blockKey } from "@/lib/coding/progress";
import XpBadge from "@/components/coding/XpBadge";

export default function TrackPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = use(params);
  const track = getTrack(trackId);
  const { progress, ready } = useCodingProgress();
  if (!track) notFound();

  const lessonState = track.lessons.map((l) => {
    const graded = l.blocks.filter((b) => b.kind !== "theory");
    const done = graded.filter((b) => progress.done.includes(blockKey(track.id, l.id, b.id))).length;
    return { total: graded.length, done, complete: done === graded.length && graded.length > 0 };
  });

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/coding"
          className="flex items-center gap-1.5 text-sm font-semibold text-qz-text-muted hover:text-qz-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Программирование
        </Link>
        <XpBadge />
      </div>

      <div>
        <h1 className="text-3xl font-black text-qz-text">
          {track.emoji} {track.title}
        </h1>
        <p className="text-lg text-qz-text-muted mt-1">{track.tagline}</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
        {track.intro.map((p, i) => (
          <p key={i} className="text-[15px] leading-relaxed text-qz-text">
            {p}
          </p>
        ))}
      </div>

      {/* Карта уроков */}
      <div className="space-y-3">
        {track.lessons.map((lesson, i) => {
          const st = lessonState[i];
          // Урок открыт, если предыдущий пройден (первый всегда открыт).
          // Мягкая блокировка: показываем замочек, но не запрещаем перейти.
          const prevComplete = i === 0 || lessonState[i - 1].complete;
          return (
            <Link
              key={lesson.id}
              href={`/coding/${track.id}/${lesson.id}`}
              className={`flex items-center gap-4 bg-card border rounded-2xl px-5 py-4 shadow-sm transition-all hover:shadow-md ${
                st.complete
                  ? "border-emerald-500/40"
                  : prevComplete
                  ? "border-border hover:border-indigo-400"
                  : "border-border opacity-70"
              }`}
            >
              <span className="text-3xl shrink-0">{lesson.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-qz-text">
                  Урок {i + 1}. {lesson.title}
                </p>
                <p className="text-sm text-qz-text-muted truncate">{lesson.subtitle}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {ready && st.done > 0 && !st.complete && (
                  <span className="text-xs font-bold text-qz-text-muted">
                    {st.done}/{st.total}
                  </span>
                )}
                {st.complete ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : prevComplete ? (
                  <Circle className="w-6 h-6 text-qz-text-muted" />
                ) : (
                  <Lock className="w-5 h-5 text-qz-text-muted" />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-qz-text-muted">
        🔓 Уроки лучше проходить по порядку, но заглядывать вперёд не запрещено.
      </p>
    </div>
  );
}
