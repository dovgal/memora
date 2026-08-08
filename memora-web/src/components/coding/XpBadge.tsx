"use client";

// Компактный виджет: текущий уровень и XP (виден на страницах раздела).
import { Sparkles } from "lucide-react";
import { useCodingProgress, levelForXp } from "@/lib/coding/progress";

export default function XpBadge() {
  const { progress, ready } = useCodingProgress();
  if (!ready) return null;
  const { current } = levelForXp(progress.xp);
  return (
    <div className="flex items-center gap-2 bg-card border border-border rounded-full px-3.5 py-1.5 shadow-sm">
      <span className="text-lg leading-none">{current.emoji}</span>
      <span className="text-xs font-bold text-qz-text">{current.title}</span>
      <span className="flex items-center gap-1 text-xs font-bold text-amber-500">
        <Sparkles className="w-3.5 h-3.5" /> {progress.xp} XP
      </span>
    </div>
  );
}
