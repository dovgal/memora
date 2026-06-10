'use client';
// Разговорная практика для пользовательского курса.

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { getCourse, type CourseDetail } from '@/lib/courses/customCoursesApi';
import { ConversationPractice } from '@/components/courses/ConversationPractice';
import { langMeta } from '@/lib/courses/langMeta';

export default function CourseTalkPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [course, setCourse] = useState<CourseDetail | null>(null);

  useEffect(() => {
    if (!idToken) return;
    getCourse(courseId, idToken).then(setCourse).catch(() => {});
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
    <ConversationPractice
      title={course.title}
      backHref={`/courses/${courseId}`}
      language={meta.label}
      level={course.level || 'A1'}
      speechLang={meta.speechLang}
      voice={meta.voice}
    />
  );
}
