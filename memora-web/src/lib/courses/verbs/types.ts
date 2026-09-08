// Неправильные глаголы английского: устройство данных.
//
// Курс повторяет школьную таблицу 3ème и намеренно не отходит от неё: номер,
// страница и семейство здесь те же, что у Дамира на бумаге. Задание звучит как
// «выучить с 1 по 20» — значит, номер должен быть первичным ключом, а не
// порядком в нашем списке.

export interface IrregularVerb {
  /** Номер в таблице, 1…125. По нему задаются партии. */
  n: number;
  /** Инфинитив: BE, BEGIN, WRITE. Всегда заглавными, как в таблице. */
  inf: string;
  /** Претерит. Может быть двойным: «WAS, WERE». */
  pret: string;
  /** Причастие прошедшего времени. */
  pp: string;
  /** Перевод на французский, как в таблице: ÊTRE, COMMENCER. */
  fr: string;
  /** Страница таблицы 1…5 — чтобы бумага и приложение совпадали. */
  page: 1 | 2 | 3 | 4 | 5;
}

/**
 * Семейство по совпадению форм — главная мысль таблицы.
 *
 * Не хранится в данных, а выводится из самих форм: так оно не может разойтись
 * с ними при опечатке, и цвет в приложении всегда честен.
 */
export type VerbFamily =
  | 'all-same'  // 3=   : PUT–PUT–PUT
  | 'inf-pret'  // 1/2  : BEAT–BEAT–BEATEN
  | 'inf-pp'    // 1/3  : COME–CAME–COME
  | 'pret-pp'   // 2/3  : KEEP–KEPT–KEPT
  | 'all-diff'; // 3≠   : BEGIN–BEGAN–BEGUN

/** Сравнение форм: регистр и лишние пробелы значения не имеют. */
const same = (a: string, b: string) =>
  a.trim().toUpperCase() === b.trim().toUpperCase();

export function familyOf(v: Pick<IrregularVerb, 'inf' | 'pret' | 'pp'>): VerbFamily {
  const ip = same(v.inf, v.pret);
  const ipp = same(v.inf, v.pp);
  const pp = same(v.pret, v.pp);
  if (ip && ipp) return 'all-same';
  if (pp) return 'pret-pp';
  if (ipp) return 'inf-pp';
  if (ip) return 'inf-pret';
  return 'all-diff';
}

/** Подписи и цвета — те же обозначения, что в углу школьной таблицы. */
export const FAMILY_META: Record<VerbFamily, { mark: string; title: string; color: string }> = {
  'all-same': { mark: '3=',  title: 'Все три одинаковы',        color: '#fdf3d0' },
  'inf-pret': { mark: '1/2', title: 'Инфинитив = претерит',      color: '#d9ecfb' },
  'inf-pp':   { mark: '1/3', title: 'Инфинитив = причастие',     color: '#fbe6d0' },
  'pret-pp':  { mark: '2/3', title: 'Претерит = причастие',      color: '#fbdde8' },
  'all-diff': { mark: '3≠',  title: 'Все три разные',            color: '#d6f2ee' },
};

/**
 * Ступени повторения, в днях.
 *
 * Лесенка, а не расчёт по формуле: подростку должно быть видно, что глагол
 * «поднялся на ступеньку». Ошибся — спускается на одну, а не падает в самый низ:
 * иначе один промах в конце недели обесценивает всю неделю.
 */
export const LADDER_DAYS = [0, 1, 3, 7, 16, 35, 90];

/** Со ступени и выше глагол считается прочным и в занятие не попадает. */
export const SOLID_STEP = 4;

export interface VerbState {
  /** Номер глагола в таблице. */
  n: number;
  /** Ступень лесенки, 0…6. */
  step: number;
  /** Когда снова спросить, в виде «2026-09-11». */
  due: string;
  /** Сколько раз подряд ответил верно — для показа полосы. */
  streak: number;
  /** Сколько всего ошибок: по ним отбираются слабые. */
  misses: number;
}

/** Сколько карточек за одно занятие и как они делятся. */
export const SESSION = {
  total: 30,
  /** Слабые — те, где ошибался: их вперёд всех. */
  weak: 12,
  /** Новых за раз, чтобы партия в 20 вводилась за три захода. */
  fresh: 8,
};
