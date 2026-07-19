// Клиент API пользовательских курсов (создание/редактирование/прохождение)
// и коуч-режима (интервальное повторение FSRS).

import type { EditoExercise, VocabularyItem } from '@/lib/courses/edito-a1';

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) h['Authorization'] = `Bearer ${idToken}`;
  return h;
}

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try {
      const body = await r.json();
      if (body?.error) message = body.error;
    } catch { /* нет тела */ }
    throw new Error(message);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

// ---------- Типы ----------

export interface CourseSummary {
  id: string;
  title: string;
  description: string;
  language: string;
  level: string;
  /** Предметный домен: 'language' | 'math' | 'physics' | 'history' | … */
  subject: string;
  isPublished: boolean;
  isOwner: boolean;
  unitCount: number;
  updatedAt: string;
}

export interface UnitSummary {
  id: string;
  position: number;
  title: string;
  description: string;
  exerciseCount: number;
}

export interface CourseDetail {
  id: string;
  title: string;
  description: string;
  language: string;
  level: string;
  /** Предметный домен: 'language' | 'math' | 'physics' | 'history' | … */
  subject: string;
  isPublished: boolean;
  isOwner: boolean;
  units: UnitSummary[];
}

export interface UnitDetail {
  id: string;
  courseId: string;
  position: number;
  title: string;
  description: string;
  vocabulary: VocabularyItem[];
  exercises: EditoExercise[];
}

export interface UpsertCoursePayload {
  title: string;
  description?: string;
  language?: string;
  level?: string;
  /** Предметный домен ('language' по умолчанию на сервере). */
  subject?: string;
  isPublished?: boolean;
}

export interface UpsertUnitPayload {
  title: string;
  description?: string;
  position?: number;
  vocabulary: VocabularyItem[];
  exercises: EditoExercise[];
}

// ---------- Курсы ----------

export async function listCourses(idToken?: string): Promise<CourseSummary[]> {
  return ok(await fetch('/api/courses', { headers: headers(idToken) }));
}

export async function createCourse(payload: UpsertCoursePayload, idToken?: string): Promise<{ id: string }> {
  return ok(await fetch('/api/courses', {
    method: 'POST', headers: headers(idToken), body: JSON.stringify(payload),
  }));
}

export async function getCourse(courseId: string, idToken?: string): Promise<CourseDetail> {
  return ok(await fetch(`/api/courses/${courseId}`, { headers: headers(idToken) }));
}

export async function updateCourse(courseId: string, payload: UpsertCoursePayload, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/courses/${courseId}`, {
    method: 'PUT', headers: headers(idToken), body: JSON.stringify(payload),
  }));
}

export async function deleteCourse(courseId: string, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/courses/${courseId}`, { method: 'DELETE', headers: headers(idToken) }));
}

// ---------- Юниты ----------

export async function createUnit(courseId: string, payload: UpsertUnitPayload, idToken?: string): Promise<{ id: string }> {
  return ok(await fetch(`/api/courses/${courseId}/units`, {
    method: 'POST', headers: headers(idToken), body: JSON.stringify(payload),
  }));
}

export async function getUnit(courseId: string, unitId: string, idToken?: string): Promise<UnitDetail> {
  return ok(await fetch(`/api/courses/${courseId}/units/${unitId}`, { headers: headers(idToken) }));
}

/**
 * Юнит с интерфейсом, переведённым на `lang` (fr/en/…): подписи, теория,
 * вопросы и объяснения переводятся LLM (с кэшем на сервере). Изучаемый язык
 * (fr-термины, error-hunt) не трогается. Первый вызов может занять пару секунд.
 */
export async function getTranslatedUnit(courseId: string, unitId: string, lang: string, idToken?: string): Promise<UnitDetail> {
  return ok(await fetch(`/api/courses/${courseId}/units/${unitId}/translated?lang=${encodeURIComponent(lang)}`, { headers: headers(idToken) }));
}

export async function updateUnit(courseId: string, unitId: string, payload: UpsertUnitPayload, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/courses/${courseId}/units/${unitId}`, {
    method: 'PUT', headers: headers(idToken), body: JSON.stringify(payload),
  }));
}

export async function deleteUnit(courseId: string, unitId: string, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/courses/${courseId}/units/${unitId}`, { method: 'DELETE', headers: headers(idToken) }));
}

// ---------- Экспорт лексики курса в набор на повторение ----------

export interface VocabularySetResult {
  setId: string;
  /** Добавлено этим вызовом (дубли пропущены). */
  added: number;
  /** Всего карточек в наборе. */
  total: number;
}

