// Игровой слой: опыт, уровни, серия дней, дневная цель, достижения.
//
// Любой тренажёр сообщает сюда о том, что человек сделал, и получает в ответ,
// чем это обернулось — сколько опыта, не открылось ли достижение. Считает
// сервер (POST /api/game/event), чтобы результат не зависел от устройства.
//
// Токен берём так же, как в courses/ttsInworld.ts — из next-auth сессии,
// с минутным кэшем, чтобы не дёргать getSession() на каждое событие
// (тренажёры зовут reportStudyEvent часто, на каждый верный ответ).

import { getSession } from 'next-auth/react';
import { emitFox } from '@/lib/fox/bus';

export type StudySource = 'flashcards' | 'course' | 'reader' | 'verbs';

export type StudyEvent =
  | { type: 'answer'; source: StudySource; correct: boolean; firstTry: boolean; combo: number }
  | { type: 'pronunciation'; source: StudySource; score: number }
  | { type: 'sentence_built'; source: StudySource; correct: boolean }
  | { type: 'exercise_complete'; source: StudySource }
  | { type: 'session_complete'; source: StudySource; cards: number; correct: number; minutes: number };

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
}

export interface GameUpdate {
  xp: number;
  xpGained: number;
  level: number;
  leveledUp: boolean;
  streakDays: number;
  dailyGoal: number;
  dailyProgress: number;
  newAchievements: Achievement[];
}

let cachedToken: string | null = null;
let cachedAt = 0;

async function authHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (!cachedToken || now - cachedAt > 60_000) {
    try {
      const session = await getSession();
      cachedToken = (session as { id_token?: string } | null)?.id_token ?? null;
      cachedAt = now;
    } catch {
      cachedToken = null;
    }
  }
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

/**
 * Сообщает об учебном событии и возвращает, чем оно обернулось (XP, уровень,
 * достижения). Не считает событие критичным: без сессии или при сетевой
 * ошибке тихо возвращает null — тренажёр не должен спотыкаться о геймификацию.
 */
export async function reportStudyEvent(event: StudyEvent): Promise<GameUpdate | null> {
  foxReactsTo(event);
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch('/api/game/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(event),
    });
    if (!res.ok) return null;
    const update = (await res.json()) as GameUpdate;
    if (update.leveledUp) emitFox({ type: 'levelup', level: update.level });
    for (const a of update.newAchievements ?? []) emitFox({ type: 'achievement', title: a.title });
    return update;
  } catch {
    return null;
  }
}

/**
 * Лисёнок отзывается на ответ сразу, не дожидаясь сервера: радость через
 * полсекунды после ответа уже не читается как награда за него.
 * Построенную фразу не трогаем — упражнение на построение само говорит
 * лисёнку о результате, иначе он обрадовался бы дважды.
 */
function foxReactsTo(event: StudyEvent): void {
  if (event.type === 'answer') emitFox(event.correct ? { type: 'correct', combo: event.combo } : { type: 'wrong' });
  else if (event.type === 'pronunciation' && event.score >= 0.8) emitFox({ type: 'correct' });
  else if (event.type === 'session_complete') emitFox({ type: 'session_end', correct: event.correct, total: event.cards });
}

export interface AchievementCatalogEntry extends Achievement {
  unlocked: boolean;
  unlockedAt: string | null;
}

export interface GameState {
  xp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  streakDays: number;
  longestStreak: number;
  freezes: number;
  dailyGoal: number;
  dailyProgress: number;
  achievements: AchievementCatalogEntry[];
}

/** Текущее состояние игрока + каталог достижений (для HUD и страницы достижений). */
export async function getGameState(): Promise<GameState | null> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return null;
    const res = await fetch('/api/game/me', { headers });
    if (!res.ok) return null;
    return (await res.json()) as GameState;
  } catch {
    return null;
  }
}

export interface FamilyGameMember {
  userId: string;
  name: string;
  level: number;
  /** XP за всё время. */
  xp: number;
  streakDays: number;
  /** XP за последние 7 суток — по нему сортирует сервер. */
  xpThisWeek: number;
}

/** Семейное табло игрового слоя — уровень, серия и XP за неделю каждого. */
export async function getFamilyGameBoard(): Promise<FamilyGameMember[]> {
  try {
    const headers = await authHeaders();
    if (!headers.Authorization) return [];
    const res = await fetch('/api/game/family', { headers });
    if (!res.ok) return [];
    return (await res.json()) as FamilyGameMember[];
  } catch {
    return [];
  }
}
