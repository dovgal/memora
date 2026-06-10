'use client';
// Экзамен юнита Édito A1.

import { use } from 'react';
import Link from 'next/link';
import { EDITO_A1_UNITS } from '@/lib/courses/edito-a1';
import { ExamSession } from '@/components/courses/ExamSession';

export default function EditoExamPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = use(params);
  const unit = EDITO_A1_UNITS[unitId];

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Юнит не найден</p>
        <Link href="/dashboard/student/courses/edito-a1" className="text-[#4255ff] hover:underline">← Назад к курсу</Link>
      </div>
    );
  }

  return (
    <ExamSession
      courseId="edito-a1"
      unitId={unitId}
      unitTitle={unit.title}
      exercises={unit.exercises}
      backHref={`/dashboard/student/courses/edito-a1/${unitId}`}
    />
  );
}