/** Собрать лексику всех юнитов курса в личный набор «Лексика · {курс}» (идемпотентно). */
export async function exportVocabularySet(courseId: string, idToken?: string): Promise<VocabularySetResult> {
  return ok(await fetch(`/api/courses/${courseId}/vocabulary-set`, {
    method: 'POST', headers: headers(idToken),
  }));
}

// ---------- Прогресс (универсальный, как у Édito A1) ----------

export interface ProgressEntry {
  unitId: string;
  exerciseId: string;
  completedAt: string;
}

export async function getCourseProgress(courseId: string, idToken?: string): Promise<ProgressEntry[]> {
  const data = await ok<{ exercises: Array<{ unit_id: string; exercise_id: string; completed_at: string }> }>(
    await fetch(`/api/courses/${courseId}/progress`, { headers: headers(idToken) })
  );
  return data.exercises.map(e => ({ unitId: e.unit_id, exerciseId: e.exercise_id, completedAt: e.completed_at }));
}

export async function recordExerciseProgress(courseId: string, unitId: string, exerciseId: string, idToken?: string): Promise<void> {
  try {
    await fetch(`/api/courses/${courseId}/progress`, {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify({ unit_id: unitId, exercise_id: exerciseId }),
    });
  } catch { /* офлайн — игнор */ }
}

// ---------- Коуч-режим (FSRS) ----------

export interface CoachReviewEntry {
  unitId: string;
  exerciseId: string;
  state: number; // 0=New, 1=Learning, 2=Review, 3=Relearning
  due: string;
  reps: number;
  lapses: number;
}

export async function getCoachReviews(courseId: string, idToken?: string): Promise<CoachReviewEntry[]> {
  const data = await ok<{ reviews: CoachReviewEntry[] }>(
    await fetch(`/api/courses/${courseId}/coach/reviews`, { headers: headers(idToken) })
  );
  return data.reviews;
}

export interface CoachReviewResult {
  state: number;
  due: string;
  scheduledDays: number;
}

/** rating: 1=Снова, 2=Трудно, 3=Хорошо, 4=Легко. answerGiven — неверные ответы попытки. */
export async function recordCoachReview(
  courseId: string, unitId: string, exerciseId: string, rating: 1 | 2 | 3 | 4, idToken?: string,
  answerGiven?: string,
): Promise<CoachReviewResult> {
  return ok(await fetch(`/api/courses/${courseId}/coach/review`, {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ unitId, exerciseId, rating, answerGiven }),
  }));
}

// ---------- Коуч v2: статистика, диагностика ----------

export interface CoachStats {
  streakDays: number;
  todayReviews: number;
  totalReviews: number;
  learnedCount: number;
}

export async function getCoachStats(courseId: string, idToken?: string): Promise<CoachStats> {
  const tz = -new Date().getTimezoneOffset(); // минуты к востоку от UTC
  return ok(await fetch(`/api/courses/${courseId}/coach/stats?tz_offset_min=${tz}`, { headers: headers(idToken) }));
}

/** Распределение оценок по упражнению за окно (для mastery по навыкам). */
export interface ExerciseRatingStats {
  unitId: string;
  exerciseId: string;
  attempts: number;
  again: number;
  hard: number;
}

export async function getCoachRatingStats(
  courseId: string, idToken?: string, days = 30,
): Promise<ExerciseRatingStats[]> {
  const data = await ok<{ days: number; stats: ExerciseRatingStats[] }>(
    await fetch(`/api/courses/${courseId}/coach/rating-stats?days=${days}`, { headers: headers(idToken) })
  );
  return data.stats;
}

// Серверный план сессии: повторения в порядке показа (interleaving по юнитам) + слабые места.
export interface SessionPlanDueEntry {
  unitId: string;
  exerciseId: string;
  state: number;
  due: string;
}

export interface SessionPlanWeakEntry {
  unitId: string;
  exerciseId: string;
  attempts: number;
  errorRate: number;
}

export interface SessionPlan {
  due: SessionPlanDueEntry[];
  /** Всего просрочено (может превышать due.length из-за лимита сессии). */
  dueTotal: number;
  weak: SessionPlanWeakEntry[];
}

export async function getSessionPlan(courseId: string, idToken?: string): Promise<SessionPlan> {
  return ok(await fetch(`/api/courses/${courseId}/coach/session-plan`, { headers: headers(idToken) }));
}

/** «Я уже знаю это» — пометить упражнения юнита усвоенными. */
export async function markUnitKnown(courseId: string, unitId: string, exerciseIds: string[], idToken?: string): Promise<void> {
  return ok(await fetch(`/api/courses/${courseId}/coach/mark-known`, {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ unitId, exerciseIds }),
  }));
}

