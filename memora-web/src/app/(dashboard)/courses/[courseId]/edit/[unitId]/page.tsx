'use client';
// Редактор юнита: метаданные, лексика, упражнения (формы по типам) и ИИ-генерация контента.

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ChevronLeft, Plus, Trash2, Loader2, Save, Sparkles, ArrowUp, ArrowDown,
} from 'lucide-react';
import type { EditoExercise, VocabularyItem } from '@/lib/courses/edito-a1';
import {
  getCourse, getUnit, updateUnit, generateUnitWithAI,
  type CourseDetail, type UnitDetail,
} from '@/lib/courses/customCoursesApi';
import { langMeta } from '@/lib/courses/langMeta';
import { ExerciseEditor, EXERCISE_TYPE_LABELS } from '@/components/courses/ExerciseEditor';
import {
  listSources, getSource, getChunkContent,
  type SourceDocument, type SourceChunkSummary,
} from '@/lib/sourcesApi';

const inputCls = 'w-full bg-qz-bg border border-border rounded-xl px-3 py-2.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60';

/** Типы только для школьных предметов — в палитре языковых курсов не показываются. */
const STEM_ONLY_TYPES = new Set<string>(['numeric', 'ordering']);

/** Палитра по предмету — зеркало allowed_types серверных паков (subjects/mod.rs). */
const PALETTE_BY_SUBJECT: Record<string, string[]> = {
  math: ['theory', 'grammar-quiz', 'numeric', 'ordering'],
  physics: ['theory', 'grammar-quiz', 'numeric', 'ordering'],
  history: ['theory', 'grammar-quiz', 'ordering', 'fill-blank'],
};

function newExercise(type: EditoExercise['type'], index: number): EditoExercise {
  const base = { id: `ex-${Date.now()}-${index}`, type, title: EXERCISE_TYPE_LABELS[type] ?? type };
  switch (type) {
    case 'theory': return { ...base, content: '' };
    case 'grammar-quiz': return { ...base, questions: [] };
    case 'fill-blank': return { ...base, text: '', blanks: [] };
    case 'sentence-builder': return { ...base, sentences: [] };
    case 'dialogue': return { ...base, context: '', exchanges: [] };
    case 'gender-quiz': return { ...base, items: [] };
    case 'listening': return { ...base, audioFile: '', transcript: '' };
    case 'video': return { ...base, videoFile: '', description: '' };
    case 'error-hunt': return { ...base, sentence: '', errorIndex: null, correction: '', explanation: '', variantPolicy: { regenerateOnRepeat: true, format: 'error-hunt' } };
    case 'dictation': return { ...base, sentence: '', translation: '', explanation: '' };
    case 'numeric': return { ...base, prompt: '', numericAnswer: undefined, tolerance: 0, unit: '', explanation: '' };
    case 'ordering': return { ...base, prompt: '', orderItems: [], explanation: '' };
    default: return base;
  }
}

