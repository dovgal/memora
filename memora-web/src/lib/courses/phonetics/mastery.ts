// Учёт усвоения фонетических блоков.
//
// «До полного усвоения» = единица считается сданной, когда произнесена с
// точностью не ниже порога. Несданные возвращаются в очередь через несколько
// позиций — в пределах той же сессии, чтобы ученик не зубрил подряд, но и не
// уходил с невыполненным.
//
// Список сданных единиц живёт НА СЕРВЕРЕ, в общей таблице прогресса курсов:
// блок играет роль юнита, текст единицы — упражнения. Раньше он лежал только в
// браузере, и при чтении с ноутбука, телефона и планшета выходило три
// независимых счёта, а очистка данных стирала всё начисто.
//
// Здесь этот список кэшируется, чтобы отрисовка не ждала сети. Число попыток и
// лучшая точность остаются местными: это статистика занятия, а не прогресс.

export const PASS_SCORE = 80;
/** Через сколько позиций несданная единица вернётся в очередь. */
export const REQUEUE_GAP = 3;

export interface DrillProgress {
  /** Тексты сданных единиц. */
  passed: string[];
  /** Всего попыток по блоку. */
  attempts: number;
  /** Лучшая средняя точность, %. */
  best: number;
  /** ISO-дата последнего занятия. */
  lastAt?: string;
}

export type PhoneticsProgress = Record<string, DrillProgress>;

const KEY = 'memora.phonetics.progress.v1';

// Кэш нужен, чтобы снимок был референциально стабильным: без него
// useSyncExternalStore на каждом рендере получал бы новый объект и зациклился.
let cache: PhoneticsProgress | null = null;
const listeners = new Set<() => void>();
/** Пустой снимок для сервера — стабильная ссылка, иначе гидратация зациклится. */
const EMPTY: PhoneticsProgress = {};

function readStorage(): PhoneticsProgress {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PhoneticsProgress) : {};
  } catch {
    return {};
  }
}

export function loadProgress(): PhoneticsProgress {
  if (cache === null) cache = readStorage();
  return cache;
}

export function saveProgress(p: PhoneticsProgress): void {
  cache = p;
  if (typeof window !== 'undefined') {
    try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* приватный режим */ }
  }
  for (const l of listeners) l();
}

/** Подписка для useSyncExternalStore. */
export function subscribeProgress(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
export function getProgressSnapshot(): PhoneticsProgress { return loadProgress(); }
export function getServerProgressSnapshot(): PhoneticsProgress { return EMPTY; }

/**
 * Ключ единицы для серверной записи. Обрезаем одинаково при записи и чтении:
 * скороговорка длиннее иного абзаца, а сравнивать ключи надо посимвольно.
 */
export function itemKey(text: string): string {
  return text.trim().slice(0, 200);
}

/**
 * Влить прогресс, пришедший с сервера. Списки объединяются, а не заменяются:
 * пока запрос летел, человек мог сдать ещё одну единицу, и терять её нельзя.
 */
export function hydrate(entries: { unitId: string; exerciseId: string; completedAt?: string }[]): void {
  const all = { ...loadProgress() };
  for (const e of entries) {
    const cur: DrillProgress = all[e.unitId] ?? { passed: [], attempts: 0, best: 0 };
    if (cur.passed.includes(e.exerciseId)) continue;
    all[e.unitId] = { ...cur, passed: [...cur.passed, e.exerciseId], lastAt: e.completedAt ?? cur.lastAt };
  }
  saveProgress(all);
}

export function markPassed(drillId: string, itemText: string, score: number): PhoneticsProgress {
  const all = loadProgress();
  const cur: DrillProgress = all[drillId] ?? { passed: [], attempts: 0, best: 0 };
  const key = itemKey(itemText);
  const passed = cur.passed.includes(key) ? cur.passed : [...cur.passed, key];
  all[drillId] = {
    passed,
    attempts: cur.attempts + 1,
    best: Math.max(cur.best, score),
    lastAt: new Date().toISOString(),
  };
  saveProgress(all);
  return all;
}

export function markAttempt(drillId: string, score: number): PhoneticsProgress {
  const all = loadProgress();
  const cur: DrillProgress = all[drillId] ?? { passed: [], attempts: 0, best: 0 };
  all[drillId] = { ...cur, attempts: cur.attempts + 1, best: Math.max(cur.best, score), lastAt: new Date().toISOString() };
  saveProgress(all);
  return all;
}

/** Доля усвоенного материала блока, 0…1. */
export function drillMastery(p: PhoneticsProgress, drillId: string, totalItems: number): number {
  if (totalItems === 0) return 0;
  const done = p[drillId]?.passed.length ?? 0;
  return Math.min(1, done / totalItems);
}

export function resetDrill(drillId: string): PhoneticsProgress {
  const all = loadProgress();
  delete all[drillId];
  saveProgress(all);
  return all;
}
