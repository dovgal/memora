// Игровой слой: опыт, уровни, серия дней, дневная цель, достижения.
//
// Любой тренажёр сообщает сюда о том, что человек сделал, и получает в ответ,
// чем это обернулось — сколько опыта, не открылось ли достижение. Считает
// сервер (POST /api/game/event), чтобы результат не зависел от устройства.
//
// Пока игровой сервер не подключён, отчёт — пустая операция: тренажёры могут
// вызывать его уже сейчас.

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

export async function reportStudyEvent(event: StudyEvent): Promise<GameUpdate | null> {
  void event;
  return null;
}
