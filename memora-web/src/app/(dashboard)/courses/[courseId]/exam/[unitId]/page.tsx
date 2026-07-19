'use client';
// Экзамен юнита пользовательского курса.

import { use, useEffect, useState, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2 } from 'lucide-react';
import { getUnit, getCourse, getTranslatedUnit, type UnitDetail } from '@/lib/courses/customCoursesApi';
import { ExamSession } from '@/components/courses/ExamSession';
import { UnitLangToggle } from '@/components/courses/UnitLangToggle';

export default function CourseExamPage({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [baseUnit, setBaseUnit] = useState<UnitDetail | null>(null);
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [language, setLanguage] = useState('fr');
  const [uiLang, setUiLang] = useState('orig');
  const [translating, setTranslating] = useState(false);
  const transCache = useRef<Record<string, UnitDetail>>({});

  useEffect(() => {
    if (!idToken) return;
    getUnit(courseId, unitId, idToken).then(u => { setBaseUnit(u); setUnit(u); }).catch(() => {});
    getCourse(courseId, idToken).then(c => { if (c.language) setLanguage(c.language); }).catch(() => {});
  }, [courseId, unitId, idToken]);

  const switchLang = useCallback(async (lang: string) => {
    if (lang === uiLang || !baseUnit) return;
    if (lang === 'orig') { setUiLang('orig'); setUnit(baseUnit); return; }
    setUiLang(lang);
    const cached = transCache.current[lang];
    if (cached) { setUnit(cached); return; }
    setTranslating(true);
    try {
      const t = await getTranslatedUnit(courseId, unitId, lang, idToken);
      transCache.current[lang] = t;
      setUnit(t);
    } catch {
      setUiLang('orig'); setUnit(baseUnit);
      alert('Не удалось перевести экзамен. Попробуйте ещё раз.');
    }
    setTranslating(false);
  }, [uiLang, baseUnit, courseId, unitId, idToken]);

  if (!unit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <ExamSession
      // key пересобирает сессию (вопросы) при смене языка
      key={uiLang}
      courseId={courseId}
      unitId={unitId}
      unitTitle={unit.title}
      exercises={unit.exercises}
      backHref={`/courses/${courseId}`}
      langToggle={<UnitLangToggle uiLang={uiLang} target={language} onSwitch={switchLang} loading={translating} />}
    />
  );
}
