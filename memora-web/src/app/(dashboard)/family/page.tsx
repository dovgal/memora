'use client';
// Семейное табло: XP, серии и прогресс всех членов семьи.
// Для семейного масштаба это и лидерборд (соревнуемся внутри семьи),
// и отчёт наставника: клик по участнику раскрывает разбивку по курсам
// со слабыми местами.

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Trophy, Loader2, Flame, ChevronDown, ChevronUp, AlertTriangle, GraduationCap,
} from 'lucide-react';
import {
  getFamilyBoard, getMemberCourses, levelFromXp,
  type FamilyMember, type MemberCourse,
} from '@/lib/familyApi';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Красивые имена встроенных курсов; UUID-курсы приходят с title с сервера. */
const BUILTIN_TITLES: Record<string, string> = {
  'edito-a1': 'Édito A1',
  'edito-a2': 'Édito A2',
  'mettre': 'Глагол mettre',
};

function courseTitle(c: MemberCourse): string {
  if (c.title) return c.title;
  if (BUILTIN_TITLES[c.courseId]) return BUILTIN_TITLES[c.courseId];
  if (c.courseId.startsWith('niveau-')) return `Тренажёр ${c.courseId.replace('niveau-', '').toUpperCase()}`;
  return c.courseId;
}

export default function FamilyPage() {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [members, setMembers] = useState<FamilyMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [courses, setCourses] = useState<Record<string, MemberCourse[]>>({});

  useEffect(() => {
    if (!idToken) return;
    getFamilyBoard(idToken).then(setMembers).catch(e => setError(e.message));
  }, [idToken]);

  const toggleMember = async (userId: string) => {
    if (openId === userId) { setOpenId(null); return; }
    setOpenId(userId);
    if (!courses[userId] && idToken) {
      try {
        const c = await getMemberCourses(userId, idToken);
        setCourses(prev => ({ ...prev, [userId]: c }));
      } catch { /* покажем пустой список */ }
    }
  };

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#ffcd1f]/15 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-[#ffcd1f]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Семейное табло</h1>
            <p className="text-qz-text-muted text-sm">XP за каждое повторение в коуче — любой курс, любой предмет</p>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {!members ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-qz-text-muted" /></div>
        ) : members.length === 0 ? (
          <p className="text-qz-text-muted text-sm text-center py-6">Пока никого нет.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m, i) => (
              <div key={m.userId} className="bg-qz-card border border-border rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleMember(m.userId)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="text-xl w-8 text-center shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
                  <span className="flex-1 min-w-0">
                    <span className="text-foreground text-sm font-semibold line-clamp-1">{m.name}</span>
                    <span className="text-qz-text-muted text-xs flex items-center gap-3 mt-0.5">
                      <span className="inline-flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-amber-400" />{m.streakDays} дн.</span>
                      <span>сегодня: {m.todayReviews}</span>
                      <span className="inline-flex items-center gap-1"><GraduationCap className="w-3.5 h-3.5 text-emerald-400" />{m.learnedCount}</span>
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="text-foreground font-bold">{m.xp.toLocaleString('ru-RU')} XP</span>
                    <span className="block text-[#4255ff] text-xs font-semibold">Ур. {levelFromXp(m.xp)}</span>
                  </span>
                  {openId === m.userId ? <ChevronUp className="w-4 h-4 text-qz-text-muted shrink-0" /> : <ChevronDown className="w-4 h-4 text-qz-text-muted shrink-0" />}
                </button>

                {openId === m.userId && (
                  <div className="border-t border-border px-4 py-3">
                    {!courses[m.userId] ? (
                      <p className="text-qz-text-muted text-xs flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Загружаю курсы…</p>
                    ) : courses[m.userId].length === 0 ? (
                      <p className="text-qz-text-muted text-xs">Ещё не занимался в коуче.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {courses[m.userId].map(c => (
                          <div key={c.courseId} className="flex items-center gap-3 text-sm">
                            <span className="text-foreground flex-1 min-w-0 line-clamp-1">{courseTitle(c)}</span>
                            <span className="text-qz-text-muted text-xs shrink-0">{c.totalReviews} повт. · усвоено {c.learned}</span>
                            {c.weakCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-amber-400 text-xs shrink-0" title="Слабые места за 30 дней">
                                <AlertTriangle className="w-3.5 h-3.5" />{c.weakCount}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-qz-text-muted text-xs mt-6">
          XP начисляется за каждое повторение: «Легко» 12 · «Хорошо» 10 · «Трудно» 5 · «Снова» 2.
          Клик по участнику — разбивка по курсам и слабым местам (отчёт наставника).
        </p>
      </div>
    </div>
  );
}
