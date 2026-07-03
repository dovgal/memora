'use client';
// Shadowing для пользовательского курса: фразы собираются из контента юнитов
// (фразовая лексика, диктанты, предложения sentence-builder).

import { use, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { getCourse, getUnit } from '@/lib/courses/customCoursesApi';
import { ShadowingPractice, type ShadowPhrase } from '@/components/courses/ShadowingPractice';
import { langMeta } from '@/lib/courses/langMeta';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function CourseShadowPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [title, setTitle] = useState('Курс');
  const [language, setLanguage] = useState('fr');
  const [phrases, setPhrases] = useState<ShadowPhrase[] | null>(null);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    (async () => {
      try {
        const course = await getCourse(courseId, idToken);
        const full = await Promise.all(course.units.map(u => getUnit(courseId, u.id, idToken)));
        if (cancelled) return;
        setTitle(course.title);
        setLanguage(course.language);

        const collected: ShadowPhrase[] = [];
        for (const u of full) {
          for (const v of u.vocabulary ?? []) {
            // Только фразы (2+ слова): одиночные слова для shadowing малополезны.
            if (v.fr && v.fr.trim().split(/\s+/).length >= 2) {
              collected.push({ text: v.fr, translation: v.ru });
            }
          }
          for (const ex of u.exercises) {
            if (ex.type === 'dictation' && ex.sentence) {
              collected.push({ text: ex.sentence, translation: ex.translation });
            }
            if (ex.type === 'sentence-builder') {
              for (const s of ex.sentences ?? []) {
                if (s.words.length >= 3) collected.push({ text: s.words.join(' '), translation: s.ru });
              }
            }
          }
        }
        setPhrases(shuffle(collected).slice(0, 12));
      } catch {
        if (!cancelled) setPhrases([]);
      }
    })();
    return () => { cancelled = true; };
  }, [courseId, idToken]);

  if (!phrases) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (phrases.length === 0) {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-foreground font-semibold mb-1">Пока нечего повторять</p>
          <p className="text-qz-text-muted text-sm mb-4">
            Shadowing собирает фразы из лексики юнитов, диктантов и предложений курса —
            добавьте контент, и тренажёр оживёт.
          </p>
          <Link href={`/courses/${courseId}`} className="text-[#4255ff] hover:underline text-sm">← Вернуться к курсу</Link>
        </div>
      </div>
    );
  }

  const meta = langMeta(language);
  return (
    <ShadowingPractice
      title={title}
      backHref={`/courses/${courseId}`}
      phrases={phrases}
      speechLang={meta.speechLang}
      voice={meta.voice}
    />
  );
}
