// Клиент API для прогресса прохождения тренажёра Edito A1.
// Хранится на сервере (через Rust memora-api), переживает очистку кэша и синхронизируется между устройствами.

const COURSE_ID = 'edito-a1';

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) h['Authorization'] = `Bearer ${idToken}`;
  return h;
}

export interface ProgressEntry {
  unitId: string;
  exerciseId: string;
  completedAt: string;
}

interface CourseProgressResponseApi {
  exercises: Array<{ unit_id: string; exercise_id: string; completed_at: string }>;
}

export async function getCourseProgress(idToken?: string): Promise<ProgressEntry[]> {
  const r = await fetch(`/api/courses/${COURSE_ID}/progress`, { headers: headers(idToken) });
  if (!r.ok) throw new Error(`getCourseProgress ${r.status}`);
  const data: CourseProgressResponseApi = await r.json();
  return data.exercises.map(e => ({ unitId: e.unit_id, exerciseId: e.exercise_id, completedAt: e.completed_at }));
}

export async function recordExerciseProgress(unitId: string, exerciseId: string, idToken?: string): Promise<void> {
  try {
    await fetch(`/api/courses/${COURSE_ID}/progress`, {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify({ unit_id: unitId, exercise_id: exerciseId }),
    });
  } catch { /* офлайн — игнор, синхронизируется при следующем визите */ }
}
