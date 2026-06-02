// Клиент API для классов/лидерборда/диагностик/кабинета/аналитики A2.
// Все вызовы идут на относительные /api/a2/* (проксируются Next.js на Rust).

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (idToken) h["Authorization"] = `Bearer ${idToken}`;
  return h;
}

export interface ClassInfo { id: string; name: string; joinCode?: string; join_code?: string; }
export interface LeaderRowApi { name: string; xp: number; streak: number; me: boolean; }
export interface TeacherStudent { user_id: string; name: string; xp: number; last_score: number | null; weak_units: number[]; }
export interface ErrorStat { grammar_point: string; attempts: number; errors: number; error_rate: number; }
export interface AssignmentApi { id: string; topics: string[]; note: string | null; done: boolean; created_at: string; }

export async function createClass(name: string, idToken?: string): Promise<ClassInfo> {
  const r = await fetch("/api/a2/classes", { method: "POST", headers: headers(idToken), body: JSON.stringify({ name }) });
  if (!r.ok) throw new Error(`createClass ${r.status}`);
  return r.json();
}

export async function myClasses(idToken?: string): Promise<ClassInfo[]> {
  const r = await fetch("/api/a2/classes", { headers: headers(idToken) });
  if (!r.ok) throw new Error(`myClasses ${r.status}`);
  return r.json();
}

export async function joinClass(joinCode: string, displayName: string, idToken?: string): Promise<ClassInfo> {
  const r = await fetch("/api/a2/classes/join", { method: "POST", headers: headers(idToken), body: JSON.stringify({ join_code: joinCode, display_name: displayName }) });
  if (!r.ok) throw new Error(`joinClass ${r.status}`);
  return r.json();
}

export async function submitXp(xp: number, streak: number, idToken?: string): Promise<void> {
  try { await fetch("/api/a2/xp", { method: "POST", headers: headers(idToken), body: JSON.stringify({ xp, streak }) }); } catch { /* офлайн — игнор */ }
}

export async function classLeaderboard(joinCode: string, idToken?: string): Promise<LeaderRowApi[]> {
  const r = await fetch(`/api/a2/classes/${encodeURIComponent(joinCode)}/leaderboard`, { headers: headers(idToken) });
  if (!r.ok) throw new Error(`leaderboard ${r.status}`);
  return r.json();
}

export async function submitDiagnostic(
  data: { score_pct: number; right_count: number; total: number; weak_units: number[]; by_skill: Record<string, { r: number; t: number }> },
  idToken?: string
): Promise<void> {
  try { await fetch("/api/a2/diagnostic", { method: "POST", headers: headers(idToken), body: JSON.stringify(data) }); } catch { /* офлайн */ }
}

export async function reportErrorStat(grammarPoint: string, correct: boolean, idToken?: string): Promise<void> {
  try { await fetch("/api/a2/error-stat", { method: "POST", headers: headers(idToken), body: JSON.stringify({ grammar_point: grammarPoint, correct }) }); } catch { /* офлайн */ }
}

export async function errorAnalytics(idToken?: string): Promise<ErrorStat[]> {
  const r = await fetch("/api/a2/analytics/errors", { headers: headers(idToken) });
  if (!r.ok) throw new Error(`analytics ${r.status}`);
  return r.json();
}

export async function teacherOverview(classId: string, idToken?: string): Promise<TeacherStudent[]> {
  const r = await fetch(`/api/a2/teacher/classes/${classId}/overview`, { headers: headers(idToken) });
  if (!r.ok) throw new Error(`overview ${r.status}`);
  return r.json();
}

export async function createAssignment(classId: string, studentId: string, topics: string[], note: string, idToken?: string): Promise<void> {
  const r = await fetch("/api/a2/assignments", { method: "POST", headers: headers(idToken), body: JSON.stringify({ class_id: classId, student_id: studentId, topics, note }) });
  if (!r.ok) throw new Error(`assign ${r.status}`);
}

export async function myAssignments(idToken?: string): Promise<AssignmentApi[]> {
  const r = await fetch("/api/a2/assignments", { headers: headers(idToken) });
  if (!r.ok) throw new Error(`assignments ${r.status}`);
  return r.json();
}
