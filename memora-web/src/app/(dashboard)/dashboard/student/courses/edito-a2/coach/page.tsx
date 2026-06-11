'use client';
// Коуч-режим для тренажёра Édito A2.

import { EDITO_A2_UNITS, A2_UNIT_ORDER, EDITO_A2_COURSE_ID } from '@/lib/courses/edito-a2';
import { CoachSession, type CoachUnit } from '@/components/courses/CoachSession';

export default function EditoA2CoachPage() {
  const units: CoachUnit[] = A2_UNIT_ORDER.map(id => ({
    id,
    title: EDITO_A2_UNITS[id].title,
    exercises: EDITO_A2_UNITS[id].exercises,
    vocabulary: EDITO_A2_UNITS[id].vocabulary,
  }));

  return (
    <CoachSession
      courseId={EDITO_A2_COURSE_ID}
      courseTitle="Édito A2"
      units={units}
      backHref="/dashboard/student/courses/edito-a2"
      language="французский"
      level="A2"
    />
  );
}
