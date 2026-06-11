'use client';
// Прогресс по тренажёру «Mettre & Remettre».

import { METTRE_UNITS, METTRE_UNIT_ORDER, METTRE_COURSE_ID } from '@/lib/courses/mettre';
import type { CoachUnit } from '@/components/courses/CoachSession';
import { CourseStats } from '@/components/courses/CourseStats';

export default function MettreStatsPage() {
  const units: CoachUnit[] = METTRE_UNIT_ORDER.map(id => ({
    id,
    title: METTRE_UNITS[id].title,
    exercises: METTRE_UNITS[id].exercises,
    vocabulary: METTRE_UNITS[id].vocabulary,
  }));

  return (
    <CourseStats
      courseId={METTRE_COURSE_ID}
      courseTitle="Mettre & Remettre"
      units={units}
      backHref="/dashboard/student/courses/mettre"
    />
  );
}
