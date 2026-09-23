// Поведение лисёнка-помощника: что он делает и говорит в ответ на события.
//
// Здесь только решения — без DOM, таймеров и анимаций, чтобы их можно было
// проверить тестами. Компонент (components/fox/Fox.tsx) исполняет решения:
// меняет позу, запускает прыжок, показывает облачко.

export type FoxEvent =
  | { type: 'correct'; combo?: number }
  | { type: 'wrong' }
  /** Показан новый вопрос — пошёл отсчёт: долго молчит, значит, думает. */
  | { type: 'question' }
  /** Ответ дан любым способом — отсчёт снимается. */
  | { type: 'answered' }
  | { type: 'listen_start' }
  | { type: 'listen_end' }
  | { type: 'levelup'; level: number }
  | { type: 'achievement'; title: string }
  | { type: 'session_end'; correct: number; total: number }
  | { type: 'say'; text: string };

export type FoxPose = 'stand' | 'sit' | 'ball';
export type FoxMood = '' | 'happy' | 'sad' | 'think' | 'listen' | 'sleep';

export interface Reaction {
  pose: FoxPose;
  mood: FoxMood;
  jump?: 'jump' | 'spin';
  wag?: boolean;
  wave?: boolean;
  /** Сколько залпов конфетти: 0 — без салюта. */
  confetti?: number;
  say?: string;
  /** Сколько держать реакцию, прежде чем лисёнок вернётся к своим делам. */
  ms: number;
}

/** Молчание над вопросом дольше этого — лисёнок садится подумать вместе с вами. */
export const THINK_AFTER_MS = 15_000;
/** Ещё дольше — предлагает подсказку. */
export const HINT_AFTER_MS = 30_000;
/** Столько без единого действия — засыпает клубком и исчезает. */
export const SLEEP_AFTER_MS = 120_000;

const CORRECT = ['Верно!', 'Точно!', 'Отлично!', 'Так держать!', 'Браво!', 'Супер, дальше!'];
const WRONG = [
  'Почти! Ошибаться — нормально',
  'Ничего, запомним',
  'Это слово ещё вернётся',
  'Сложное попалось — разберём',
];

export const TIPS = [
  'Вспоминать полезнее, чем перечитывать',
  'Говорите вслух — так слова запоминаются крепче',
  'Лучше 10 минут каждый день, чем час раз в неделю',
  'Ошибки — это то, что мы завтра повторим',
  'Трудное слово? Придумайте смешную ассоциацию',
  'Перед сном повторите пару карточек — память доработает ночью',
  'Сначала послушайте медленно, потом повторите в обычном темпе',
];

export function pick<T>(list: readonly T[], rnd: () => number = Math.random): T {
  return list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
}

/** Приветствие по времени суток — час берётся местный, у человека на устройстве. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро! Позанимаемся?';
  if (hour >= 12 && hour < 18) return 'Добрый день! Пара слов на повторение?';
  if (hour >= 18 && hour < 23) return 'Добрый вечер! Пять минут французского?';
  return 'Не спится? Повторим пару карточек';
}

/** Итог занятия: хвалим за сделанное, а не отчитываем за ошибки. */
export function sessionSummary(correct: number, total: number): string {
  if (total <= 0) return 'Занятие окончено';
  const share = correct / total;
  if (share >= 0.9) return `Блестяще: ${correct} из ${total}!`;
  if (share >= 0.6) return `Хорошая работа: ${correct} из ${total}`;
  return `Главное — позанимались. ${correct} из ${total}, остальное повторим`;
}

/**
 * Реакция на событие. null — событие не требует реакции (например, снятие
 * отсчёта «думает»: это забота компонента, а не поза).
 */
export function react(e: FoxEvent, rnd: () => number = Math.random): Reaction | null {
  switch (e.type) {
    case 'correct': {
      const combo = e.combo ?? 0;
      // Серию отмечаем на круглых числах: иначе каждое сальто подряд
      // перестаёт быть наградой.
      if (combo >= 5 && combo % 5 === 0) {
        return { pose: 'stand', mood: 'happy', jump: 'spin', wag: true, confetti: 1, say: `Серия ×${combo}!`, ms: 1800 };
      }
      return { pose: 'stand', mood: 'happy', jump: 'jump', wag: true, say: pick(CORRECT, rnd), ms: 1400 };
    }
    case 'wrong':
      return { pose: 'stand', mood: 'sad', say: pick(WRONG, rnd), ms: 1900 };
    case 'listen_start':
      return { pose: 'sit', mood: 'listen', say: 'Слушаю…', ms: 60_000 };
    case 'levelup':
      return { pose: 'stand', mood: 'happy', jump: 'spin', wag: true, confetti: 2, say: `Уровень ${e.level}!`, ms: 2400 };
    case 'achievement':
      return { pose: 'stand', mood: 'happy', jump: 'jump', wag: true, confetti: 1, say: `Достижение: ${e.title}`, ms: 2600 };
    case 'session_end':
      return { pose: 'stand', mood: 'happy', wave: true, wag: true, say: sessionSummary(e.correct, e.total), ms: 3200 };
    case 'say':
      return { pose: 'sit', mood: '', say: e.text, ms: 2600 };
    default:
      return null;
  }
}
