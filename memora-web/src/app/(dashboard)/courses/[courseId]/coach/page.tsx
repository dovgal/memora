'use client';
// Коуч-режим пользовательского курса: подгружает все юниты и запускает тренера.

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { getCourse, getUnit } from '@/lib/courses/customCoursesApi';
import { CoachSession, type CoachUnit } from '@/components/courses/CoachSession';

export default function CustomCourseCoachPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [title, setTitle] = useState('Курс');
  const [meta, setMeta] = useState<{ language?: string; level?: string }>({});
  const [units, setUnits] = useState<CoachUnit[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    (async () => {
      try {
        const course = await getCourse(courseId, idToken);
        const full = await Promise.all(
          course.units.map(u => getUnit(courseId, u.id, idToken))
        );
        if (cancelled) return;
        setTitle(course.title);
        setMeta({ language: course.language, level: course.level });
        setUnits(full.map(u => ({ id: u.id, title: u.title, exercises: u.exercises, vocabulary: u.vocabulary })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Ошибка загрузки');
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, idToken]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">Не удалось загрузить курс</p>
        <p className="text-qz-text-muted text-sm mb-4">{error}</p>
        <Link href={`/courses/${courseId}`} className="text-[#4255ff] hover:underline">← К курсу</Link>
      </div>
    );
  }

  if (!units) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <CoachSession
      courseId={courseId}
      courseTitle={title}
      units={units}
      backHref={`/courses/${courseId}`}
      language={meta.language}
      level={meta.level}
    />
  );
}
