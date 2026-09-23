// Тренерская сводка в конце занятия: заголовок и ОДИН конкретный следующий шаг.
//
// Один, а не список советов: ребёнку и взрослому, которому язык даётся
// тяжело, пять рекомендаций разом читаются как пять упрёков. Тон ободряющий
// при любом результате — человек только что позанимался, это уже хорошо.

export interface CoachingInput {
  /** Доля верных ответов, 0–100. */
  accuracy: number;
  /** Слова, на которых ошибались, — в порядке «самые трудные первыми». */
  weakTerms: string[];
  /** Сколько новых карточек набора ещё не начато. */
  newLeft: number;
  /** Сколько карточек из этого занятия вернутся уже завтра. */
  dueTomorrow: number;
  /** Занятие было «сверх плана»: всё уже повторено, закрепляли заранее. */
  practice: boolean;
}

export function coachingHeading(accuracy: number): string {
  if (accuracy >= 90) return 'Отличная работа!';
  if (accuracy >= 70) return 'Хорошо получается!';
  if (accuracy >= 50) return 'Вы продвинулись!';
  return 'Трудное занятие — и вы его прошли!';
}

/** Русское множественное число: 1 карточка, 2 карточки, 5 карточек, 21 карточка. */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const CARDS: [string, string, string] = ['карточка', 'карточки', 'карточек'];

function listTerms(terms: string[]): string {
  const shown = terms.slice(0, 3).map(t => `«${t}»`);
  return shown.join(', ');
}

export function coachingNextStep(input: CoachingInput): string {
  const { accuracy, weakTerms, newLeft, dueTomorrow, practice } = input;

  if (weakTerms.length > 0 && accuracy < 70) {
    return `Не спешите брать новое: завтра начните с ${listTerms(weakTerms)} — прослушайте их ниже и повторите вслух по разу.`;
  }
  if (weakTerms.length > 0) {
    return `Прослушайте ${listTerms(weakTerms)} ещё раз прямо сейчас — так они быстрее закрепятся к завтрашнему повтору.`;
  }
  if (newLeft > 0) {
    return `Всё верно! Можно брать следующие слова: в наборе ещё ${newLeft} ${pluralRu(newLeft, ['новая карточка', 'новые карточки', 'новых карточек'])}. Ещё одно занятие — минут пять.`;
  }
  if (practice) {
    return 'Всё уже повторено вовремя — сегодня можно отдыхать. Загляните, когда подойдёт срок следующего повтора.';
  }
  if (dueTomorrow > 0) {
    return `Всё верно! Завтра к вам вернутся ${dueTomorrow} ${pluralRu(dueTomorrow, CARDS)} — загляните на пять минут, чтобы слова закрепились надолго.`;
  }
  return 'Всё верно! Следующий повтор тренажёр назначит сам — просто возвращайтесь, когда он напомнит.';
}
