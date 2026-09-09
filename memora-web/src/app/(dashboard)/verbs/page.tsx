'use client';
// Тренажёр неправильных глаголов: учитель задаёт партию («выучить с 1 по
// 20»), тренажёр сам собирает занятие — слабые вперёд, новые из партии,
// остаток добирает подошедшими по сроку из прежних партий. Прочные не
// мешаются, пока не подошёл их срок. Подробности отбора — в sessionPlan.ts.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Loader2, Pencil, Play, RotateCcw } from 'lucide-react';
import { VERBS } from '@/lib/courses/verbs/list';
import type { IrregularVerb, VerbState } from '@/lib/courses/verbs/types';
import { buildSessionPlan } from '@/lib/courses/verbs/sessionPlan';
import { getVerbsState, putVerbsAssignment } from '@/lib/courses/verbs/api';
import { ensureVerbSet, fetchCardStates, reviewVerbCard, toVerbStates, verbNumberOf } from '@/lib/courses/verbs/cards';
import { stepFor } from '@/lib/courses/verbs/steps';
import { ProgressMap } from '@/components/verbs/ProgressMap';
import { VerbCard } from '@/components/verbs/VerbCard';
import { useT } from '@/components/I18nProvider';

const MAX_N = VERBS.reduce((m, v) => Math.max(m, v.n), 0);

/** Сегодняшняя дата в том же виде, что и VerbState.due — «2026-09-11».
 * Берём местное время: занятие короче суток, а полночь по UTC подростка не
 * касается. */
