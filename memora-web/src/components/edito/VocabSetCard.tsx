'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { BookMarked, Sparkles } from 'lucide-react';

const SET_TITLE = 'Edito A1 — Словарь';

export function VocabSetCard() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const [setId, setSetId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!idToken) return;
    let cancelled = false;
    fetch('/api/sets', { headers: { Authorization: `Bearer ${idToken}` } })
      .then(r => (r.ok ? r.json() : []))
      .then((sets: Array<{ id: string; title: string }>) => {
        if (cancelled) return;
        const found = sets.find(s => s.title === SET_TITLE);
        setSetId(found ? found.id : null);
      })
      .catch(() => { if (!cancelled) setSetId(null); });
    return () => { cancelled = true; };
  }, [idToken]);

  if (setId === undefined || setId === null) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-muted/30 p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4255ff]/15 flex items-center justify-center shrink-0">
            <BookMarked className="w-4 h-4 text-[#4255ff]" />
          </div>
          <div>
            <h3 className="text-foreground font-bold text-base mb-1">{SET_TITLE}</h3>
            <p className="text-qz-text-muted text-sm">
              Пройдите первый юнит — и здесь появится ваш личный набор карточек со словами и фразами,
              который будет пополняться по мере прохождения курса. Доступны все режимы memora:
              заучивание, тест, подбор, блоки и blast.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Link href={`/set/${setId}`}>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#4255ff]/20 via-[#4255ff]/5 to-transparent p-6 hover:scale-[1.01] hover:border-[#4255ff]/40 transition-all duration-200 cursor-pointer group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#4255ff]/10 rounded-full blur-3xl" />
        <div className="relative z-10 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4255ff]/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-[#4255ff]" />
          </div>
          <div className="flex-1">
            <h3 className="text-foreground font-bold text-base mb-1">{SET_TITLE}</h3>
            <p className="text-qz-text-muted text-sm mb-3">
              Личный набор слов и ключевых фраз — пополняется по мере прохождения юнитов.
              Учите карточками, заучиванием, тестом, подбором, блоками и blast.
            </p>
            <span className="text-[#4255ff] text-sm group-hover:translate-x-1 transition-transform inline-block">Открыть набор →</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
