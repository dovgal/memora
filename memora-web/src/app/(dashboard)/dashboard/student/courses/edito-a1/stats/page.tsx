'use client';
// Прогресс по Édito A1.

import { EDITO_A1_UNITS, UNIT_ORDER, SPECIAL_MODULES } from '@/lib/courses/edito-a1';
import type { CoachUnit } from '@/components/courses/CoachSession';
import { CourseStats } from '@/components/courses/CourseStats';

export default function EditoStatsPage() {
  const units: CoachUnit[] = [...UNIT_ORDER, ...SPECIAL_MODULES].map(id => ({
    id,
    title: EDITO_A1_UNITS[id].title,
    exercises: EDITO_A1_UNITS[id].exercises,
    vocabulary: EDITO_A1_UNITS[id].vocabulary,
  }));

  return (
    <CourseStats
      courseId="edito-a1"
      courseTitle="Édito A1"
      units={units}
      backHref="/dashboard/student/courses/edito-a1"
    />
  );
}
