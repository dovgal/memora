'use client';
// Коуч-режим для встроенного курса Édito A1.

import { EDITO_A1_UNITS, UNIT_ORDER, SPECIAL_MODULES } from '@/lib/courses/edito-a1';
import { CoachSession, type CoachUnit } from '@/components/courses/CoachSession';

const COURSE_ID = 'edito-a1';

export default function EditoCoachPage() {
  const units: CoachUnit[] = [...UNIT_ORDER, ...SPECIAL_MODULES].map(id => ({
    id,
    title: EDITO_A1_UNITS[id].title,
    exercises: EDITO_A1_UNITS[id].exercises,
  }));

  return (
    <CoachSession
      courseId={COURSE_ID}
      courseTitle="Édito A1"
      units={units}
      backHref="/dashboard/student/courses/edito-a1"
    />
  );
}
