// Правила «Разговора дня» на стороне клиента: когда можно завершать, как
// показывать мягкий таймер, когда лисёнку напомнить о разговоре вечером.
//
// Чистые функции без импортов — тестируются node:test без DOM и сети.
// Порог засчёта — зеркало MIN_TURNS/MIN_MINUTES в
// memora-api/src/handlers/challenge.rs; сервер присылает свои значения в
// GET /api/challenge/today, здешние — только запасные.

export const MIN_TURNS = 4;
export const MIN_MINUTES = 3;
/** Сколько длится разговор «по плану». Таймер мягкий: не обрывает. */
export const TARGET_MINUTES = 5;
/** С этого часа (по часам устройства) лисёнок напоминает о разговоре. */
export const EVENING_HOUR = 18;

export interface Threshold {
  minTurns: number;
  minMinutes: number;
}

const DEFAULT_THRESHOLD: Threshold = { minTurns: MIN_TURNS, minMinutes: MIN_MINUTES };

/** Разговор состоялся: достаточно своих реплик ИЛИ достаточно времени. */
export function canFinish(turns: number, elapsedMs: number, t: Threshold = DEFAULT_THRESHOLD): boolean {
  return turns >= t.minTurns || elapsedMs >= t.minMinutes * 60_000;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * Что осталось до кнопки «Завершить». Показываем ближайшую из двух дорог,
 * а не обе: «ещё 1 реплика» понятнее, чем «ещё 1 реплика или 2 минуты».
 * Пустая строка — порог уже пройден.
 */
export function remainingHint(turns: number, elapsedMs: number, t: Threshold = DEFAULT_THRESHOLD): string {
  if (canFinish(turns, elapsedMs, t)) return '';
  const turnsLeft = t.minTurns - turns;
  const minutesLeft = Math.max(1, Math.ceil(t.minMinutes - elapsedMs / 60_000));
  if (turnsLeft <= minutesLeft) {
    return `Ещё ${turnsLeft} ${pluralRu(turnsLeft, 'реплика', 'реплики', 'реплик')} — и можно завершать`;
  }
  return `Ещё ${turnsLeft} ${pluralRu(turnsLeft, 'реплика', 'реплики', 'реплик')} или ${minutesLeft} ${pluralRu(minutesLeft, 'минута', 'минуты', 'минут')} разговора`;
}

/** 0 → «0:00», 65 000 → «1:05». Отрицательное и NaN — как ноль. */
export function formatClock(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Доля мягкого таймера, 0…1 — для полоски. После 5 минут стоит на 1. */
export function timerProgress(elapsedMs: number, targetMinutes = TARGET_MINUTES): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(1, elapsedMs / (targetMinutes * 60_000));
}

/** Ключ дня по часам устройства: «2026-09-24». Для «раз в день» на клиенте. */
export function localDayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Напоминать ли вечером. Только после 18:00, только если разговор не
 * сделан, и не чаще раза в день — назойливый лисёнок хуже молчащего.
 */
export function shouldNudgeEvening(now: Date, done: boolean, lastNudgeDay: string | null): boolean {
  if (done) return false;
  if (now.getHours() < EVENING_HOUR) return false;
  return lastNudgeDay !== localDayKey(now);
}

/** Похвала по итогу — для лисёнка и карточки итога. */
export function praiseFor(turns: number, minutes: number, allGoals: boolean): string {
  if (allGoals) return 'Все задачи выполнены — отличный разговор!';
  if (minutes >= TARGET_MINUTES || turns >= 8) return 'Настоящий разговор! Так и держать';
  return 'Поговорили — это главное. До завтра!';
}
