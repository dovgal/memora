'use client';
// Коуч-режим v2: персональный тренер по курсу.
//
// Что умеет:
// - Стартовый экран с планом на сегодня: повторения по сроку (FSRS), новый материал,
//   лексика, серия дней (streak) и настраиваемая дневная цель.
// - Очередь: сначала просроченные повторения, затем новые упражнения и слова.
// - Автооценка: упражнения сами сообщают долю правильных ответов, тренер ставит
//   рейтинг FSRS автоматически (его можно поменять вручную).
// - ИИ-тьютор «Не понял — объясни» для любого упражнения.
// - После сессии — дополнительная ИИ-практика по слабым местам.

import { useEffect, useMemo, useState, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Brain, Loader2, CheckCircle2, ChevronLeft, Trophy, RotateCcw, Flame,
  HelpCircle, Sparkles, Play, BookOpen, GraduationCap, X,
} from 'lucide-react';
import type { EditoExercise, VocabularyItem, ExerciseResult } from '@/lib/courses/edito-a1';
import { ExerciseRenderer } from '@/components/edito/ExerciseRenderer';
import { VocabQuiz } from '@/components/courses/VocabQuiz';
import {
  getCoachReviews, recordCoachReview, getCoachStats, explainExercise, generatePractice,
  regenerateVariant, getSessionPlan, getCoachRatingStats,
  type CoachReviewEntry, type CoachStats, type SessionPlan, type ExerciseRatingStats,
} from '@/lib/courses/customCoursesApi';
import { computeSkillMastery, type SkillMastery } from '@/lib/courses/skillMastery';

export interface CoachUnit {
  id: string;
  title: string;
  exercises: EditoExercise[];
  vocabulary?: VocabularyItem[];
}

type Rating = 1 | 2 | 3 | 4;

interface QueueItem {
  unitId: string;
  unitTitle: string;
  kind: 'exercise' | 'vocab';
  exercise?: EditoExercise;
  vocab?: VocabularyItem;
  /** id, под которым элемент трекается в FSRS */
  trackId: string;
  isReview: boolean;
  /** Бонусная ИИ-практика — не записывается в FSRS */
  ephemeral?: boolean;
}

interface Props {
  courseId: string;
  courseTitle: string;
  units: CoachUnit[];
  backHref: string;
  /** Для ИИ-генерации практики */
  language?: string;
  level?: string;
}

const RATings_LABELS: Record<Rating, string> = { 1: 'Снова', 2: 'Трудно', 3: 'Хорошо', 4: 'Легко' };

