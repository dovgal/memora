'use client';
// Экзамен юнита пользовательского курса.

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { getUnit, type UnitDetail } from '@/lib/courses/customCoursesApi';
import { ExamSession } from '@/components/courses/ExamSession';

export default function CourseExamPage({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [unit, setUnit] = useState<UnitDetail | null>(null);

  useEffect(() => {
    if (!idToken) return;
    getUnit(courseId, unitId, idToken).then(setUnit).catch(() => {});
  }, [courseId, unitId, idToken]);

  if (!unit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <ExamSession
      courseId={courseId}
      unitId={unitId}
      unitTitle={unit.title}
      exercises={unit.exercises}
      backHref={`/courses/${courseId}`}
    />
  );
}
