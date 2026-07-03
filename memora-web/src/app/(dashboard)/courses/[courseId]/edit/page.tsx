'use client';
// Редактор курса: метаданные, публикация, список юнитов (добавление/удаление/порядок).

import { use, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Plus, Trash2, Loader2, Save, Globe2, Lock,
  ArrowUp, ArrowDown, Pencil, Eye,
} from 'lucide-react';
import {
  getCourse, updateCourse, deleteCourse, createUnit, deleteUnit, updateUnit, getUnit,
  type CourseDetail,
} from '@/lib/courses/customCoursesApi';

const LANGUAGES = [
  { value: 'fr', label: 'Французский' },
  { value: 'en', label: 'Английский' },
  { value: 'de', label: 'Немецкий' },
  { value: 'es', label: 'Испанский' },
  { value: 'ru', label: 'Русский' },
  { value: 'other', label: 'Другое' },
];

// Предметные домены (Subject Packs). Школьные предметы — французская программа,
// контент на французском, уровень = класс (см. FRENCH_GRADES).
const SUBJECTS = [
  { value: 'language', label: 'Иностранный язык' },
  { value: 'math', label: 'Математика' },
  { value: 'physics', label: 'Физика и химия' },
  { value: 'history', label: 'История' },
];

const FRENCH_GRADES = ['6e', '5e', '4e', '3e', '2nde', '1re', 'Terminale'];