// ---------- ИИ-тьютор и практика ----------

/**
 * ИИ-тьютор. mode — ступень сократической лестницы:
 * 'hint' — подсказка без ответа, 'guide' — наводящий вопрос,
 * undefined — полное объяснение (как раньше).
 */
export async function explainExercise(
  exercise: unknown, userAnswer?: string, question?: string, idToken?: string,
  mode?: 'hint' | 'guide',
): Promise<{ explanation: string }> {
  return ok(await fetch('/api/ai/course/explain', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ exercise, userAnswer, question, mode }),
  }));
}

/** Прицельная проработка навыка: focus передаёт навык, правило и курс (для умных дистракторов). */
export interface PracticeFocus {
  skill?: string;
  rulePoint?: string;
  ruleTrap?: string;
  courseId?: string;
}

export async function generatePractice(
  weakExercises: unknown[], language?: string, level?: string, count?: number, idToken?: string,
  focus?: PracticeFocus,
): Promise<{ exercises: EditoExercise[] }> {
  return ok(await fetch('/api/ai/course/generate-practice', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ weakExercises, language, level, count, ...focus }),
  }));
}

export interface ConverseTurn { role: 'user' | 'assistant'; content: string }
export interface ConverseReply { reply: string; translation: string; correction: string | null }

export async function converse(
  messages: ConverseTurn[], opts: { language?: string; level?: string; scenario?: string }, idToken?: string,
): Promise<ConverseReply> {
  return ok(await fetch('/api/ai/course/converse', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ messages, ...opts }),
  }));
}

export interface GlossaryItem { word: string; ru: string }

export interface GeneratedStory {
  title: string;
  story: string;
  translation: string;
  /** Ключевые слова истории с переводом (кликабельное чтение + cloze-проверка). */
  glossary?: GlossaryItem[];
}

export async function generateStory(
  vocabulary: VocabularyItem[],
  opts: { language?: string; level?: string; topic?: string; difficulty?: 'easier' | 'harder' },
  idToken?: string,
): Promise<GeneratedStory> {
  return ok(await fetch('/api/ai/course/story', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ vocabulary, ...opts }),
  }));
}

/** CAS-проверка символьного ответа: «2(x+1)» эквивалентно «2x+2». 503 — сервис не настроен. */
export async function checkSymbolic(
  expected: string, given: string, idToken?: string,
): Promise<{ correct: boolean }> {
  return ok(await fetch('/api/check/symbolic', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ expected, given }),
  }));
}

/** Добавить слово в личный словарь курса (набор «Словарь · {курс}», FSRS-цикл наборов). */
export async function addToDictionary(
  courseId: string, term: string, definition: string, idToken?: string,
): Promise<{ setId: string; alreadyExists: boolean }> {
  return ok(await fetch(`/api/courses/${courseId}/dictionary`, {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify({ term, definition }),
  }));
}

// ---------- Voltaire: регенерация варианта на повторе ----------

export interface RegenerateVariantParams {
  courseId: string;
  unitId: string;
  /** Ключ ПРАВИЛА (= exerciseId в ревью коуча). */
  exerciseId: string;
  /** Эталонное упражнение (задаёт смысл правила). */
  seedExercise: EditoExercise;
  /** 'error-hunt' (по умолчанию) | 'preserve'. */
  format?: 'error-hunt' | 'preserve';
  /** Последние показанные предложения — чтобы не повторяться. */
  avoidSentences?: string[];
  /** Явная формулировка правила (если размечено). */
  rulePoint?: string;
  ruleTrap?: string;
  language?: string;
  level?: string;
}

export interface RegeneratedVariant {
  variant: EditoExercise;
  ruleId: string;
  /** true — вернулся фолбэк (кэш/эталон), а не свежая генерация. */
  fallback: boolean;
}

/**
 * Генерирует НОВЫЙ вариант того же правила (какография «найди ошибку»).
 * Вызывать на повторе упражнения (reps > 0). Первый показ — эталон.
 */
export async function regenerateVariant(
  params: RegenerateVariantParams, idToken?: string,
): Promise<RegeneratedVariant> {
  return ok(await fetch('/api/ai/course/regenerate-variant', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify(params),
  }));
}

// ---------- ИИ-генерация юнита ----------

export interface GeneratedUnitContent {
  vocabulary?: VocabularyItem[];
  exercises?: EditoExercise[];
}

export async function generateUnitWithAI(
  params: { topic: string; sourceText?: string; language?: string; level?: string; count?: number; subject?: string },
  idToken?: string,
): Promise<GeneratedUnitContent> {
  return ok(await fetch('/api/ai/course/generate-unit', {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify(params),
  }));
}
