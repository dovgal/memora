'use client';
// Кабинет пользователя: роль (ученик/преподаватель), подписки на курсы,
// мои классы (создать / присоединиться), быстрые ссылки.

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppPasswordCard } from '@/components/AppPasswordCard';
import {
  User, GraduationCap, BookOpen, Users, Plus, LogIn, Loader2, Star, X, ArrowRight,
} from 'lucide-react';
import {
  getMyClasses, createClass, joinClass, getSubscriptions, unsubscribeCourse, setRole,
  type MyClasses, type Subscription,
} from '@/lib/classroomApi';

export default function CabinetPage() {
  const { data: session, update } = useSession();
  const idToken = session?.id_token as string | undefined;
  const role = ((session as unknown as { role?: string } | null)?.role) ?? 'student';
  const router = useRouter();

  const [classes, setClasses] = useState<MyClasses | null>(null);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newClassName, setNewClassName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const reload = useCallback(() => {
    if (!idToken) return;
    getMyClasses(idToken).then(setClasses).catch(() => setClasses({ teaching: [], enrolled: [] }));
    getSubscriptions(idToken).then(setSubs).catch(() => {});
  }, [idToken]);

  useEffect(() => { reload(); }, [reload]);

  const becomeTeacher = async () => {
    if (!idToken || busy) return;
    if (!confirm('Стать преподавателем? Вы сможете создавать классы, принимать учеников и выдавать задания.')) return;
    setBusy(true);
    try {
      await setRole('teacher', idToken);
      await update();
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    setBusy(false);
  };

  const handleCreateClass = async () => {
    if (!idToken || !newClassName.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createClass(newClassName.trim(), idToken);
      setNewClassName('');
      reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось создать класс'); }
    setBusy(false);
  };

  const handleJoin = async () => {
    if (!idToken || !joinCode.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinClass(joinCode.trim().toUpperCase(), undefined, idToken);
      setJoinCode('');
      reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Класс не найден'); }
    setBusy(false);
  };

  const handleUnsubscribe = async (courseId: string) => {
    if (!idToken) return;
    await unsubscribeCourse(courseId, idToken).catch(() => {});
    setSubs(s => s.filter(x => x.courseId !== courseId));
  };

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">

        {/* Профиль и роль */}
        <div className="bg-qz-card border border-border rounded-2xl p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#4255ff]/20 flex items-center justify-center">
              <User className="w-7 h-7 text-[#4255ff]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">{session?.user?.email ?? 'Мой кабинет'}</h1>
              <p className="text-qz-text-muted text-sm flex items-center gap-1.5">
                {role === 'teacher'
                  ? <><GraduationCap className="w-4 h-4 text-qz-accent" /> Преподаватель</>
                  : <><BookOpen className="w-4 h-4 text-emerald-400" /> Ученик</>}
              </p>
            </div>
          </div>
          {role !== 'teacher' && (
            <button
              onClick={becomeTeacher}
              disabled={busy}
              className="inline-flex items-center gap-2 bg-[#ffcd1f] hover:brightness-110 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              <GraduationCap className="w-4 h-4" /> Стать преподавателем
            </button>
          )}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Мои курсы */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted">Мои курсы</h2>
            <Link href="/courses" className="text-[#4255ff] hover:underline text-sm font-semibold">Каталог курсов →</Link>
          </div>
          {subs.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-6 text-center text-qz-text-muted text-sm">
              Подписок пока нет. Откройте <Link href="/courses" className="text-[#4255ff] hover:underline">каталог</Link> и
              нажмите ⭐ на интересном курсе — он появится здесь.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {subs.map(s => (
                <div key={s.courseId} className="bg-qz-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <Star className="w-4 h-4 text-qz-accent shrink-0" />
                  <Link href={s.href} className="flex-1 text-foreground text-sm font-medium hover:text-[#4255ff] line-clamp-1">
                    {s.title}
                  </Link>
                  <button onClick={() => handleUnsubscribe(s.courseId)}
                    className="p-1 text-qz-text-muted hover:text-red-400" title="Отписаться">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Я учусь: классы */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Я учусь — мои классы</h2>
          <div className="flex items-center gap-2 mb-3">
            <input
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Код класса (например: AB3K7Z)"
              maxLength={6}
              className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 font-mono tracking-widest uppercase w-56"
            />
            <button
              onClick={handleJoin}
              disabled={busy || joinCode.length < 4}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <LogIn className="w-4 h-4" /> Присоединиться
            </button>
          </div>
          {!classes ? (
            <Loader2 className="w-5 h-5 animate-spin text-qz-text-muted" />
          ) : classes.enrolled.length === 0 ? (
            <p className="text-qz-text-muted text-sm">Вы пока не состоите в классах. Попросите код у преподавателя.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2">
              {classes.enrolled.map(c => (
                <Link key={c.id} href={`/classes/${c.id}`}>
                  <div className="bg-qz-card border border-border rounded-xl px-4 py-3 hover:border-emerald-500/40 transition-colors flex items-center gap-3 group">
                    <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground text-sm font-semibold line-clamp-1">{c.name}</p>
                      <p className="text-qz-text-muted text-xs">Преподаватель: {c.teacherName} · {c.members} уч.</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-qz-text-muted group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Я преподаю */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-4">Я преподаю — мои классы</h2>
          {role === 'teacher' ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <input
                  value={newClassName}
                  onChange={e => setNewClassName(e.target.value)}
                  placeholder="Название нового класса"
                  className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 w-64"
                />
                <button
                  onClick={handleCreateClass}
                  disabled={busy || !newClassName.trim()}
                  className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Создать класс
                </button>
              </div>
              {!classes ? (
                <Loader2 className="w-5 h-5 animate-spin text-qz-text-muted" />
              ) : classes.teaching.length === 0 ? (
                <p className="text-qz-text-muted text-sm">Создайте первый класс и поделитесь кодом с учениками.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-2">
                  {classes.teaching.map(c => (
                    <Link key={c.id} href={`/classes/${c.id}`}>
                      <div className="bg-qz-card border border-border rounded-xl px-4 py-3 hover:border-[#4255ff]/40 transition-colors flex items-center gap-3 group">
                        <GraduationCap className="w-4 h-4 text-qz-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground text-sm font-semibold line-clamp-1">{c.name}</p>
                          <p className="text-qz-text-muted text-xs">Код: <span className="font-mono">{c.joinCode}</span> · {c.members} уч.</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-qz-text-muted group-hover:text-[#4255ff] group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-qz-text-muted text-sm">
              Чтобы создавать классы и принимать учеников, нажмите «Стать преподавателем» выше.
            </p>
          )}
        </section>

        <AppPasswordCard />
      </div>
    </div>
  );
}
