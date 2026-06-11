'use client';
// Коуч-режим тренажёра уровня B1–C2.

import { use } from 'react';
import Link from 'next/link';
import { LEVELS } from '@/lib/courses/niveaux';
import { CoachSession, type CoachUnit } from '@/components/courses/CoachSession';

export default function LevelCoachPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = use(params);
  const course = LEVELS[levelId];

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Курс не найден</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  const units: CoachUnit[] = course.order.map(id => ({
    id,
    title: course.units[id].title,
    exercises: course.units[id].exercises,
    vocabulary: course.units[id].vocabulary,
  }));

  return (
    <CoachSession
      courseId={course.courseId}
      courseTitle={course.title}
      units={units}
      backHref={`/dashboard/student/courses/niveau/${levelId}`}
      language="французский"
      level={course.level}
    />
  );
}
