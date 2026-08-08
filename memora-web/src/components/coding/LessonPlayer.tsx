"use client";

// Плеер урока: теория → игровые задачи → викторина. Считает прогресс,
// начисляет XP и выдаёт бейдж за завершение урока.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Award } from "lucide-react";
import type { Lesson, Track } from "@/data/coding/types";
import { useCodingProgress, blockKey } from "@/lib/coding/progress";
import { InlineCode } from "./InlineCode";
import PyTask from "./PyTask";
import SqlTask from "./SqlTask";
import Quiz from "./Quiz";
import XpBadge from "./XpBadge";

function Theory({ block }: { block: Extract<Lesson["blocks"][number], { kind: "theory" }> }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="font-bold text-lg text-qz-text">📖 {block.title}</h3>
      {block.text.map((p, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-qz-text">
          <InlineCode text={p} />
        </p>
      ))}
      {block.code && (
        <div>
          <pre className="bg-[#111527] text-emerald-100 font-mono text-sm rounded-xl p-4 overflow-x-auto border border-zinc-700 leading-6">
            {block.code}
          </pre>
          {block.codeNote && <p className="text-xs text-qz-text-muted mt-1.5">{block.codeNote}</p>}
        </div>
      )}
    </div>
  );
}

export default function LessonPlayer({
  track,
  lesson,
}: {
  track: Track;
  lesson: Lesson;
}) {
  const { progress, ready, completeBlock, awardBadge } = useCodingProgress();
  const [justEarnedBadge, setJustEarnedBadge] = useState<string | null>(null);

  const gradedBlocks = useMemo(
    () => lesson.blocks.filter((b) => b.kind !== "theory"),
    [lesson]
  );
  const doneCount = gradedBlocks.filter((b) =>
    progress.done.includes(blockKey(track.id, lesson.id, b.id))
  ).length;
  const lessonComplete = doneCount === gradedBlocks.length && gradedBlocks.length > 0;

  const lessonIndex = track.lessons.findIndex((l) => l.id === lesson.id);
  const prev = lessonIndex > 0 ? track.lessons[lessonIndex - 1] : null;
  const next = lessonIndex < track.lessons.length - 1 ? track.lessons[lessonIndex + 1] : null;

  const handleSolved = (blockId: string, xp: number) => {
    completeBlock(track.id, lesson.id, blockId, xp);
    // Если после этого блока урок пройден целиком — бейдж за урок
    const willBeDone = gradedBlocks.every(
      (b) =>
        b.id === blockId || progress.done.includes(blockKey(track.id, lesson.id, b.id))
    );
    if (willBeDone) {
      const badgeId = `lesson-${track.id}-${lesson.id}`;
      if (awardBadge(badgeId)) setJustEarnedBadge(`${lesson.emoji} Урок «${lesson.title}» пройден!`);
      // Весь трек пройден?
      const allLessonsDone = track.lessons.every((l) =>
        l.blocks
          .filter((b) => b.kind !== "theory")
          .every(
            (b) =>
              (l.id === lesson.id && b.id === blockId) ||
              progress.done.includes(blockKey(track.id, l.id, b.id))
          )
      );
      if (allLessonsDone && awardBadge(track.finalBadge.id)) {
        setJustEarnedBadge(`${track.finalBadge.emoji} ${track.finalBadge.title}`);
      }
    }
  };

  const isDone = (blockId: string) =>
    ready && progress.done.includes(blockKey(track.id, lesson.id, blockId));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Шапка урока */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href={`/coding/${track.id}`}
          className="flex items-center gap-1.5 text-sm font-semibold text-qz-text-muted hover:text-qz-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> {track.emoji} {track.title}
        </Link>
        <XpBadge />
      </div>

      <div>
        <h1 className="text-3xl font-black text-qz-text">
          {lesson.emoji} {lesson.title}
        </h1>
        <p className="text-qz-text-muted mt-1">{lesson.subtitle}</p>
        {/* Прогресс урока */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${gradedBlocks.length ? (doneCount / gradedBlocks.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs font-bold text-qz-text-muted whitespace-nowrap">
            {doneCount} / {gradedBlocks.length} заданий
          </span>
        </div>
      </div>

      {justEarnedBadge && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/40 rounded-2xl px-5 py-4">
          <Award className="w-8 h-8 text-amber-500 shrink-0" />
          <div>
            <p className="font-bold text-qz-text">Новая награда!</p>
            <p className="text-sm text-qz-text-muted">{justEarnedBadge}</p>
          </div>
        </div>
      )}

      {/* Блоки урока */}
      {lesson.blocks.map((block) => {
        switch (block.kind) {
          case "theory":
            return <Theory key={block.id} block={block} />;
          case "py-task":
            return (
              <PyTask
                key={block.id}
                block={block}
                done={isDone(block.id)}
                onSolved={() => handleSolved(block.id, block.xp)}
              />
            );
          case "sql-task":
            return (
              <SqlTask
                key={block.id}
                block={block}
                seedSql={lesson.seedSql || ""}
                done={isDone(block.id)}
                onSolved={() => handleSolved(block.id, block.xp)}
              />
            );
          case "quiz":
            return (
              <Quiz
                key={block.id}
                block={block}
                done={isDone(block.id)}
                onSolved={() => handleSolved(block.id, block.xp)}
              />
            );
        }
      })}

      {/* Навигация между уроками */}
      <div className="flex items-center justify-between pt-4 border-t border-border gap-3">
        {prev ? (
          <Link
            href={`/coding/${track.id}/${prev.id}`}
            className="flex items-center gap-2 text-sm font-semibold text-qz-text-muted hover:text-qz-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {prev.emoji} {prev.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/coding/${track.id}/${next.id}`}
            className={`flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl transition-colors ${
              lessonComplete
                ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                : "bg-secondary text-qz-text-muted hover:text-qz-text"
            }`}
          >
            Дальше: {next.emoji} {next.title} <ArrowRight className="w-4 h-4" />
          </Link>
        ) : lessonComplete ? (
          <Link
            href={`/coding/${track.id}`}
            className="flex items-center gap-2 font-bold px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 transition-colors"
          >
            🏆 Трек пройден! К списку уроков
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
