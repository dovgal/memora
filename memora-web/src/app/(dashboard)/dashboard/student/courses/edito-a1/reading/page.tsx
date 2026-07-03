'use client';
// Чтение историй из лексики Édito A1.

import { EDITO_A1_UNITS, UNIT_ORDER } from '@/lib/courses/edito-a1';
import { StoryReading } from '@/components/courses/StoryReading';

export default function EditoReadingPage() {
  const vocabulary = UNIT_ORDER.flatMap(id => EDITO_A1_UNITS[id].vocabulary ?? []);

  return (
    <StoryReading
      title="Édito A1"
      backHref="/dashboard/student/courses/edito-a1"
      language="французский"
      level="A1"
      voice="Alain"
      vocabulary={vocabulary}
      courseId="edito-a1"
    />
  );
}