const RATINGS: Array<{ value: Rating; label: string; hint: string; cls: string }> = [
  { value: 1, label: 'Снова', hint: 'не получилось', cls: 'border-red-500/40 text-red-400 hover:bg-red-500/10' },
  { value: 2, label: 'Трудно', hint: 'с ошибками', cls: 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10' },
  { value: 3, label: 'Хорошо', hint: 'почти уверенно', cls: 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10' },
  { value: 4, label: 'Легко', hint: 'без усилий', cls: 'border-[#4255ff]/40 text-[#4255ff] hover:bg-[#4255ff]/10' },
];

/** Типы, для которых сервер умеет генерировать вариант того же правила. */
const VARIANT_TYPES = new Set<string>(['error-hunt', 'grammar-quiz', 'fill-blank', 'sentence-builder', 'dictation']);

function autoRating(result: ExerciseResult): Rating {
  if (result.total <= 0) return 3;
  const pct = result.correct / result.total;
  if (pct >= 0.999) return 4;
  if (pct >= 0.7) return 3;
  if (pct >= 0.4) return 2;
  return 1;
}

export function CoachSession({ courseId, courseTitle, units, backHref, language, level }: Props) {
  const { data: session } = useSession();
  const idToken = session?.id_token as string | undefined;

  const [reviews, setReviews] = useState<CoachReviewEntry[] | null>(null);
  const [stats, setStats] = useState<CoachStats | null>(null);
  // Серверный план сессии: порядок повторений и слабые места. null — фолбэк на локальную очередь.
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  // Статистика оценок — для карты слабых навыков на стартовом экране.
  const [ratingStats, setRatingStats] = useState<ExerciseRatingStats[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'loading' | 'start' | 'session' | 'done'>('loading');
  const [submitting, setSubmitting] = useState(false);
  const [sessionStats, setSessionStats] = useState({ completed: 0, again: 0 });
  const [attempt, setAttempt] = useState(0);

  // Voltaire: вариант упражнения, сгенерированный на повтор (анти-заучивание).
  const [variant, setVariant] = useState<EditoExercise | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  // Показанные предложения по каждому правилу — чтобы варианты не повторялись.
  const avoidRef = useRef<Map<string, string[]>>(new Map());

  // Результат текущего упражнения и предложенная тренером оценка
  const [lastResult, setLastResult] = useState<ExerciseResult | null>(null);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  // ИИ-тьютор: сократическая лестница подсказок.
  // hintLevel: 0 — без помощи, 1 — подсказка, 2 — наводящий вопрос, 3 — полное объяснение.
  // Любая использованная ступень ограничивает авто-рейтинг FSRS до «Трудно».
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainText, setExplainText] = useState<string | null>(null);
  const [explainBusy, setExplainBusy] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);

  // Доп. практика
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  // Слабые элементы текущей сессии (рейтинг 1-2) — для доп. практики
  const [weakTrackIds, setWeakTrackIds] = useState<Set<string>>(new Set());

  // Дневная цель: сколько нового материала за сессию
  const goalKey = `coach-goal-${courseId}`;
  const [newGoal, setNewGoal] = useState(6);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(goalKey);
      if (saved) setNewGoal(Math.max(0, Math.min(20, parseInt(saved, 10) || 6)));
    } catch { /* приватный режим */ }
  }, [goalKey]);
  const saveGoal = (n: number) => {
    setNewGoal(n);
    try { localStorage.setItem(goalKey, String(n)); } catch { /* ignore */ }
  };

  // Все элементы курса: интерактивные упражнения + лексика
  const allItems = useMemo(() => {
    const list: QueueItem[] = [];
    for (const u of units) {
      for (const ex of u.exercises) {
        if (ex.type !== 'theory') {
          list.push({ unitId: u.id, unitTitle: u.title, kind: 'exercise', exercise: ex, trackId: ex.id, isReview: false });
        }
      }
      for (const v of u.vocabulary ?? []) {
        if (v.fr && v.ru) {
          list.push({ unitId: u.id, unitTitle: u.title, kind: 'vocab', vocab: v, trackId: `vocab:${v.fr}`, isReview: false });
        }
      }
    }
    return list;
  }, [units]);

  const vocabPool = useMemo(() => units.flatMap(u => u.vocabulary ?? []), [units]);

  // Раздельные пулы: к повторению / новое
  const pools = useMemo(() => {
    if (!reviews) return { due: [] as QueueItem[], fresh: [] as QueueItem[] };
    const now = Date.now();
    const byKey = new Map<string, CoachReviewEntry>();
    for (const r of reviews) byKey.set(`${r.unitId}::${r.exerciseId}`, r);

    const due: QueueItem[] = [];
    const fresh: QueueItem[] = [];
    for (const item of allItems) {
      const r = byKey.get(`${item.unitId}::${item.trackId}`);
      if (!r) fresh.push({ ...item, isReview: false });
      else if (new Date(r.due).getTime() <= now) due.push({ ...item, isReview: true });
    }
    return { due, fresh };
  }, [reviews, allItems]);

  useEffect(() => {
    if (!idToken) return;
    Promise.allSettled([
      getCoachReviews(courseId, idToken),
      getCoachStats(courseId, idToken),
      getSessionPlan(courseId, idToken),
      getCoachRatingStats(courseId, idToken),
    ]).then(([revRes, statRes, planRes, rsRes]) => {
      setReviews(revRes.status === 'fulfilled' ? revRes.value : []);
      if (statRes.status === 'fulfilled') setStats(statRes.value);
      if (planRes.status === 'fulfilled') setPlan(planRes.value);
      if (rsRes.status === 'fulfilled') setRatingStats(rsRes.value);
      setPhase('start');
    });
  }, [idToken, courseId]);

  // Композиция сессии: повторения в серверном порядке (interleaving по юнитам),
  // затем проработка слабых мест (бонус, не двигает график FSRS), затем новое.
  // Без плана (офлайн/ошибка) — прежняя локальная очередь.
  const composition = useMemo(() => {
    const byKey = new Map(allItems.map(it => [`${it.unitId}::${it.trackId}`, it]));

    let due: QueueItem[];
    if (plan && plan.due.length > 0) {
      due = plan.due
        .map(d => byKey.get(`${d.unitId}::${d.exerciseId}`))
        .filter((it): it is QueueItem => !!it)
        .map(it => ({ ...it, isReview: true }));
    } else {
      due = pools.due.slice(0, 30);
    }

    const dueKeys = new Set(due.map(it => `${it.unitId}::${it.trackId}`));
    const weak: QueueItem[] = (plan?.weak ?? [])
      .map(w => byKey.get(`${w.unitId}::${w.exerciseId}`))
      .filter((it): it is QueueItem => !!it && it.kind === 'exercise' && !dueKeys.has(`${it.unitId}::${it.trackId}`))
      .slice(0, 3)
      .map(it => ({ ...it, isReview: false, ephemeral: true, unitTitle: `Проработка · ${it.unitTitle}` }));

    const fresh = pools.fresh.slice(0, newGoal);
    return { due, weak, fresh };
  }, [plan, pools, allItems, newGoal]);

  // Слабые навыки курса (те же пороги, что на карте навыков) — для кнопки «Проработать».
  const weakSkills = useMemo(
    () => reviews
      ? computeSkillMastery(units, reviews, ratingStats).filter(s => s.status === 'weak').slice(0, 3)
      : [],
    [units, reviews, ratingStats],
  );

  // Voltaire: на повторе (isReview) генерируем НОВЫЙ вариант того же правила,
  // чтобы тренировать навык, а не заучивать текст. Первый показ правила — эталон.
  // Кто получает вариант: error-hunt всегда; grammar-quiz / fill-blank /
  // sentence-builder — если упражнение размечено правилом (rule.skill/point);
  // variantPolicy.regenerateOnRepeat явно включает (true) или выключает (false).
  useEffect(() => {
    setVariant(null);
    const item = queue[index];
    if (!item || item.kind !== 'exercise' || !item.exercise || item.ephemeral) return;
    const ex = item.exercise;
    const policy = ex.variantPolicy?.regenerateOnRepeat;
    const hasRule = !!(ex.rule?.skill || ex.rule?.point);
    const wants = policy === true
      || (policy !== false && (ex.type === 'error-hunt' || (hasRule && VARIANT_TYPES.has(ex.type))));
    if (!wants || !item.isReview || !idToken) return;

    const key = `${item.unitId}::${item.trackId}`;
    const avoid = avoidRef.current.get(key) ?? [];
    let cancelled = false;
    setVariantBusy(true);
    regenerateVariant({
      courseId,
      unitId: item.unitId,
      exerciseId: item.trackId,
      seedExercise: ex,
      format: ex.variantPolicy?.format ?? (ex.type === 'error-hunt' ? 'error-hunt' : 'preserve'),
      avoidSentences: avoid,
      rulePoint: ex.rule?.point,
      ruleTrap: ex.rule?.trap,
      language,
      level,
    }, idToken)
      .then(res => {
        if (cancelled) return;
        setVariant(res.variant);
        const s = res.variant?.sentence;
        if (s) avoidRef.current.set(key, [...avoid, s].slice(-8));
      })
      .catch(() => { /* фолбэк: покажем эталон */ })
      .finally(() => { if (!cancelled) setVariantBusy(false); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, attempt]);

  const startSession = () => {
    const q = [...composition.due, ...composition.weak, ...composition.fresh];
    if (q.length === 0) return;
    setQueue(q);
    setIndex(0);
    setSessionStats({ completed: 0, again: 0 });
    setWeakTrackIds(new Set());
    resetItemState();
    setPhase('session');
  };

  const resetItemState = () => {
    setExerciseDone(false);
    setLastResult(null);
    setManualMode(false);
    setExplainOpen(false);
    setExplainText(null);
    setHintLevel(0);
    setAttempt(a => a + 1);
  };

  const current = queue[index];
  // Авто-рейтинг: результат упражнения, но использованная подсказка ограничивает
  // оценку до «Трудно» — материал с подсказкой ещё не усвоен самостоятельно.
  const rawSuggested: Rating | null = lastResult ? autoRating(lastResult) : null;
  const suggested: Rating | null =
    rawSuggested === null ? null : hintLevel > 0 ? (Math.min(rawSuggested, 2) as Rating) : rawSuggested;

  const advance = (nextQueue: QueueItem[]) => {
    if (index + 1 >= nextQueue.length) {
      setPhase('done');
      // Обновим серию/статистику после сессии
      if (idToken) getCoachStats(courseId, idToken).then(setStats).catch(() => {});
    } else {
      setIndex(i => i + 1);
      resetItemState();
    }
  };

  const handleRate = async (rating: Rating) => {
    if (!current || submitting) return;
    setSubmitting(true);

    if (!current.ephemeral) {
      try {
        // Неверные ответы попытки — в журнал (сырьё для умных дистракторов).
        const answerGiven = lastResult?.wrongAnswers?.length
          ? lastResult.wrongAnswers.slice(0, 5).join('; ')
          : undefined;
        await recordCoachReview(courseId, current.unitId, current.trackId, rating, idToken, answerGiven);
      } catch { /* офлайн — продолжаем */ }
    }

    if (rating <= 2) {
      setWeakTrackIds(prev => new Set(prev).add(`${current.unitId}::${current.trackId}`));
    }

    setSessionStats(s => ({
      completed: s.completed + (rating >= 3 ? 1 : 0),
      again: s.again + (rating === 1 ? 1 : 0),
    }));

    let nextQueue = queue;
    if (rating === 1) {
      nextQueue = [...queue, { ...current }];
      setQueue(nextQueue);
    }

    advance(nextQueue);
    setSubmitting(false);
  };

  /** Ступень лестницы тьютора: 1 — подсказка, 2 — наводящий вопрос, 3 — полное объяснение. */
  const handleTutor = async (step: 1 | 2 | 3) => {
    if (!current || explainBusy) return;
    setExplainOpen(true);
    setExplainBusy(true);
    setHintLevel(prev => Math.max(prev, step));
    try {
      const payload = current.kind === 'vocab'
        ? { type: 'vocabulary', word: current.vocab?.fr, translation: current.vocab?.ru }
        : (variant ?? current.exercise);
      const mode = step === 1 ? 'hint' as const : step === 2 ? 'guide' as const : undefined;
      const res = await explainExercise(payload, undefined, undefined, idToken, mode);
      setExplainText(res.explanation);
    } catch {
      setExplainText('Не удалось получить подсказку. Попробуйте ещё раз чуть позже.');
    } finally {
      setExplainBusy(false);
    }
  };

  /** Прицельная проработка слабого навыка: свежие упражнения строго на этот навык,
   *  с нарастающей сложностью и дистракторами из ошибок ученика. Ephemeral — FSRS не трогает. */
  const startSkillPractice = async (skill: SkillMastery) => {
    if (!idToken || practiceBusy) return;
    setPracticeBusy(true);
    setPracticeError(null);
    try {
      const seed = allItems
        .filter(it => it.kind === 'exercise' && it.exercise?.rule?.skill === skill.skill)
        .map(it => it.exercise)
        .filter((ex): ex is EditoExercise => !!ex)
        .slice(0, 6);
      if (seed.length === 0) {
        setPracticeError('Не нашлось упражнений этого навыка.');
        return;
      }
      const { exercises } = await generatePractice(seed, language, level, 5, idToken, {
        skill: skill.skill,
        rulePoint: skill.point ?? seed[0].rule?.point,
        ruleTrap: seed[0].rule?.trap,
        courseId,
      });
      const bonus: QueueItem[] = (exercises ?? [])
        .filter(ex => ex && ex.id && ex.type)
        .map(ex => ({
          unitId: 'practice',
          unitTitle: `Проработка · ${skill.point ?? skill.skill}`,
          kind: 'exercise' as const,
          exercise: ex,
          trackId: ex.id,
          isReview: false,
          ephemeral: true,
        }));
      if (bonus.length === 0) {
        setPracticeError('Не удалось сгенерировать практику. Попробуйте ещё раз.');
        return;
      }
      setQueue(bonus);
      setIndex(0);
      setSessionStats({ completed: 0, again: 0 });
      setWeakTrackIds(new Set());
      resetItemState();
      setPhase('session');
    } catch (e) {
      setPracticeError(e instanceof Error ? e.message : 'Ошибка генерации');
    } finally {
      setPracticeBusy(false);
    }
  };

  const startPractice = async () => {
    if (!idToken || practiceBusy) return;
    setPracticeBusy(true);
    setPracticeError(null);
    try {
      // Слабые упражнения: из этой сессии + накопленные lapses из reviews
      const lapsedKeys = new Set<string>(weakTrackIds);
      for (const r of reviews ?? []) {
        if (r.lapses > 0) lapsedKeys.add(`${r.unitId}::${r.exerciseId}`);
      }
      const weakExercises = allItems
        .filter(it => it.kind === 'exercise' && lapsedKeys.has(`${it.unitId}::${it.trackId}`))
        .map(it => it.exercise)
        .slice(0, 6);

      if (weakExercises.length === 0) {
        setPracticeError('Слабых мест не найдено — отличная работа!');
        setPracticeBusy(false);
        return;
      }

      const { exercises } = await generatePractice(weakExercises, language, level, 4, idToken, { courseId });
      const bonus: QueueItem[] = (exercises ?? [])
        .filter(ex => ex && ex.id && ex.type)
        .map(ex => ({
          unitId: 'practice',
          unitTitle: 'Доп. практика',
          kind: 'exercise' as const,
          exercise: ex,
          trackId: ex.id,
          isReview: false,
          ephemeral: true,
        }));

      if (bonus.length === 0) {
        setPracticeError('Не удалось сгенерировать практику. Попробуйте ещё раз.');
        setPracticeBusy(false);
        return;
      }

      setQueue(bonus);
      setIndex(0);
      resetItemState();
      setPhase('session');
    } catch (e) {
      setPracticeError(e instanceof Error ? e.message : 'Ошибка генерации');
    } finally {
      setPracticeBusy(false);
    }
  };

  // Сводное усвоение
  const mastery = useMemo(() => {
    if (!reviews) return { learned: 0, total: allItems.length };
    const learnedKeys = new Set(
      reviews.filter(r => r.state === 2).map(r => `${r.unitId}::${r.exerciseId}`)
    );
    let learned = 0;
    for (const item of allItems) {
      if (learnedKeys.has(`${item.unitId}::${item.trackId}`)) learned++;
    }
    return { learned, total: allItems.length };
  }, [reviews, allItems]);

  // ---------- Рендеринг ----------

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-qz-card text-qz-text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (phase === 'start') {
    const dueCount = plan?.dueTotal ?? pools.due.length;
    const planned = composition.due.length + composition.weak.length + composition.fresh.length;
    const estMinutes = Math.max(1, Math.round(planned * 1.2));
    const masteryPct = mastery.total > 0 ? Math.round((mastery.learned / mastery.total) * 100) : 0;

    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors mb-6">
            <ChevronLeft className="w-4 h-4" /> {courseTitle}
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
              <Brain className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Тренировка на сегодня</h1>
              <p className="text-qz-text-muted text-sm">Коуч ведёт вас по курсу до полного усвоения</p>
            </div>
          </div>

          {/* Сегодняшний план */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <Flame className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{stats?.streakDays ?? 0}</p>
              <p className="text-qz-text-muted text-xs">дней подряд</p>
            </div>
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <RotateCcw className="w-5 h-5 text-[#4255ff] mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{dueCount}</p>
              <p className="text-qz-text-muted text-xs">к повторению</p>
            </div>
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <BookOpen className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{composition.fresh.length}</p>
              <p className="text-qz-text-muted text-xs">нового</p>
            </div>
            <div className="bg-qz-card border border-border rounded-2xl p-4 text-center">
              <GraduationCap className="w-5 h-5 text-[#ffcd1f] mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{masteryPct}%</p>
              <p className="text-qz-text-muted text-xs">усвоено</p>
            </div>
          </div>

          {/* Цель */}
          <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-semibold">Новых элементов за сессию</span>
              <span className="text-[#4255ff] font-bold">{newGoal}</span>
            </div>
            <input
              type="range" min={0} max={20} value={newGoal}
              onChange={e => saveGoal(parseInt(e.target.value, 10))}
              className="w-full accent-[#4255ff]"
            />
            <p className="text-qz-text-muted text-xs mt-2">
              Сегодня выполнено повторений: {stats?.todayReviews ?? 0}. Примерное время сессии: ~{estMinutes} мин.
            </p>
            {composition.weak.length > 0 && (
              <p className="text-amber-400 text-xs mt-1">
                В сессию добавлена проработка слабых мест: {composition.weak.length} упр. (не влияет на график повторений)
              </p>
            )}
          </div>

          {/* Прицельная проработка слабых навыков */}
          {weakSkills.length > 0 && (
            <div className="bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5 mb-6">
              <p className="text-foreground text-sm font-semibold mb-3">Слабые навыки — прицельная проработка</p>
              <div className="space-y-2.5">
                {weakSkills.map(s => (
                  <div key={s.skill} className="flex items-center justify-between gap-3">
                    <span className="text-qz-text-muted text-sm line-clamp-1">
                      {s.point ?? s.skill.replace(/-/g, ' ')}
                      <span className="text-amber-400 text-xs"> · ошибок {Math.round(s.errorRate * 100)}%</span>
                    </span>
                    <button
                      onClick={() => startSkillPractice(s)}
                      disabled={practiceBusy}
                      className="inline-flex items-center gap-1.5 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors shrink-0"
                    >
                      {practiceBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Проработать
                    </button>
                  </div>
                ))}
              </div>
              {practiceError && <p className="text-red-400 text-xs mt-2">{practiceError}</p>}
            </div>
          )}

          {planned === 0 ? (
            <div className="text-center py-6">
              <Trophy className="w-10 h-10 text-[#ffcd1f] mx-auto mb-3" />
              <p className="text-foreground font-semibold mb-1">Всё повторено!</p>
              <p className="text-qz-text-muted text-sm mb-4">
                Нет материала к изучению — тренер позовёт вас, когда придёт срок повторения.
              </p>
              <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">← Вернуться к курсу</Link>
            </div>
          ) : (
            <button
              onClick={startSession}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base px-6 py-4 rounded-2xl transition-colors"
            >
              <Play className="w-5 h-5" /> Начать тренировку ({planned})
            </button>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'done') {
    const pct = mastery.total > 0 ? Math.round((mastery.learned / mastery.total) * 100) : 0;
    return (
      <div className="min-h-screen bg-qz-card text-qz-text">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Сессия завершена!</h1>
          <p className="text-qz-text-muted text-sm mb-2">
            Выполнено уверенно: {sessionStats.completed} · Отправлено на повтор: {sessionStats.again}
          </p>
          {stats && (
            <p className="text-amber-400 text-sm mb-6 flex items-center justify-center gap-1.5">
              <Flame className="w-4 h-4" /> Серия: {stats.streakDays} дн. · Сегодня: {stats.todayReviews} повторений
            </p>
          )}
          <div className="bg-qz-card border border-border rounded-2xl p-5 mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <span className="text-foreground text-sm font-medium">Усвоение курса</span>
              <span className="text-qz-text-muted text-xs">{mastery.learned} / {mastery.total}</span>
            </div>
            <div className="h-2 bg-muted rounded-full">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {practiceError && <p className="text-amber-400 text-sm mb-4">{practiceError}</p>}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={startPractice}
              disabled={practiceBusy}
              className="inline-flex items-center gap-2 bg-[#ffcd1f] hover:brightness-110 disabled:opacity-50 text-black font-semibold text-sm px-4 py-2.5 rounded-xl transition-all"
            >
              {practiceBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {practiceBusy ? 'Генерация…' : 'Ещё практика по слабым местам'}
            </button>
            <button
              onClick={() => { setPhase('start'); if (idToken) getCoachReviews(courseId, idToken).then(setReviews).catch(() => {}); }}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Ещё сессия
            </button>
            <Link href={backHref} className="text-[#4255ff] hover:underline text-sm">К курсу</Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Активная сессия ----------

  return (
    <div className="min-h-screen bg-qz-card text-qz-text">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">

        <div className="flex items-center justify-between mb-6">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-foreground text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> {courseTitle}
          </Link>
          <span className="inline-flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
            <Brain className="w-4 h-4" /> Коуч-режим
          </span>
        </div>

        {/* Прогресс сессии */}
        <div className="bg-qz-card border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-foreground text-sm font-medium flex items-center gap-2">
              {current?.ephemeral
                ? <><Sparkles className="w-4 h-4 text-[#ffcd1f]" /> Доп. практика</>
                : current?.isReview
                  ? <><Flame className="w-4 h-4 text-amber-400" /> Повторение</>
                  : <>Новый материал</>}
              <span className="text-qz-text-muted font-normal text-xs">· {current?.unitTitle}</span>
            </span>
            <span className="text-qz-text-muted text-xs">{index + 1} / {queue.length}</span>
          </div>
          <div className="h-2 bg-muted rounded-full">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((index / queue.length) * 100)}%` }}
            />
          </div>
        </div>

        {/* Текущий элемент */}
        {current && current.kind === 'vocab' && current.vocab && (
          <VocabQuiz
            key={`${current.trackId}-${attempt}`}
            item={current.vocab}
            pool={vocabPool}
            onComplete={(result) => { setExerciseDone(true); setLastResult(result ?? null); }}
          />
        )}
        {current && current.kind === 'exercise' && current.exercise && (
          variantBusy ? (
            <div className="bg-qz-card border border-border rounded-2xl p-8 flex items-center justify-center gap-2 text-qz-text-muted text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Подбираю новый пример…
            </div>
          ) : (
            <ExerciseRenderer
              key={`${current.unitId}-${current.trackId}-${attempt}-${variant ? 'v' : 's'}`}
              exercise={variant ?? current.exercise}
              onComplete={(_id, result) => { setExerciseDone(true); setLastResult(result ?? null); }}
            />
          )
        )}

        {/* ИИ-тьютор: лестница подсказок (подсказка → наводящий вопрос → объяснение) */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => handleTutor(1)}
            className="inline-flex items-center gap-1.5 text-qz-text-muted hover:text-[#4255ff] text-xs font-semibold transition-colors"
          >
            <HelpCircle className="w-4 h-4" /> Не понимаю — подскажи
          </button>
        </div>
        {explainOpen && (
          <div className="mt-3 bg-[#4255ff]/5 border border-[#4255ff]/30 rounded-2xl p-4 relative">
            <button onClick={() => setExplainOpen(false)} className="absolute top-3 right-3 text-qz-text-muted hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
            <p className="text-xs font-bold uppercase tracking-wider text-[#4255ff] mb-2">
              {hintLevel >= 3 ? 'Объяснение' : hintLevel === 2 ? 'Наводящий вопрос' : 'Подсказка'}
            </p>
            {explainBusy ? (
              <p className="text-qz-text-muted text-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {hintLevel >= 3 ? 'Готовлю объяснение…' : hintLevel === 2 ? 'Формулирую вопрос…' : 'Готовлю подсказку…'}
              </p>
            ) : (
              <>
                <p className="text-foreground text-sm whitespace-pre-wrap leading-relaxed">{explainText}</p>
                {hintLevel === 1 && (
                  <button
                    onClick={() => handleTutor(2)}
                    className="mt-3 text-[#4255ff] hover:underline text-xs font-semibold"
                  >
                    Всё ещё непонятно → наводящий вопрос
                  </button>
                )}
                {hintLevel === 2 && (
                  <button
                    onClick={() => handleTutor(3)}
                    className="mt-3 text-[#4255ff] hover:underline text-xs font-semibold"
                  >
                    Покажи полное объяснение
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Оценка */}
        <div className="mt-6">
          {exerciseDone ? (
            <div className="bg-qz-card border border-border rounded-2xl p-5">
              {suggested && !manualMode ? (
                <>
                  <p className="text-foreground text-sm font-semibold mb-1">
                    Оценка тренера: <span className={
                      suggested >= 3 ? 'text-emerald-400' : suggested === 2 ? 'text-amber-400' : 'text-red-400'
                    }>{RATings_LABELS[suggested]}</span>
                    {lastResult && <span className="text-qz-text-muted font-normal text-xs"> · {lastResult.correct} из {lastResult.total} верно</span>}
                    {hintLevel > 0 && rawSuggested !== null && rawSuggested > 2 && (
                      <span className="text-amber-400 font-normal text-xs"> · с подсказкой — оценка снижена</span>
                    )}
                  </p>
                  <p className="text-qz-text-muted text-xs mb-4">
                    {suggested === 1 && 'Упражнение вернётся ещё раз в этой сессии.'}
                    {suggested === 2 && 'Повторим скоро, чтобы закрепить.'}
                    {suggested === 3 && 'Отлично! Следующее повторение — через несколько дней.'}
                    {suggested === 4 && 'Блестяще! Интервал повторения увеличен.'}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleRate(suggested)}
                      disabled={submitting}
                      className="inline-flex items-center gap-2 bg-[#4255ff] hover:bg-[#3144e0] disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Далее
                    </button>
                    <button onClick={() => setManualMode(true)} className="text-qz-text-muted hover:text-foreground text-xs underline">
                      Изменить оценку
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-foreground text-sm font-semibold mb-3">Насколько легко далось это упражнение?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {RATINGS.map(r => (
                      <button
                        key={r.value}
                        onClick={() => handleRate(r.value)}
                        disabled={submitting}
                        className={`border rounded-xl px-3 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${r.cls}`}
                      >
                        {r.label}
                        <span className="block text-[10px] font-normal opacity-70">{r.hint}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-qz-text-muted text-xs text-center">Выполните упражнение, чтобы перейти дальше.</p>
          )}
        </div>
      </div>
    </div>
  );
}
