'use client';
// Чтение историй из лексики пользовательского курса.

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { getCourse, getUnit, type CourseDetail } from '@/lib/courses/customCoursesApi';
import type { VocabularyItem } from '@/lib/courses/edito-a1';
import { StoryReading } from '@/components/courses/StoryReading';
import { langMeta } from '@/lib/courses/langMeta';

export default function CourseReadingPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await getCourse(courseId, idToken);
        if (cancelled) return;
        setCourse(c);
        const units = await Promise.all(c.units.map(u => getUnit(courseId, u.id, idToken)));
        if (cancelled) return;
        setVocab(units.flatMap(u => u.vocabulary));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [courseId, idToken]);

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const meta = langMeta(course.language);
  return (
    <StoryReading
      title={course.title}
      backHref={`/courses/${courseId}`}
      language={meta.label}
      level={course.level || 'A1'}
      voice={meta.voice}
      vocabulary={vocab}
    />
  );
}
