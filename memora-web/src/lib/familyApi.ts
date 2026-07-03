// Клиент API семейного табло: лидерборд семьи + разбивка участника по курсам.

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
  return r.json();
}

export interface FamilyMember {
  userId: string;
  name: string;
  xp: number;
  streakDays: number;
  todayReviews: number;
  totalReviews: number;
  learnedCount: number;
}

export interface MemberCourse {
  courseId: string;
  title: string | null;
  totalReviews: number;
  learned: number;
  weakCount: number;
}

export async function getFamilyBoard(idToken?: string): Promise<FamilyMember[]> {
  const tz = -new Date().getTimezoneOffset();
  return ok(await fetch(`/api/family/board?tz_offset_min=${tz}`, { headers: headers(idToken) }));
}

export async function getMemberCourses(userId: string, idToken?: string): Promise<MemberCourse[]> {
  return ok(await fetch(`/api/family/member/${userId}/courses`, { headers: headers(idToken) }));
}

/** Уровень из XP: каждый следующий дороже (1 → 2 за 50 XP, 5 → 6 уже за 1250). */
export function levelFromXp(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / 50));
}
