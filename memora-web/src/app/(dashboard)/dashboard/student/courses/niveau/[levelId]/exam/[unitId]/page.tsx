'use client';
// Экзамен юнита тренажёра уровня B1–C2.

import { use } from 'react';
import Link from 'next/link';
import { LEVELS } from '@/lib/courses/niveaux';
import { ExamSession } from '@/components/courses/ExamSession';

export default function LevelExamPage({ params }: { params: Promise<{ levelId: string; unitId: string }> }) {
  const { levelId, unitId } = use(params);
  const course = LEVELS[levelId];
  const unit = course?.units[unitId];

  if (!course || !unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Юнит не найден</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  return (
    <ExamSession
      courseId={course.courseId}
      unitId={unitId}
      unitTitle={unit.title}
      exercises={unit.exercises}
      backHref={`/dashboard/student/courses/niveau/${levelId}/unit/${unitId}`}
    />
  );
}
