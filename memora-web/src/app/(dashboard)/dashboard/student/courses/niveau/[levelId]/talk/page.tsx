'use client';
// Разговорная практика тренажёра уровня B1–C2.

import { use } from 'react';
import Link from 'next/link';
import { LEVELS } from '@/lib/courses/niveaux';
import { ConversationPractice } from '@/components/courses/ConversationPractice';

export default function LevelTalkPage({ params }: { params: Promise<{ levelId: string }> }) {
  const { levelId } = use(params);
  const course = LEVELS[levelId];

  if (!course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-2xl font-bold mb-4">Курс не найден</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  return (
    <ConversationPractice
      title={course.title}
      backHref={`/dashboard/student/courses/niveau/${levelId}`}
      language="французский"
      level={course.level}
      speechLang="fr-FR"
      voice="Alain"
    />
  );
}
