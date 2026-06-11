'use client';
// Чтение историй из лексики Édito A2.

import { EDITO_A2_UNITS, A2_UNIT_ORDER } from '@/lib/courses/edito-a2';
import { StoryReading } from '@/components/courses/StoryReading';

export default function EditoA2ReadingPage() {
  const vocabulary = A2_UNIT_ORDER.flatMap(id => EDITO_A2_UNITS[id].vocabulary ?? []);

  return (
    <StoryReading
      title="Édito A2"
      backHref="/dashboard/student/courses/edito-a2"
      language="французский"
      level="A2"
      voice="Alain"
      vocabulary={vocabulary}
    />
  );
}