export default function CourseEditPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;
  const router = useRouter();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Поля формы
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('fr');
  const [level, setLevel] = useState('');
  const [subject, setSubject] = useState('language');
  const [isPublished, setIsPublished] = useState(false);

  const reload = useCallback(() => {
    if (!idToken) return;
    getCourse(courseId, idToken)
      .then(c => {
        setCourse(c);
        setTitle(c.title);
        setDescription(c.description);
        setLanguage(c.language);
        setLevel(c.level);
        setSubject(c.subject || 'language');
        setIsPublished(c.isPublished);
      })
      .catch(e => setError(e.message));
  }, [courseId, idToken]);

  useEffect(() => { reload(); }, [reload]);

  const saveMeta = async (overrides?: { isPublished?: boolean }) => {
    if (!idToken) return;
    setSaving(true);
    setError(null);
    try {
      await updateCourse(courseId, {
        title, description, language, level, subject,
        isPublished: overrides?.isPublished ?? isPublished,
      }, idToken);
      if (overrides?.isPublished !== undefined) setIsPublished(overrides.isPublished);
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleAddUnit = async () => {
    if (!idToken || !course) return;
    try {
      const { id } = await createUnit(courseId, {
        title: `Юнит ${course.units.length + 1}`,
        description: '',
        vocabulary: [],
        exercises: [],
      }, idToken);
      router.push(`/courses/${courseId}/edit/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось создать юнит');
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    if (!idToken) return;
    if (!confirm('Удалить юнит вместе со всеми упражнениями?')) return;
    try {
      await deleteUnit(courseId, unitId, idToken);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить юнит');
    }
  };

  const moveUnit = async (index: number, dir: -1 | 1) => {
    if (!idToken || !course) return;
    const other = index + dir;
    if (other < 0 || other >= course.units.length) return;
    const a = course.units[index];
    const b = course.units[other];
    try {
      // Меняем позиции местами: подгружаем контент юнитов и сохраняем с новой позицией.
      const [ua, ub] = await Promise.all([
        getUnit(courseId, a.id, idToken),
        getUnit(courseId, b.id, idToken),
      ]);
      await Promise.all([
        updateUnit(courseId, a.id, { title: ua.title, description: ua.description, position: b.position, vocabulary: ua.vocabulary, exercises: ua.exercises }, idToken),
        updateUnit(courseId, b.id, { title: ub.title, description: ub.description, position: a.position, vocabulary: ub.vocabulary, exercises: ub.exercises }, idToken),
      ]);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось изменить порядок');
    }
  };

  const handleDeleteCourse = async () => {
    if (!idToken) return;
    if (!confirm('Удалить курс целиком? Это действие необратимо.')) return;
    try {
      await deleteCourse(courseId, idToken);
      router.push('/courses');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить курс');
    }
  };

  if (error && !course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">Ошибка</p>
        <p className="text-qz-text-muted text-sm mb-4">{error}</p>
        <Link href="/courses" className="text-[#4255ff] hover:underline">← К каталогу</Link>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/courses" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> К каталогу
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/courses/${courseId}`}
              className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 text-foreground text-sm px-3 py-2 rounded-xl transition-colors"
            >
              <Eye className="w-4 h-4" /> Предпросмотр
            </Link>
            <button
              onClick={() => saveMeta({ isPublished: !isPublished })}
              disabled={saving}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl transition-colors ${
                isPublished
                  ? 'bg-muted text-qz-text-muted hover:text-foreground'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPublished ? <><Lock className="w-4 h-4" /> Снять с публикации</> : <><Globe2 className="w-4 h-4" /> Опубликовать</>}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Метаданные */}
        <section className="bg-qz-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted">О курсе</h2>
          <div>
            <label className="block text-xs text-qz-text-muted mb-1.5">Название</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
              placeholder="Например: Итальянский для путешествий"
            />
          </div>
          <div>
            <label className="block text-xs text-qz-text-muted mb-1.5">Описание</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60 resize-y"
              placeholder="Чему научит этот курс?"
            />
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-qz-text-muted mb-1.5">Предмет</label>
              <select
                value={subject}
                onChange={e => {
                  const next = e.target.value;
                  setSubject(next);
                  if (next !== 'language') {
                    // Школьные предметы — французская программа: язык фиксируем,
                    // уровень переводим на шкалу классов.
                    setLanguage('fr');
                    if (!FRENCH_GRADES.includes(level)) setLevel(FRENCH_GRADES[0]);
                  }
                }}
                className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
              >
                {SUBJECTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            {subject === 'language' ? (
              <>
                <div>
                  <label className="block text-xs text-qz-text-muted mb-1.5">Язык</label>
                  <select
                    value={language}
                    onChange={e => setLanguage(e.target.value)}
                    className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
                  >
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-qz-text-muted mb-1.5">Уровень</label>
                  <input
                    value={level}
                    onChange={e => setLevel(e.target.value)}
                    className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
                    placeholder="A1, A2, B1…"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs text-qz-text-muted mb-1.5">Класс (programme français)</label>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  className="w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60"
                >
                  {FRENCH_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => saveMeta()}
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить
            </button>
            {savedAt && <span className="text-emerald-400 text-xs">Сохранено</span>}
          </div>
        </section>

        {/* Юниты */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted">Юниты</h2>
            <button
              onClick={handleAddUnit}
              className="inline-flex items-center gap-1.5 text-[#4255ff] hover:underline text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Добавить юнит
            </button>
          </div>

          {course.units.length === 0 ? (
            <div className="border border-dashed border-border rounded-2xl p-8 text-center text-qz-text-muted text-sm">
              Юнитов пока нет. Добавьте первый — структура та же, что у Édito A1: теория + упражнения + лексика.
            </div>
          ) : (
            <div className="space-y-2">
              {course.units.map((u, idx) => (
                <div key={u.id} className="bg-qz-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#4255ff]/20 flex items-center justify-center text-[#4255ff] font-bold text-xs shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground text-sm font-semibold line-clamp-1">{u.title}</p>
                    <p className="text-qz-text-muted text-xs">{u.exerciseCount} упражнений</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveUnit(idx, -1)} disabled={idx === 0}
                      className="p-1.5 text-qz-text-muted hover:text-foreground disabled:opacity-30 transition-colors" title="Вверх">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveUnit(idx, 1)} disabled={idx === course.units.length - 1}
                      className="p-1.5 text-qz-text-muted hover:text-foreground disabled:opacity-30 transition-colors" title="Вниз">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <Link href={`/courses/${courseId}/edit/${u.id}`}
                      className="p-1.5 text-qz-text-muted hover:text-[#4255ff] transition-colors" title="Редактировать">
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button onClick={() => handleDeleteUnit(u.id)}
                      className="p-1.5 text-qz-text-muted hover:text-red-400 transition-colors" title="Удалить">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Опасная зона */}
        <section className="border border-red-500/20 rounded-2xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-red-400 mb-2">Опасная зона</h2>
          <p className="text-qz-text-muted text-xs mb-3">Удаление курса безвозвратно удалит все юниты и прогресс учащихся.</p>
          <button
            onClick={handleDeleteCourse}
            className="inline-flex items-center gap-2 border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Trash2 className="w-4 h-4" /> Удалить курс
          </button>
        </section>
      </div>
    </div>
  );
}
