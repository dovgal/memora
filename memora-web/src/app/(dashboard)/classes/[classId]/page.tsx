'use client';
// Страница класса: участники, задания и лента сообщений.
// Преподаватель выдаёт задания (всему классу или ученику) и видит выполнение;
// ученик видит свои задания, отмечает выполнение и общается в ленте.

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Users, GraduationCap, Send, Loader2, Plus,
  CheckCircle2, Circle, CalendarDays, Link2, MessageSquare,
} from 'lucide-react';
import {
  getClassDetail, getClassAssignments, createAssignment, markAssignmentDone,
  getClassMessages, postClassMessage,
  type ClassDetail, type AssignmentItem, type ClassMessage,
} from '@/lib/classroomApi';

export default function ClassPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Форма задания (преподаватель)
  const [showForm, setShowForm] = useState(false);
  const [aTitle, setATitle] = useState('');
  const [aDesc, setADesc] = useState('');
  const [aHref, setAHref] = useState('');
  const [aDue, setADue] = useState('');
  const [aStudent, setAStudent] = useState('');

  const [msgText, setMsgText] = useState('');

  const reload = useCallback(() => {
    if (!idToken) return;
    getClassDetail(classId, idToken).then(setDetail).catch(e => setError(e.message));
    getClassAssignments(classId, idToken).then(setAssignments).catch(() => {});
    getClassMessages(classId, idToken).then(setMessages).catch(() => {});
  }, [classId, idToken]);

  useEffect(() => { reload(); }, [reload]);

  const isTeacher = detail?.myRole === 'teacher';

  const handleCreate = async () => {
    if (!idToken || !aTitle.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await createAssignment(classId, {
        title: aTitle.trim(),
        description: aDesc.trim(),
        studentId: aStudent || undefined,
        courseHref: aHref.trim() || undefined,
        dueDate: aDue || undefined,
      }, idToken);
      setATitle(''); setADesc(''); setAHref(''); setADue(''); setAStudent('');
      setShowForm(false);
      reload();
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    setBusy(false);
  };

  const handleDone = async (id: string) => {
    if (!idToken) return;
    await markAssignmentDone(id, idToken).catch(() => {});
    setAssignments(list => list.map(a => a.id === id ? { ...a, done: true } : a));
  };

  const handleSend = async () => {
    if (!idToken || !msgText.trim() || busy) return;
    setBusy(true);
    try {
      await postClassMessage(classId, msgText.trim(), idToken);
      setMsgText('');
      const fresh = await getClassMessages(classId, idToken);
      setMessages(fresh);
    } catch (e) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    setBusy(false);
  };

  if (error && !detail) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">Нет доступа к классу</p>
        <p className="text-qz-text-muted text-sm mb-4">{error}</p>
        <Link href="/cabinet" className="text-[#4255ff] hover:underline">← В кабинет</Link>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">

        <div>
          <Link href="/cabinet" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-3">
            <ChevronLeft className="w-4 h-4" /> Мой кабинет
          </Link>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#4255ff]/20 flex items-center justify-center">
                {isTeacher ? <GraduationCap className="w-6 h-6 text-[#ffcd1f]" /> : <Users className="w-6 h-6 text-emerald-400" />}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{detail.name}</h1>
                <p className="text-qz-text-muted text-sm">
                  {isTeacher ? 'Вы преподаватель этого класса' : 'Вы ученик этого класса'} · {detail.members.length} участник(ов)
                </p>
              </div>
            </div>
            {isTeacher && detail.joinCode && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-2.5">
                <p className="text-emerald-400 text-xs font-semibold mb-0.5">Код для учеников</p>
                <p className="text-foreground font-mono text-lg tracking-widest">{detail.joinCode}</p>
              </div>
            )}
          </div>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Задания */}
          <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted">Задания</h2>
              {isTeacher && (
                <button onClick={() => setShowForm(f => !f)}
                  className="inline-flex items-center gap-1.5 text-[#4255ff] hover:underline text-sm font-semibold">
                  <Plus className="w-4 h-4" /> Новое задание
                </button>
              )}
            </div>

            {showForm && isTeacher && (
              <div className="bg-qz-card border border-[#4255ff]/30 rounded-2xl p-4 space-y-3">
                <input value={aTitle} onChange={e => setATitle(e.target.value)} placeholder="Название задания *"
                  className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60" />
                <textarea value={aDesc} onChange={e => setADesc(e.target.value)} rows={2} placeholder="Описание / инструкция"
                  className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 resize-y" />
                <div className="grid sm:grid-cols-3 gap-2">
                  <input value={aHref} onChange={e => setAHref(e.target.value)} placeholder="Ссылка на курс/юнит (необяз.)"
                    className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60" />
                  <input type="date" value={aDue} onChange={e => setADue(e.target.value)}
                    className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60" />
                  <select value={aStudent} onChange={e => setAStudent(e.target.value)}
                    className="bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60">
                    <option value="">Всему классу</option>
                    {detail.members.map(m => <option key={m.userId} value={m.userId}>{m.name}</option>)}
                  </select>
                </div>
                <p className="text-qz-text-muted text-xs">Подсказка: скопируйте адрес страницы юнита или курса из браузера в поле ссылки — у ученика появится кнопка перехода.</p>
                <button onClick={handleCreate} disabled={busy || !aTitle.trim()}
                  className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Выдать задание
                </button>
              </div>
            )}

            {assignments.length === 0 ? (
              <p className="text-qz-text-muted text-sm">Заданий пока нет.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map(a => (
                  <div key={a.id} className="bg-qz-card border border-border rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      {!isTeacher && (
                        <button onClick={() => !a.done && handleDone(a.id)} className="mt-0.5 shrink-0" title={a.done ? 'Выполнено' : 'Отметить выполненным'}>
                          {a.done
                            ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                            : <Circle className="w-5 h-5 text-qz-text-muted hover:text-emerald-400 transition-colors" />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${a.done && !isTeacher ? 'text-qz-text-muted line-through' : 'text-foreground'}`}>{a.title}</p>
                        {a.description && <p className="text-qz-text-muted text-xs mt-0.5">{a.description}</p>}
                        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-qz-text-muted">
                          <span>{a.forWholeClass ? 'Всему классу' : (isTeacher ? `Для: ${a.studentName ?? 'ученика'}` : 'Лично вам')}</span>
                          {a.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> до {a.dueDate}</span>}
                          {isTeacher && <span className="text-emerald-400">выполнили: {a.doneCount}</span>}
                          {a.courseHref && (
                            <Link href={a.courseHref} className="inline-flex items-center gap-1 text-[#4255ff] hover:underline">
                              <Link2 className="w-3.5 h-3.5" /> Открыть материал
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Участники */}
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted pt-4">Участники</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {detail.members.length === 0 && <p className="text-qz-text-muted text-sm">Пока никто не присоединился. Поделитесь кодом класса!</p>}
              {detail.members.map(m => (
                <div key={m.userId} className="bg-qz-card border border-border rounded-xl px-4 py-2.5 flex items-center justify-between">
                  <span className="text-foreground text-sm line-clamp-1">{m.name}</span>
                  <span className="text-qz-text-muted text-xs">{m.xp} XP</span>
                </div>
              ))}
            </div>
          </section>

          {/* Лента сообщений */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Лента класса
            </h2>
            <div className="bg-qz-card border border-border rounded-2xl p-3 flex flex-col h-[480px]">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {messages.length === 0 && <p className="text-qz-text-muted text-xs text-center pt-8">Сообщений пока нет. Напишите первым!</p>}
                {[...messages].reverse().map(m => (
                  <div key={m.id} className={`rounded-xl px-3 py-2 text-sm ${m.mine ? 'bg-[#4255ff]/15 ml-4' : 'bg-muted mr-4'}`}>
                    <p className={`text-xs font-semibold mb-0.5 ${m.isTeacher ? 'text-[#ffcd1f]' : 'text-emerald-400'}`}>
                      {m.isTeacher ? '👨‍🏫 ' : ''}{m.author}
                    </p>
                    <p className="text-foreground whitespace-pre-wrap">{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border mt-2">
                <input
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                  placeholder="Сообщение классу…"
                  className="flex-1 bg-qz-bg border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
                />
                <button onClick={handleSend} disabled={busy || !msgText.trim()}
                  className="p-2 rounded-xl bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-40 text-white transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
