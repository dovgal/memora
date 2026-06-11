'use client';
// Коуч-режим для тренажёра «Mettre & Remettre».

import { METTRE_UNITS, METTRE_UNIT_ORDER, METTRE_COURSE_ID } from '@/lib/courses/mettre';
import { CoachSession, type CoachUnit } from '@/components/courses/CoachSession';

export default function MettreCoachPage() {
  const units: CoachUnit[] = METTRE_UNIT_ORDER.map(id => ({
    id,
    title: METTRE_UNITS[id].title,
    exercises: METTRE_UNITS[id].exercises,
    vocabulary: METTRE_UNITS[id].vocabulary,
  }));

  return (
    <CoachSession
      courseId={METTRE_COURSE_ID}
      courseTitle="Mettre & Remettre"
      units={units}
      backHref="/dashboard/student/courses/mettre"
      language="французский"
      level="A2-B1"
    />
  );
}
