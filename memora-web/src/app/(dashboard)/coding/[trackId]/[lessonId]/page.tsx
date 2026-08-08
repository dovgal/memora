"use client";

// Страница урока: рендерится плеером на клиенте (песочницы работают в браузере).

import { use } from "react";
import { notFound } from "next/navigation";
import { getLesson } from "@/data/coding";
import LessonPlayer from "@/components/coding/LessonPlayer";

export default function LessonPage({
  params,
}: {
  params: Promise<{ trackId: string; lessonId: string }>;
}) {
  const { trackId, lessonId } = use(params);
  const found = getLesson(trackId, lessonId);
  if (!found) notFound();
  return <LessonPlayer track={found.track} lesson={found.lesson} />;
}
