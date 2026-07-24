'use client';
// Звуковая таблица курса: все звуки французского с озвучкой примеров.

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, AudioLines } from 'lucide-react';
import { getCourse } from '@/lib/courses/customCoursesApi';
import { langMeta } from '@/lib/courses/langMeta';
import { SoundBoard } from '@/components/courses/SoundBoard';

export default function CourseSoundsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [language, setLanguage] = useState('fr');

  useEffect(() => {
    if (!idToken) return;
    getCourse(courseId, idToken).then(c => { if (c.language) setLanguage(c.language); }).catch(() => {});
  }, [courseId, idToken]);

  const meta = langMeta(language);

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">
        <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-3">
          <ChevronLeft className="w-4 h-4" /> К курсу
        </Link>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2 mb-6">
          <AudioLines className="w-6 h-6 text-[#4255ff]" /> Звуки французского языка
        </h1>
        <SoundBoard voice={meta.voice} />
      </div>
    </div>
  );
}
