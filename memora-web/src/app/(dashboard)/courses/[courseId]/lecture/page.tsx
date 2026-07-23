'use client';
// Тренажёр чтения вслух: два режима —
//  1) готовый корпус фраз, покрывающий все правила чтения;
//  2) загрузка своего текста → разбивка на фразы → проверка произношения.

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, BookOpenCheck, ListChecks, FileText } from 'lucide-react';
import { getCourse } from '@/lib/courses/customCoursesApi';
import { langMeta } from '@/lib/courses/langMeta';
import { LectureTrainer, type LectureItem } from '@/components/courses/LectureTrainer';
import { LECTURE_PHRASES } from '@/lib/courses/lecturePhrases';
import { splitIntoPhrases } from '@/lib/courses/textSplit';

type Mode = 'menu' | 'corpus' | 'custom-input' | 'custom-run';

export default function CourseLecturePage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [language, setLanguage] = useState('fr');
  const [mode, setMode] = useState<Mode>('menu');
  const [rawText, setRawText] = useState('');
  const [customItems, setCustomItems] = useState<LectureItem[]>([]);

  useEffect(() => {
    if (!idToken) return;
    getCourse(courseId, idToken).then(c => { if (c.language) setLanguage(c.language); }).catch(() => {});
  }, [courseId, idToken]);

  const meta = langMeta(language);
  const corpusItems: LectureItem[] = useMemo(
    () => LECTURE_PHRASES.map(p => ({ text: p.text, ipa: p.ipa, translation: p.translation, ruleIds: p.ruleIds })),
    [],
  );

  const startCustom = () => {
    const phrases = splitIntoPhrases(rawText);
    setCustomItems(phrases.map(text => ({ text })));
    setMode('custom-run');
  };

  const Header = (
    <div className="mb-6">
      <Link href={`/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-3">
        <ChevronLeft className="w-4 h-4" /> К курсу
      </Link>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <BookOpenCheck className="w-6 h-6 text-[#4255ff]" /> Тренажёр чтения вслух
      </h1>
    </div>
  );

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        {Header}

        {mode === 'menu' && (
          <div className="grid sm:grid-cols-2 gap-4">
            <button onClick={() => setMode('corpus')}
              className="text-left bg-qz-card border border-border rounded-2xl p-6 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all">
              <ListChecks className="w-8 h-8 text-[#4255ff] mb-3" />
              <p className="font-bold text-foreground mb-1">Все правила чтения</p>
              <p className="text-qz-text-muted text-sm">{LECTURE_PHRASES.length} фраз, подобранных так, чтобы задействовать все буквосочетания и правила произношения.</p>
            </button>
            <button onClick={() => setMode('custom-input')}
              className="text-left bg-qz-card border border-border rounded-2xl p-6 hover:border-[#4255ff]/40 hover:bg-[#4255ff]/5 transition-all">
              <FileText className="w-8 h-8 text-[#4255ff] mb-3" />
              <p className="font-bold text-foreground mb-1">Свой текст</p>
              <p className="text-qz-text-muted text-sm">Вставьте любой французский текст — он разобьётся на фразы, и вы прочитаете каждую с проверкой произношения.</p>
            </button>
          </div>
        )}

        {mode === 'corpus' && (
          <LectureTrainer items={corpusItems} voice={meta.voice} speechLang={meta.speechLang} onExit={() => setMode('menu')} />
        )}

        {mode === 'custom-input' && (
          <div className="bg-qz-card border border-border rounded-2xl p-6">
            <p className="font-semibold text-foreground mb-2">Вставьте французский текст</p>
            <p className="text-qz-text-muted text-sm mb-3">Текст разобьётся на фразы по знакам препинания. Оптимально — до ~40 фраз за сессию.</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={9}
              placeholder="Bonjour ! Je m'appelle Marie. Aujourd'hui, il fait beau et je vais au parc avec mes amis…"
              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-[#4255ff] resize-y"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-qz-text-muted text-xs">{splitIntoPhrases(rawText).length} фраз(ы) будет разобрано</span>
              <div className="flex gap-2">
                <button onClick={() => setMode('menu')} className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-xl">Назад</button>
                <button onClick={startCustom} disabled={splitIntoPhrases(rawText).length === 0}
                  className="bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
                  Начать чтение
                </button>
              </div>
            </div>
          </div>
        )}

        {mode === 'custom-run' && (
          <LectureTrainer items={customItems} voice={meta.voice} speechLang={meta.speechLang} onExit={() => setMode('menu')} />
        )}
      </div>
    </div>
  );
}