function todayStr(): string {
  const d = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function cardWord(n: number): string {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'карточка';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'карточки';
  return 'карточек';
}

type View = 'overview' | 'session' | 'summary';

export default function VerbsPage() {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<{ from: number; to: number } | null>(null);
  const [states, setStates] = useState<VerbState[]>([]);
  /** Номер глагола → карточка в наборе: ответы уходят по опознавателю карточки. */
  const [cardByVerb, setCardByVerb] = useState<Map<number, string>>(new Map());

  const [editingAssignment, setEditingAssignment] = useState(false);
  const [fromInput, setFromInput] = useState(1);
  const [toInput, setToInput] = useState(20);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [view, setView] = useState<View>('overview');
  const [session, setSession] = useState<IrregularVerb[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await getVerbsState();
      setAssignment(data.assignment);
      if (data.assignment) {
        setFromInput(data.assignment.from);
        setToInput(data.assignment.to);
      }

      // Расписание повторений ведёт общий сервис карточек, а не наша лесенка:
      // там настоящий алгоритм, и тот же набор открывается всеми режимами
      // занятий — карточками, изучением, тестом.
      const set = await ensureVerbSet();
      setCardByVerb(new Map(set.flashcards.map(c => [verbNumberOf(c), c.id])));
      const cardStates = await fetchCardStates(set.id);
      setStates(toVerbStates(set.flashcards, cardStates));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось загрузить состояние');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statesByN = useMemo(() => new Map(states.map(s => [s.n, s])), [states]);
  const today = todayStr();

  // Предпоказ занятия: сколько карточек соберётся прямо сейчас — чтобы
  // кнопка «Начать» была честной, а не наугад.
  const preview = useMemo(
    () => buildSessionPlan({ verbs: VERBS, states, assignment, today }),
    [states, assignment, today],
  );

  const saveAssignment = async () => {
    if (fromInput < 1 || toInput < fromInput || toInput > MAX_N) return;
    setSavingAssignment(true);
    setError(null);
    try {
      await putVerbsAssignment(fromInput, toInput);
      setAssignment({ from: fromInput, to: toInput });
      setEditingAssignment(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'не удалось сохранить партию');
    } finally {
      setSavingAssignment(false);
    }
  };

  const startSession = () => {
    if (preview.length === 0) return;
    setSession(preview);
    setCardIdx(0);
    setCorrectCount(0);
    setView('session');
  };

  const handleFormsChecked = useCallback((correct: boolean) => {
    const verb = session[cardIdx];
    if (!verb) return;
    if (correct) setCorrectCount(c => c + 1);
    // Карточка уже показана ученику независимо от ответа сервера — отправка
    // в фоне лишь двигает расписание повторений.
    const cardId = cardByVerb.get(verb.n);
    if (cardId) void reviewVerbCard(cardId, correct).catch(() => { /* сеть подвела */ });

    // Ошибка возвращается в этом же занятии, а не завтра: между промахом и
    // повтором должно пройти несколько карточек — достаточно, чтобы ответ не
    // остался просто в памяти последней минуты, но не настолько долго, чтобы
    // забыть разбор.
    if (!correct) {
      setSession(prev => {
        const at = Math.min(cardIdx + 4, prev.length);
        return [...prev.slice(0, at), verb, ...prev.slice(at)];
      });
    }

    // На карте отмечаем сразу, не дожидаясь ответа: точные срок и прочность
    // придут при следующей загрузке, а «уже спрашивали» видно должно быть
    // немедленно — иначе глагол так и останется белым до конца занятия.
    setStates(prev => {
      const was = prev.find(s => s.n === verb.n);
      const next: VerbState = {
        n: verb.n,
        step: was?.step ?? 0,
        due: new Date().toISOString().slice(0, 10),
        streak: correct ? (was?.streak ?? 0) + 1 : 0,
        misses: (was?.misses ?? 0) + (correct ? 0 : 1),
      };
      return [...prev.filter(s => s.n !== verb.n), next];
    });
  }, [session, cardIdx, cardByVerb]);

  /**
   * Ступень для показываемой карточки. Незнакомое слово даём списать, после
   * первых ответов — выбор из близких форм, дальше — с чистого листа.
   */
  const currentStep = useMemo(() => {
    const verb = session[cardIdx];
    if (!verb) return 'copy' as const;
    const st = states.find(s => s.n === verb.n);
    return stepFor(st?.streak ?? 0, st?.misses ?? 0);
  }, [session, cardIdx, states]);

  const handleCardDone = () => {
    if (cardIdx + 1 < session.length) setCardIdx(i => i + 1);
    else setView('summary');
  };

  // ---------- Экран занятия ----------
  if (view === 'session' && session[cardIdx]) {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-6 md:py-8 space-y-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setView('overview')}
              className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm"
            >
              <ChevronLeft className="w-4 h-4" />{t('Прервать занятие')}</button>
            <p className="text-sm text-qz-text-muted font-semibold">{cardIdx + 1} из {session.length}</p>
          </div>
          <VerbCard
            key={session[cardIdx].n}
            step={currentStep}
            verb={session[cardIdx]}
            onFormsChecked={handleFormsChecked}
            onDone={handleCardDone}
          />
        </div>
      </div>
    );
  }

  // ---------- Экран итога занятия ----------
  if (view === 'summary') {
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-2">
            <p className="text-2xl">🎉</p>
            <p className="text-xl font-bold text-foreground">{t('Занятие пройдено!')}</p>
            <p className="text-qz-text-muted">
              Верно с первого раза: {correctCount} из {session.length}
            </p>
            <button
              onClick={() => setView('overview')}
              className="mt-2 inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />{t('К обзору')}</button>
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">{t('Карта прогресса')}</h2>
            <ProgressMap verbs={VERBS} states={statesByN} assignment={assignment} />
          </div>
        </div>
      </div>
    );
  }

  // ---------- Обзор ----------
  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8 space-y-6">
        <Link href="/courses" className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm">
          <ChevronLeft className="w-4 h-4" />{t('К каталогу')}</Link>

        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">{t('Неправильные глаголы')}</h1>
          <p className="text-qz-text-muted max-w-2xl">
            Школьная таблица неправильных глаголов: формы по инфинитиву, семейство и перевод.
            Слабые глаголы возвращаются чаще, прочные не мешаются, пока не подошёл их срок.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-qz-text-muted">
            <Loader2 className="w-4 h-4 animate-spin" />{t('Загрузка…')}</div>
        ) : (
          <>
            {/* ---------- Партия ---------- */}
            <div className="bg-qz-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-xs text-qz-text-muted font-semibold uppercase tracking-wider">{t('Партия')}</p>
                  {assignment ? (
                    <p className="text-lg font-bold text-foreground">С {assignment.from} по {assignment.to}</p>
                  ) : (
                    <p className="text-lg font-bold text-foreground">{t('Партия ещё не задана')}</p>
                  )}
                </div>
                {!editingAssignment && (
                  <button
                    onClick={() => setEditingAssignment(true)}
                    className="inline-flex items-center gap-2 border border-border hover:border-[#4255ff]/50 text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> {assignment ? 'Изменить' : 'Задать партию'}
                  </button>
                )}
              </div>

              {editingAssignment && (
                <div className="flex items-end gap-3 flex-wrap">
                  <label className="block">
                    <span className="text-xs text-qz-text-muted font-semibold">{t('С')}</span>
                    <input
                      type="number" min={1} max={MAX_N} value={fromInput}
                      onChange={e => setFromInput(Number(e.target.value))}
                      className="mt-1 w-20 bg-qz-bg border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-[#4255ff]/60"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-qz-text-muted font-semibold">{t('По')}</span>
                    <input
                      type="number" min={1} max={MAX_N} value={toInput}
                      onChange={e => setToInput(Number(e.target.value))}
                      className="mt-1 w-20 bg-qz-bg border border-border rounded-xl px-3 py-2 text-foreground outline-none focus:border-[#4255ff]/60"
                    />
                  </label>
                  <button
                    onClick={saveAssignment}
                    disabled={savingAssignment || fromInput < 1 || toInput < fromInput || toInput > MAX_N}
                    className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-40 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
                  >
                    {savingAssignment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingAssignment(false);
                      if (assignment) { setFromInput(assignment.from); setToInput(assignment.to); }
                    }}
                    className="text-sm text-qz-text-muted hover:text-foreground px-3 py-2.5"
                  >{t('Отмена')}</button>
                </div>
              )}
            </div>

            {/* ---------- Начать занятие ---------- */}
            <div className="space-y-2">
              <button
                onClick={startSession}
                disabled={preview.length === 0}
                className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3344ee] disabled:opacity-40 text-white font-bold px-5 py-3 rounded-xl transition-colors"
              >
                <Play className="w-4 h-4" /> Начать занятие · {preview.length} {cardWord(preview.length)}
              </button>
              {preview.length === 0 && (
                <p className="text-sm text-qz-text-muted">
                  {assignment
                    ? 'Всё выучено на сегодня — новых карточек нет. Загляните позже или расширьте партию.'
                    : 'Сначала задайте партию — например, «с 1 по 20».'}
                </p>
              )}
            </div>

            {/* ---------- Карта прогресса ---------- */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">{t('Карта прогресса')}</h2>
              <p className="text-sm text-qz-text-muted mb-3">{t('125 глаголов, пять страниц — как в таблице. Синяя рамка — текущая партия.')}</p>
              <ProgressMap verbs={VERBS} states={statesByN} assignment={assignment} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
