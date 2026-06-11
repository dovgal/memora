// Клиент API классов v2: мои классы, задания, сообщения, подписки на курсы.

function headers(idToken?: string): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) h['Authorization'] = `Bearer ${idToken}`;
  return h;
}

async function ok<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let message = `HTTP ${r.status}`;
    try { const b = await r.json(); if (b?.error) message = b.error; } catch { /* no body */ }
    throw new Error(message);
  }
  return r.status === 204 || r.status === 201 ? (undefined as T) : r.json();
}

// ---------- Типы ----------

export interface ClassSummary {
  id: string;
  name: string;
  joinCode: string | null;
  members: number;
  teacherName: string | null;
}

export interface MyClasses { teaching: ClassSummary[]; enrolled: ClassSummary[] }

export interface ClassMember { userId: string; name: string; xp: number }

export interface ClassDetail {
  id: string;
  name: string;
  myRole: 'teacher' | 'member';
  joinCode: string | null;
  members: ClassMember[];
}

export interface AssignmentItem {
  id: string;
  title: string;
  description: string;
  courseHref: string | null;
  dueDate: string | null;
  forWholeClass: boolean;
  studentName: string | null;
  done: boolean;
  doneCount: number;
  createdAt: string;
}

export interface ClassMessage {
  id: string;
  author: string;
  isTeacher: boolean;
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface Subscription { courseId: string; title: string; href: string }

// ---------- Классы ----------

export async function getMyClasses(idToken?: string): Promise<MyClasses> {
  return ok(await fetch('/api/classes/mine', { headers: headers(idToken) }));
}

/** Создание класса — существующий эндпоинт A2 (универсальный по сути). */
export async function createClass(name: string, idToken?: string): Promise<{ id: string; join_code: string }> {
  return ok(await fetch('/api/a2/classes', {
    method: 'POST', headers: headers(idToken), body: JSON.stringify({ name }),
  }));
}

export async function joinClass(joinCode: string, displayName?: string, idToken?: string): Promise<{ id: string; name: string }> {
  return ok(await fetch('/api/a2/classes/join', {
    method: 'POST', headers: headers(idToken),
    body: JSON.stringify({ join_code: joinCode, display_name: displayName }),
  }));
}

export async function getClassDetail(classId: string, idToken?: string): Promise<ClassDetail> {
  return ok(await fetch(`/api/classes/${classId}/detail`, { headers: headers(idToken) }));
}

// ---------- Задания ----------

export async function getClassAssignments(classId: string, idToken?: string): Promise<AssignmentItem[]> {
  return ok(await fetch(`/api/classes/${classId}/assignments`, { headers: headers(idToken) }));
}

export async function createAssignment(
  classId: string,
  payload: { title: string; description?: string; studentId?: string; courseHref?: string; dueDate?: string },
  idToken?: string,
): Promise<void> {
  return ok(await fetch(`/api/classes/${classId}/assignments`, {
    method: 'POST', headers: headers(idToken), body: JSON.stringify(payload),
  }));
}

export async function markAssignmentDone(assignmentId: string, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/assignments/${assignmentId}/done`, {
    method: 'POST', headers: headers(idToken),
  }));
}

// ---------- Сообщения ----------

export async function getClassMessages(classId: string, idToken?: string): Promise<ClassMessage[]> {
  return ok(await fetch(`/api/classes/${classId}/messages`, { headers: headers(idToken) }));
}

export async function postClassMessage(classId: string, body: string, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/classes/${classId}/messages`, {
    method: 'POST', headers: headers(idToken), body: JSON.stringify({ body }),
  }));
}

// ---------- Подписки ----------

export async function getSubscriptions(idToken?: string): Promise<Subscription[]> {
  return ok(await fetch('/api/subscriptions', { headers: headers(idToken) }));
}

export async function subscribeCourse(sub: Subscription, idToken?: string): Promise<void> {
  return ok(await fetch('/api/subscriptions', {
    method: 'POST', headers: headers(idToken), body: JSON.stringify(sub),
  }));
}

export async function unsubscribeCourse(courseId: string, idToken?: string): Promise<void> {
  return ok(await fetch(`/api/subscriptions/${encodeURIComponent(courseId)}`, {
    method: 'DELETE', headers: headers(idToken),
  }));
}

// ---------- Роль ----------

export async function setRole(role: 'student' | 'teacher', idToken?: string): Promise<void> {
  const r = await fetch('/api/users/role', {
    method: 'PATCH', headers: headers(idToken), body: JSON.stringify({ role }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}
