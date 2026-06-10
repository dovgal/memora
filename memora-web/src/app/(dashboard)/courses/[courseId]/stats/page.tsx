'use client';
// Прогресс по пользовательскому курсу.

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { getCourse, getUnit } from '@/lib/courses/customCoursesApi';
import type { CoachUnit } from '@/components/courses/CoachSession';
import { CourseStats } from '@/components/courses/CourseStats';

export default function CourseStatsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [title, setTitle] = useState('Курс');
  const [units, setUnits] = useState<CoachUnit[] | null>(null);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    (async () => {
      try {
        const course = await getCourse(courseId, idToken);
        const full = await Promise.all(course.units.map(u => getUnit(courseId, u.id, idToken)));
        if (cancelled) return;
        setTitle(course.title);
        setUnits(full.map(u => ({ id: u.id, title: u.title, exercises: u.exercises, vocabulary: u.vocabulary })));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [courseId, idToken]);

  if (!units) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <CourseStats
      courseId={courseId}
      courseTitle={title}
      units={units}
      backHref={`/courses/${courseId}`}
    />
  );
}
