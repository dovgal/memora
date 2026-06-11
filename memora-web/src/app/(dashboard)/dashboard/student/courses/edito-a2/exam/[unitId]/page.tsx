'use client';
// Экзамен юнита Édito A2.

import { use } from 'react';
import Link from 'next/link';
import { EDITO_A2_UNITS, EDITO_A2_COURSE_ID } from '@/lib/courses/edito-a2';
import { ExamSession } from '@/components/courses/ExamSession';

export default function EditoA2ExamPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = use(params);
  const unit = EDITO_A2_UNITS[unitId];

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Юнит не найден</p>
        <Link href="/dashboard/student/courses/edito-a2" className="text-emerald-400 hover:underline">← Назад к курсу</Link>
      </div>
    );
  }

  return (
    <ExamSession
      courseId={EDITO_A2_COURSE_ID}
      unitId={unitId}
      unitTitle={unit.title}
      exercises={unit.exercises}
      backHref={`/dashboard/student/courses/edito-a2/${unitId}`}
    />
  );
}
