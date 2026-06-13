'use client';
// Редактор одного упражнения: структурные формы для каждого типа + JSON-режим
// для продвинутого редактирования. Формат полностью совместим с ExerciseRenderer.

import { useState } from 'react';
import { Plus, Trash2, Code2, ListChecks, Eye, EyeOff } from 'lucide-react';
import type {
  EditoExercise, GrammarQuestion, DialogueExchange, BlankItem, GenderItem,
} from '@/lib/courses/edito-a1';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';

export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  'theory': 'Теория',
  'grammar-quiz': 'Грамматический тест',
  'fill-blank': 'Заполнить пропуски',
  'sentence-builder': 'Собери предложение',
  'dialogue': 'Диалог',
  'gender-quiz': 'Род существительных',
  'listening': 'Аудирование',
  'video': 'Видео',
  'error-hunt': 'Найди ошибку',
};

interface Props {
  exercise: EditoExercise;
  onChange: (next: EditoExercise) => void;
  onDelete: () => void;
}

const inputCls = 'w-full bg-qz-bg border border-border rounded-lg px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-[#4255ff]/60';
const labelCls = 'block text-xs text-qz-text-muted mb-1';
const smallBtn = 'inline-flex items-center gap-1 text-xs text-[#4255ff] hover:underline font-semibold';

export function ExerciseEditor({ exercise, onChange, onDelete }: Props) {
  const [jsonMode, setJsonMode] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const set = (patch: Partial<EditoExercise>) => onChange({ ...exercise, ...patch });

  const enterJsonMode = () => {
    setJsonText(JSON.stringify(exercise, null, 2));
    setJsonError(null);
    setJsonMode(true);
  };

  const applyJson = () => {
    try {
      const parsed = JSON.parse(jsonText) as EditoExercise;
      if (!parsed.id || !parsed.type) throw new Error('Нужны поля id и type');
      onChange(parsed);
      setJsonMode(false);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : 'Некорректный JSON');
    }
  };

  return (
    <div className="bg-qz-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#4255ff]">
          {EXERCISE_TYPE_LABELS[exercise.type] ?? exercise.type}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview(p => !p)} className="p-1.5 text-qz-text-muted hover:text-foreground transition-colors" title="Предпросмотр">
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button type="button" onClick={jsonMode ? () => setJsonMode(false) : enterJsonMode} className="p-1.5 text-qz-text-muted hover:text-foreground transition-colors" title="JSON-режим">
            {jsonMode ? <ListChecks className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onDelete} className="p-1.5 text-qz-text-muted hover:text-red-400 transition-colors" title="Удалить упражнение">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {jsonMode ? (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            rows={14}
            spellCheck={false}
            className="w-full bg-qz-bg border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground outline-none focus:border-[#4255ff]/60 resize-y"
          />
          {jsonError && <p className="text-red-400 text-xs">{jsonError}</p>}
          <button type="button" onClick={applyJson} className="text-xs font-semibold bg-[#4255ff] text-white px-3 py-1.5 rounded-lg">Применить JSON</button>
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls}>Заголовок</label>
            <input value={exercise.title} onChange={e => set({ title: e.target.value })} className={inputCls} />
          </div>
          <TypeFields exercise={exercise} set={set} />
        </>
      )}

      {showPreview && (
        <div className="border-t border-border pt-3">
          <p className="text-xs text-qz-text-muted mb-2">Предпросмотр:</p>
          <ExerciseRenderer exercise={exercise} />
        </div>
      )}
    </div>
  );
}

function TypeFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  switch (exercise.type) {
    case 'theory':
      return (
        <div>
          <label className={labelCls}>Текст теории (поддерживается **markdown**)</label>
          <textarea
            value={exercise.content ?? ''}
            onChange={e => set({ content: e.target.value })}
            rows={8}
            className={`${inputCls} resize-y`}
            placeholder="Объяснение темы…"
          />
        </div>
      );

    case 'grammar-quiz':
      return <GrammarQuizFields exercise={exercise} set={set} />;

    case 'fill-blank':
      return <FillBlankFields exercise={exercise} set={set} />;

    case 'sentence-builder':
      return <SentenceBuilderFields exercise={exercise} set={set} />;

    case 'dialogue':
      return <DialogueFields exercise={exercise} set={set} />;

    case 'gender-quiz':
      return <GenderQuizFields exercise={exercise} set={set} />;

    case 'listening':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>URL аудиофайла</label>
            <input value={exercise.audioFile ?? ''} onChange={e => set({ audioFile: e.target.value })} className={inputCls} placeholder="https://…/audio.mp3" />
          </div>
          <div>
            <label className={labelCls}>Источник (подпись)</label>
            <input value={exercise.source ?? ''} onChange={e => set({ source: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Транскрипт</label>
            <textarea value={exercise.transcript ?? ''} onChange={e => set({ transcript: e.target.value })} rows={4} className={`${inputCls} resize-y`} />
          </div>
        </div>
      );

    case 'video':
      return (
        <div className="space-y-3">
          <div>
            <label className={labelCls}>URL видеофайла</label>
            <input value={exercise.videoFile ?? ''} onChange={e => set({ videoFile: e.target.value })} className={inputCls} placeholder="https://…/video.mp4" />
          </div>
          <div>
            <label className={labelCls}>Описание</label>
            <textarea value={exercise.description ?? ''} onChange={e => set({ description: e.target.value })} rows={3} className={`${inputCls} resize-y`} />
          </div>
        </div>
      );

    case 'error-hunt':
      return <ErrorHuntFields exercise={exercise} set={set} />;

    default:
      return <p className="text-qz-text-muted text-xs">Для типа «{exercise.type}» используйте JSON-режим.</p>;
  }
}

// ---------- error-hunt (какография, метод Voltaire) ----------

function ErrorHuntFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  const tokens = (exercise.sentence ?? '').split(/\s+/).filter(Boolean);
  const noError = exercise.errorIndex === null || exercise.errorIndex === undefined;
  const regenerate = exercise.variantPolicy?.regenerateOnRepeat !== false;

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Предложение (на изучаемом языке)</label>
        <textarea
          value={exercise.sentence ?? ''}
          onChange={e => set({ sentence: e.target.value })}
          rows={2}
          className={`${inputCls} resize-y`}
          placeholder="Например: Je pense de toi."
        />
      </div>

      <div>
        <label className={labelCls}>Кликните слово с ошибкой</label>
        <div className="flex flex-wrap gap-1.5">
          {tokens.length === 0 && <span className="text-qz-text-muted text-xs">Сначала введите предложение выше…</span>}
          {tokens.map((tok, i) => (
            <button
              type="button"
              key={i}
              onClick={() => set({ errorIndex: exercise.errorIndex === i ? null : i })}
              className={`px-2 py-1 rounded-md border text-sm transition-colors ${
                exercise.errorIndex === i
                  ? 'border-red-500/60 bg-red-500/15 text-red-300'
                  : 'border-border text-foreground hover:border-[#4255ff]/60'
              }`}
            >
              {tok}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-qz-text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={noError}
          onChange={e => set(e.target.checked ? { errorIndex: null, correction: '' } : { errorIndex: 0 })}
        />
        В предложении нет ошибки («Il n'y a pas de faute»)
      </label>

      {!noError && (
        <div>
          <label className={labelCls}>Правильное слово (коррекция)</label>
          <input
            value={exercise.correction ?? ''}
            onChange={e => set({ correction: e.target.value })}
            className={inputCls}
            placeholder="Например: à"
          />
        </div>
      )}

      <div>
        <label className={labelCls}>Объяснение правила (по-русски)</label>
        <textarea
          value={exercise.explanation ?? ''}
          onChange={e => set({ explanation: e.target.value })}
          rows={3}
          className={`${inputCls} resize-y`}
          placeholder="Например: « penser À quelqu'un/quelque chose »…"
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-qz-text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={regenerate}
          onChange={e => set({ variantPolicy: { ...(exercise.variantPolicy ?? {}), regenerateOnRepeat: e.target.checked, format: 'error-hunt' } })}
        />
        Генерировать новый пример того же правила на повторе (метод Voltaire)
      </label>
    </div>
  );
}

// ---------- grammar-quiz ----------

function GrammarQuizFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  const questions: GrammarQuestion[] = exercise.questions ?? [];
  const update = (i: number, patch: Partial<GrammarQuestion>) => {
    const next = questions.map((q, idx) => idx === i ? { ...q, ...patch } : q);
    set({ questions: next });
  };
  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={i} className="border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-qz-text-muted font-semibold">Вопрос {i + 1}</span>
            <button type="button" onClick={() => set({ questions: questions.filter((_, idx) => idx !== i) })} className="text-qz-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <input value={q.question} onChange={e => update(i, { question: e.target.value })} className={inputCls} placeholder="Вопрос (например: Je ___ étudiant.)" />
          <div className="grid grid-cols-2 gap-2">
            {(q.options ?? []).map((opt, oi) => (
              <div key={oi} className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name={`correct-${exercise.id}-${i}`}
                  checked={q.correctAnswer === opt && opt !== ''}
                  onChange={() => update(i, { correctAnswer: opt })}
                  title="Правильный ответ"
                />
                <input
                  value={opt}
                  onChange={e => {
                    const opts = [...q.options];
                    const wasCorrect = q.correctAnswer === opt;
                    opts[oi] = e.target.value;
                    update(i, { options: opts, ...(wasCorrect ? { correctAnswer: e.target.value } : {}) });
                  }}
                  className={inputCls}
                  placeholder={`Вариант ${oi + 1}`}
                />
                <button type="button" onClick={() => update(i, { options: q.options.filter((_, idx) => idx !== oi) })} className="text-qz-text-muted hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => update(i, { options: [...(q.options ?? []), ''] })} className={smallBtn}><Plus className="w-3 h-3" /> Вариант</button>
          <input value={q.explanation ?? ''} onChange={e => update(i, { explanation: e.target.value })} className={inputCls} placeholder="Объяснение (показывается после ответа)" />
        </div>
      ))}
      <button
        type="button"
        onClick={() => set({ questions: [...questions, { question: '', options: ['', ''], correctAnswer: '', explanation: '' }] })}
        className={smallBtn}
      >
        <Plus className="w-3 h-3" /> Добавить вопрос
      </button>
    </div>
  );
}

// ---------- fill-blank ----------

function FillBlankFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  const blanks: BlankItem[] = exercise.blanks ?? [];
  const update = (i: number, patch: Partial<BlankItem>) => {
    set({ blanks: blanks.map((b, idx) => idx === i ? { ...b, ...patch } : b) });
  };
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Текст с пропусками (каждый пропуск — ___ )</label>
        <textarea
          value={exercise.text ?? ''}
          onChange={e => set({ text: e.target.value })}
          rows={3}
          className={`${inputCls} resize-y`}
          placeholder="Je ___ Paul. J'___ 20 ans."
        />
      </div>
      {blanks.map((b, i) => (
        <div key={i} className="border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-qz-text-muted font-semibold">Пропуск {i + 1}</span>
            <button type="button" onClick={() => set({ blanks: blanks.filter((_, idx) => idx !== i) })} className="text-qz-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <input value={b.correctAnswer} onChange={e => update(i, { correctAnswer: e.target.value })} className={inputCls} placeholder="Правильный ответ" />
          <input
            value={(b.options ?? []).join(', ')}
            onChange={e => update(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
            className={inputCls}
            placeholder="Варианты через запятую (необязательно)"
          />
          <input value={b.explanation ?? ''} onChange={e => update(i, { explanation: e.target.value })} className={inputCls} placeholder="Объяснение" />
        </div>
      ))}
      <button type="button" onClick={() => set({ blanks: [...blanks, { correctAnswer: '' }] })} className={smallBtn}>
        <Plus className="w-3 h-3" /> Добавить пропуск
      </button>
    </div>
  );
}

// ---------- sentence-builder ----------

function SentenceBuilderFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  const sentences = exercise.sentences ?? [];
  const update = (i: number, patch: Partial<{ words: string[]; ru: string }>) => {
    set({ sentences: sentences.map((s, idx) => idx === i ? { ...s, ...patch } : s) });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-qz-text-muted">Учащийся собирает предложение из слов в правильном порядке. Слова — через пробел.</p>
      {sentences.map((s, i) => (
        <div key={i} className="border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-qz-text-muted font-semibold">Предложение {i + 1}</span>
            <button type="button" onClick={() => set({ sentences: sentences.filter((_, idx) => idx !== i) })} className="text-qz-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <input
            value={s.words.join(' ')}
            onChange={e => update(i, { words: e.target.value.split(/\s+/).filter(Boolean) })}
            className={inputCls}
            placeholder="Je suis étudiant"
          />
          <input value={s.ru} onChange={e => update(i, { ru: e.target.value })} className={inputCls} placeholder="Перевод на русский" />
        </div>
      ))}
      <button type="button" onClick={() => set({ sentences: [...sentences, { words: [], ru: '' }] })} className={smallBtn}>
        <Plus className="w-3 h-3" /> Добавить предложение
      </button>
    </div>
  );
}

