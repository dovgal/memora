// Mastery по навыкам: агрегация прогресса FSRS и статистики ошибок по rule.skill.
//
// Сервер отдаёт сырьё (reviews + rating-stats), контент упражнений (с разметкой
// rule.skill) есть только у клиента — и для встроенных курсов (бандл), и для
// пользовательских (JSONB юнитов). Поэтому группировка по навыку живёт здесь.
//
// Упражнения без rule.skill в карту навыков не попадают: навык — это единица
// прицельной проработки, а не произвольное упражнение.

import type { EditoExercise } from '@/lib/courses/edito-a1';
import type { CoachReviewEntry, ExerciseRatingStats } from './customCoursesApi';

export type SkillStatus = 'new' | 'learning' | 'weak' | 'mastered';

export interface SkillMastery {
  /** Ключ навыка (rule.skill), например 'verb-government'. */
  skill: string;
  /** Человекочитаемое пояснение — rule.point первого размеченного упражнения. */
  point?: string;
  /** Юниты, где встречается навык (для перехода к проработке). */
  unitIds: string[];
  /** Упражнений с этим навыком (без theory). */
  exercises: number;
  /** Из них усвоено (FSRS state = Review). */
  learned: number;
  /** Оценок за окно статистики. */
  attempts: number;
  /** Доля ошибок за окно: (Снова + 0.5×Трудно) / попытки. */
  errorRate: number;
  status: SkillStatus;
}

interface SkillAccumulator {
  point?: string;
  unitIds: Set<string>;
  keys: Set<string>; // `${unitId}::${exerciseId}`
}

/** Пороги статусов. Выведены в константы, чтобы настройка была в одном месте. */
const WEAK_MIN_ATTEMPTS = 4;
const WEAK_ERROR_RATE = 0.35;
const MASTERED_MAX_ERROR_RATE = 0.15;

export function computeSkillMastery(
  units: Array<{ id: string; exercises: EditoExercise[] }>,
  reviews: CoachReviewEntry[],
  ratingStats: ExerciseRatingStats[],
): SkillMastery[] {
  // 1. Навык -> упражнения из контента курса.
  const skills = new Map<string, SkillAccumulator>();
  for (const u of units) {
    for (const ex of u.exercises) {
      const skill = ex.rule?.skill;
      if (!skill || ex.type === 'theory') continue;
      let acc = skills.get(skill);
      if (!acc) {
        acc = { point: ex.rule?.point, unitIds: new Set(), keys: new Set() };
        skills.set(skill, acc);
      }
      acc.point ??= ex.rule?.point;
      acc.unitIds.add(u.id);
      acc.keys.add(`${u.id}::${ex.id}`);
    }
  }
  if (skills.size === 0) return [];

  // 2. Индексы прогресса и оценок по ключу упражнения.
  const reviewByKey = new Map(reviews.map(r => [`${r.unitId}::${r.exerciseId}`, r]));
  const statsByKey = new Map(ratingStats.map(s => [`${s.unitId}::${s.exerciseId}`, s]));

  // 3. Агрегация и статус.
  const result: SkillMastery[] = [];
  for (const [skill, acc] of skills) {
    let learned = 0;
    let reviewed = 0;
    let attempts = 0;
    let weightedErrors = 0;
    for (const key of acc.keys) {
      const r = reviewByKey.get(key);
      if (r) {
        reviewed++;
        if (r.state === 2) learned++;
      }
      const s = statsByKey.get(key);
      if (s) {
        attempts += s.attempts;
        weightedErrors += s.again + 0.5 * s.hard;
      }
    }
    const errorRate = attempts > 0 ? weightedErrors / attempts : 0;

    let status: SkillStatus;
    if (reviewed === 0) {
      status = 'new';
    } else if (attempts >= WEAK_MIN_ATTEMPTS && errorRate >= WEAK_ERROR_RATE) {
      status = 'weak';
    } else if (learned === acc.keys.size && errorRate < MASTERED_MAX_ERROR_RATE) {
      status = 'mastered';
    } else {
      status = 'learning';
    }

    result.push({
      skill,
      point: acc.point,
      unitIds: [...acc.unitIds],
      exercises: acc.keys.size,
      learned,
      attempts,
      errorRate,
      status,
    });
  }

  // Слабые — первыми (их прорабатывать), затем изучаемые, новые, усвоенные.
  const order: Record<SkillStatus, number> = { weak: 0, learning: 1, new: 2, mastered: 3 };
  result.sort((a, b) => order[a.status] - order[b.status] || b.errorRate - a.errorRate);
  return result;
}
