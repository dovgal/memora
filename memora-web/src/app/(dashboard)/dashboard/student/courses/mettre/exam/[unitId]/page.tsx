'use client';
// Экзамен модуля тренажёра «Mettre & Remettre».

import { use } from 'react';
import Link from 'next/link';
import { METTRE_UNITS, METTRE_COURSE_ID } from '@/lib/courses/mettre';
import { ExamSession } from '@/components/courses/ExamSession';

export default function MettreExamPage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId } = use(params);
  const unit = METTRE_UNITS[unitId];

  if (!unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Модуль не найден</p>
        <Link href="/dashboard/student/courses/mettre" className="text-rose-400 hover:underline">← Назад к курсу</Link>
      </div>
    );
  }

  return (
    <ExamSession
      courseId={METTRE_COURSE_ID}
      unitId={unitId}
      unitTitle={unit.title}
      exercises={unit.exercises}
      backHref={`/dashboard/student/courses/mettre/${unitId}`}
    />
  );
}