// ---------- dialogue ----------

function DialogueFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  const exchanges: DialogueExchange[] = exercise.exchanges ?? [];
  const update = (i: number, patch: Partial<DialogueExchange>) => {
    set({ exchanges: exchanges.map((x, idx) => idx === i ? { ...x, ...patch } : x) });
  };
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Контекст диалога</label>
        <input value={exercise.context ?? ''} onChange={e => set({ context: e.target.value })} className={inputCls} placeholder="В кафе. Поль заказывает кофе." />
      </div>
      {exchanges.map((x, i) => (
        <div key={i} className="border border-border rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <input value={x.speaker} onChange={e => update(i, { speaker: e.target.value })} className={`${inputCls} max-w-[120px]`} placeholder="Имя" />
              <select value={x.side} onChange={e => update(i, { side: e.target.value as 'left' | 'right' })} className={`${inputCls} max-w-[100px]`}>
                <option value="left">Слева</option>
                <option value="right">Справа</option>
              </select>
              <label className="flex items-center gap-1.5 text-xs text-qz-text-muted whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={!!x.isBlank}
                  onChange={e => update(i, { isBlank: e.target.checked })}
                /> С выбором
              </label>
            </div>
            <button type="button" onClick={() => set({ exchanges: exchanges.filter((_, idx) => idx !== i) })} className="text-qz-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          {x.isBlank ? (
            <>
              <input
                value={(x.options ?? []).join(', ')}
                onChange={e => update(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className={inputCls}
                placeholder="Варианты ответа через запятую"
              />
              <input value={x.correctAnswer ?? ''} onChange={e => update(i, { correctAnswer: e.target.value })} className={inputCls} placeholder="Правильный ответ" />
              <input value={x.explanation ?? ''} onChange={e => update(i, { explanation: e.target.value })} className={inputCls} placeholder="Объяснение" />
            </>
          ) : (
            <input value={x.text ?? ''} onChange={e => update(i, { text: e.target.value })} className={inputCls} placeholder="Реплика" />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => set({ exchanges: [...exchanges, { speaker: '', side: exchanges.length % 2 === 0 ? 'left' : 'right', text: '' }] })}
        className={smallBtn}
      >
        <Plus className="w-3 h-3" /> Добавить реплику
      </button>
    </div>
  );
}

// ---------- gender-quiz ----------

function GenderQuizFields({ exercise, set }: { exercise: EditoExercise; set: (p: Partial<EditoExercise>) => void }) {
  const items = (exercise.items ?? []) as GenderItem[];
  const update = (i: number, patch: Partial<GenderItem>) => {
    set({ items: items.map((g, idx) => idx === i ? { ...g, ...patch } : g) });
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-qz-text-muted">Учащийся выбирает артикль (род) для каждого слова.</p>
      {items.map((g, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={g.word} onChange={e => update(i, { word: e.target.value })} className={inputCls} placeholder="Слово (maison)" />
          <input value={g.article} onChange={e => update(i, { article: e.target.value })} className={`${inputCls} max-w-[90px]`} placeholder="la" />
          <input value={g.ru ?? ''} onChange={e => update(i, { ru: e.target.value })} className={inputCls} placeholder="Перевод" />
          <button type="button" onClick={() => set({ items: items.filter((_, idx) => idx !== i) })} className="text-qz-text-muted hover:text-red-400 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      <button type="button" onClick={() => set({ items: [...items, { word: '', article: '', ru: '' }] })} className={smallBtn}>
        <Plus className="w-3 h-3" /> Добавить слово
      </button>
    </div>
  );
}
