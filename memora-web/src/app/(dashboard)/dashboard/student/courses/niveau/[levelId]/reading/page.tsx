'use client';
// Чтение историй из лексики тренажёра уровня B1–C2.

import { use } from 'react';
import Link from 'next/link';
import { LEVELS } from '@/lib/courses/niveaux';
import { StoryReading } from '@/components/courses/StoryReading';

export default function LevelReadingPage({ params }: { params: Promise<{ levelId: string }> }) {
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

  const vocabulary = course.order.flatMap(id => course.units[id].vocabulary ?? []);

  return (
    <StoryReading
      title={course.title}
      backHref={`/dashboard/student/courses/niveau/${levelId}`}
      language="французский"
      level={course.level}
      voice="Alain"
      vocabulary={vocabulary}
    />
  );
}