export default function UnitEditPage({ params }: { params: Promise<{ courseId: string; unitId: string }> }) {
  const { courseId, unitId } = use(params);
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);

  // ИИ-генерация
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiSource, setAiSource] = useState('');
  // Выбор главы учебника как основы для генерации (страница /sources).
  const [sourceDocs, setSourceDocs] = useState<SourceDocument[] | null>(null);
  const [pickedDoc, setPickedDoc] = useState('');
  const [docChunks, setDocChunks] = useState<SourceChunkSummary[]>([]);
  const [pickedChunk, setPickedChunk] = useState('');
  const [chunkBusy, setChunkBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (!idToken) return;
    getUnit(courseId, unitId, idToken).then(setUnit).catch(e => setError(e.message));
    // Метаданные курса нужны ИИ-генерации (язык/уровень/предмет); ошибка не критична.
    getCourse(courseId, idToken).then(setCourse).catch(() => {});
  }, [courseId, unitId, idToken]);

  const patch = (p: Partial<UnitDetail>) => {
    setUnit(u => u ? { ...u, ...p } : u);
    setDirty(true);
  };

  const save = async () => {
    if (!idToken || !unit) return;
    setSaving(true);
    setError(null);
    try {
      await updateUnit(courseId, unitId, {
        title: unit.title,
        description: unit.description,
        vocabulary: unit.vocabulary,
        exercises: unit.exercises,
      }, idToken);
      setSavedAt(Date.now());
      setDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const runAI = async () => {
    if (!idToken || !unit || !aiTopic.trim()) return;
    setAiBusy(true);
    setError(null);
    try {
      const generated = await generateUnitWithAI({
        topic: aiTopic.trim(),
        sourceText: aiSource.trim() || undefined,
        // Язык/уровень/предмет курса — чтобы генерация шла в правильном предметном паке
        // (без этого сервер по умолчанию генерирует французский A1).
        language: course ? langMeta(course.language).label : undefined,
        level: course?.level || undefined,
        subject: course?.subject,
      }, idToken);
      // Дозаполняем: новый контент добавляется к существующему.
      const exercises = (generated.exercises ?? []).map((ex, i) => ({
        ...ex,
        id: `ex-ai-${Date.now()}-${i}`,
      }));
      patch({
        vocabulary: [...unit.vocabulary, ...(generated.vocabulary ?? [])],
        exercises: [...unit.exercises, ...exercises],
      });
      setAiOpen(false);
      setAiTopic('');
      setAiSource('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации. Попробуйте ещё раз.');
    } finally {
      setAiBusy(false);
    }
  };

  const moveExercise = (i: number, dir: -1 | 1) => {
    if (!unit) return;
    const j = i + dir;
    if (j < 0 || j >= unit.exercises.length) return;
    const next = [...unit.exercises];
    [next[i], next[j]] = [next[j], next[i]];
    patch({ exercises: next });
  };

  const updateVocab = (i: number, p: Partial<VocabularyItem>) => {
    if (!unit) return;
    patch({ vocabulary: unit.vocabulary.map((v, idx) => idx === i ? { ...v, ...p } : v) });
  };

  if (error && !unit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-qz-card text-foreground">
        <p className="text-xl font-bold mb-2">Ошибка</p>
        <p className="text-qz-text-muted text-sm mb-4">{error}</p>
        <Link href={`/courses/${courseId}/edit`} className="text-[#4255ff] hover:underline">← К курсу</Link>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">

        {/* Header + save */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href={`/courses/${courseId}/edit`} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> К курсу
          </Link>
          <div className="flex items-center gap-3">
            {savedAt && !dirty && <span className="text-emerald-400 text-xs">Сохранено</span>}
            {dirty && <span className="text-amber-400 text-xs">Есть несохранённые изменения</span>}
            <button
              onClick={save}
              disabled={saving || !unit.title.trim()}
              className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-xl transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Сохранить юнит
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Метаданные */}
        <section className="bg-qz-card border border-border rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-qz-text-muted mb-1.5">Название юнита</label>
            <input value={unit.title} onChange={e => patch({ title: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-qz-text-muted mb-1.5">Описание</label>
            <textarea value={unit.description} onChange={e => patch({ description: e.target.value })} rows={2} className={`${inputCls} resize-y`} />
          </div>
        </section>

        {/* ИИ-генерация */}
        <section className="border border-[#ffcd1f]/30 bg-[#ffcd1f]/5 rounded-2xl p-5">
          <button onClick={() => setAiOpen(o => !o)} className="flex items-center gap-2 text-sm font-semibold text-foreground w-full">
            <Sparkles className="w-4 h-4 text-[#ffcd1f]" />
            Сгенерировать контент с помощью ИИ
            <span className="ml-auto text-qz-text-muted text-xs">{aiOpen ? 'Свернуть' : 'Развернуть'}</span>
          </button>
          {aiOpen && (
            <div className="mt-4 space-y-3">
              <input
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                className={inputCls}
                placeholder="Тема юнита, например: «Заказ еды в ресторане»"
              />
              <textarea
                value={aiSource}
                onChange={e => setAiSource(e.target.value)}
                rows={4}
                className={`${inputCls} resize-y`}
                placeholder="Необязательно: вставьте исходный текст (страницу учебника, статью) — ИИ построит юнит на его основе"
              />

              {/* Грунт из загруженного учебника (страница «Учебники») */}
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={pickedDoc}
                  onChange={async e => {
                    const id = e.target.value;
                    setPickedDoc(id);
                    setPickedChunk('');
                    setDocChunks([]);
                    if (id && idToken) {
                      try { setDocChunks((await getSource(id, idToken)).chunks); } catch { /* список недоступен */ }
                    }
                  }}
                  onFocus={() => {
                    if (sourceDocs === null && idToken) {
                      listSources(idToken).then(setSourceDocs).catch(() => setSourceDocs([]));
                    }
                  }}
                  className="bg-qz-bg border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-[#4255ff]/60 max-w-[240px]"
                >
                  <option value="">Из учебника…</option>
                  {(sourceDocs ?? []).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
                {pickedDoc && (
                  <select
                    value={pickedChunk}
                    onChange={e => setPickedChunk(e.target.value)}
                    className="bg-qz-bg border border-border rounded-xl px-3 py-2 text-sm text-foreground outline-none focus:border-[#4255ff]/60 max-w-[220px]"
                  >
                    <option value="">Фрагмент…</option>
                    {docChunks.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title || `Фрагмент ${c.position + 1}`} · {Math.round(c.chars / 100) / 10}k
                      </option>
                    ))}
                  </select>
                )}
                {pickedDoc && pickedChunk && (
                  <button
                    onClick={async () => {
                      if (!idToken || chunkBusy) return;
                      setChunkBusy(true);
                      try {
                        const { content } = await getChunkContent(pickedDoc, pickedChunk, idToken);
                        setAiSource(prev => (prev.trim() ? prev + '\n\n' : '') + content);
                      } catch { /* фрагмент недоступен */ }
                      finally { setChunkBusy(false); }
                    }}
                    disabled={chunkBusy}
                    className="inline-flex items-center gap-1.5 text-[#4255ff] hover:underline text-xs font-semibold disabled:opacity-50"
                  >
                    {chunkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Вставить как основу
                  </button>
                )}
                {sourceDocs !== null && sourceDocs.length === 0 && (
                  <span className="text-qz-text-muted text-xs">
                    Нет источников — загрузите на странице <Link href="/sources" className="text-[#4255ff] hover:underline">Учебники</Link>.
                  </span>
                )}
              </div>
              <button
                onClick={runAI}
                disabled={aiBusy || !aiTopic.trim()}
                className="inline-flex items-center gap-2 bg-[#ffcd1f] hover:brightness-110 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2 rounded-xl transition-all"
              >
                {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiBusy ? 'Генерация (до минуты)…' : 'Сгенерировать'}
              </button>
              <p className="text-qz-text-muted text-xs">Сгенерированные лексика и упражнения добавятся к текущим — лишнее можно удалить.</p>
            </div>
          )}
        </section>

        {/* Лексика */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted">Лексика ({unit.vocabulary.length})</h2>
            <button
              onClick={() => patch({ vocabulary: [...unit.vocabulary, { fr: '', ru: '', type: 'word' }] })}
              className="inline-flex items-center gap-1.5 text-[#4255ff] hover:underline text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Добавить
            </button>
          </div>
          {unit.vocabulary.length === 0 ? (
            <p className="text-qz-text-muted text-xs">Слова и фразы юнита. После прохождения юнита они смогут попасть в личный словарь учащегося.</p>
          ) : (
            <div className="space-y-2">
              {unit.vocabulary.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={v.fr} onChange={e => updateVocab(i, { fr: e.target.value })} className={inputCls} placeholder="Слово / фраза" />
                  <input value={v.ru} onChange={e => updateVocab(i, { ru: e.target.value })} className={inputCls} placeholder="Перевод" />
                  <select
                    value={v.type ?? 'word'}
                    onChange={e => updateVocab(i, { type: e.target.value })}
                    className={`${inputCls} max-w-[110px]`}
                  >
                    <option value="word">Слово</option>
                    <option value="phrase">Фраза</option>
                  </select>
                  <button
                    onClick={() => patch({ vocabulary: unit.vocabulary.filter((_, idx) => idx !== i) })}
                    className="p-1.5 text-qz-text-muted hover:text-red-400 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Упражнения */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-qz-text-muted mb-3">Упражнения ({unit.exercises.length})</h2>
          <div className="space-y-4">
            {unit.exercises.map((ex, i) => (
              <div key={ex.id} className="relative">
                <div className="absolute -left-2 top-3 -translate-x-full hidden md:flex flex-col gap-1">
                  <button onClick={() => moveExercise(i, -1)} disabled={i === 0} className="p-1 text-qz-text-muted hover:text-foreground disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                  <button onClick={() => moveExercise(i, 1)} disabled={i === unit.exercises.length - 1} className="p-1 text-qz-text-muted hover:text-foreground disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                </div>
                <ExerciseEditor
                  exercise={ex}
                  onChange={next => patch({ exercises: unit.exercises.map((e2, idx) => idx === i ? next : e2) })}
                  onDelete={() => patch({ exercises: unit.exercises.filter((_, idx) => idx !== i) })}
                />
              </div>
            ))}
          </div>

          {/* Добавить упражнение */}
          <div className="mt-4 border border-dashed border-border rounded-2xl p-4">
            <p className="text-xs text-qz-text-muted mb-3">Добавить упражнение:</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EXERCISE_TYPE_LABELS) as EditoExercise['type'][])
                // Палитра по предмету: серверные паки отвергают чужие типы,
                // незачем их показывать (языковой курс — без numeric, math — без диалогов).
                .filter(type => {
                  const allowed = course && PALETTE_BY_SUBJECT[course.subject];
                  if (allowed) return allowed.includes(type);
                  return !STEM_ONLY_TYPES.has(type);
                })
                .map(type => (
                <button
                  key={type}
                  onClick={() => patch({ exercises: [...unit.exercises, newExercise(type, unit.exercises.length)] })}
                  className="inline-flex items-center gap-1.5 border border-border hover:border-[#4255ff]/50 hover:text-[#4255ff] text-qz-text-muted text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" /> {EXERCISE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Нижняя панель сохранения */}
        <div className="sticky bottom-4 flex justify-end">
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-40 text-white font-semibold text-sm px-5 py-2.5 rounded-xl shadow-lg transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить юнит
          </button>
        </div>
      </div>
    </div>
  );
}
