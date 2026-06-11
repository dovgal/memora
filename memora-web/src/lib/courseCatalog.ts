// Единый список встроенных курсов платформы: каталог, лента на главной, подписки.
// subject — тема верхнего уровня (Языки, Математика, История...), topic — подтема.

export interface CatalogCourse {
  id: string;          // courseId для подписок/прогресса
  href: string;
  title: string;
  description: string;
  subject: string;     // «Языки», «Математика», ...
  topic: string;       // «Французский», ...
  level?: string;      // A1, A2-B1, ...
  emoji: string;
}

export const BUILTIN_COURSES: CatalogCourse[] = [
  {
    id: 'edito-a1', href: '/dashboard/student/courses/edito-a1',
    title: 'Тренажер Édito A1',
    description: '11 юнитов + фонетика, род, числа и пробный DELF A1. Теория, упражнения, озвучка.',
    subject: 'Языки', topic: 'Французский', level: 'A1', emoji: '🇫🇷',
  },
  {
    id: 'french-a1', href: '/dashboard/student/courses/french-a1',
    title: 'Французский A1',
    description: 'Базовый курс с карточками и упражнениями.',
    subject: 'Языки', topic: 'Французский', level: 'A1', emoji: '📘',
  },
  {
    id: 'edito-a2', href: '/dashboard/student/courses/edito-a2',
    title: 'Тренажер Édito A2',
    description: '12 юнитов уровня A2: прошедшие времена, субжонктив, местоимения — с коучем и экзаменами.',
    subject: 'Языки', topic: 'Французский', level: 'A2', emoji: '🇫🇷',
  },
  {
    id: 'french-a2', href: '/dashboard/student/courses/french-a2',
    title: 'Французский A2',
    description: 'Продвинутый тренажёр: диагностика, мой план, классы и лидерборд.',
    subject: 'Языки', topic: 'Французский', level: 'A2', emoji: '📗',
  },
  {
    id: 'mettre-remettre', href: '/dashboard/student/courses/mettre',
    title: 'Mettre & Remettre',
    description: 'Устойчивые выражения с mettre и remettre — с коучем и экзаменами.',
    subject: 'Языки', topic: 'Французский', level: 'A2–B1', emoji: '🗝️',
  },
  {
    id: 'niveau-b1', href: '/dashboard/student/courses/niveau/b1',
    title: 'Французский B1',
    description: 'Рассказ о прошлом, субжонктив, гипотезы, местоимения, пассив, косвенная речь.',
    subject: 'Языки', topic: 'Французский', level: 'B1', emoji: '🔵',
  },
  {
    id: 'niveau-b2', href: '/dashboard/student/courses/niveau/b2',
    title: 'Французский B2',
    description: 'Времена прошлого и passé simple, выбор режима, уступка, причастия + пробный DELF B2.',
    subject: 'Языки', topic: 'Французский', level: 'B2', emoji: '🟣',
  },
  {
    id: 'niveau-c1', href: '/dashboard/student/courses/niveau/c1',
    title: 'Французский C1',
    description: 'Модализация, литературные времена, коннекторы, регистры + пробный DALF C1.',
    subject: 'Языки', topic: 'Французский', level: 'C1', emoji: '🟠',
  },
  {
    id: 'niveau-c2', href: '/dashboard/student/courses/niveau/c2',
    title: 'Французский C2',
    description: 'Синтез, фигуры речи, идиоматика soutenu, аргументация, тонкости грамматики.',
    subject: 'Языки', topic: 'Французский', level: 'C2', emoji: '🔴',
  },
  {
    id: 'niveau-presse', href: '/dashboard/student/courses/niveau/presse',
    title: 'Язык прессы',
    description: 'Лексика и приёмы новостей: заголовки, экономика, общество — мост к DELF B2/DALF.',
    subject: 'Языки', topic: 'Французский', level: 'B1–C1', emoji: '📰',
  },
  {
    id: 'niveau-phonetique', href: '/dashboard/student/courses/niveau/phonetique',
    title: 'Фонетика B1–B2',
    description: 'Интонация, ритм, факультативные liaisons и e caduc — звучать естественно.',
    subject: 'Языки', topic: 'Французский', level: 'B1–B2', emoji: '🔊',
  },
];

/** Тема для пользовательского курса по коду языка. */
export function subjectForLanguage(code?: string): { subject: string; topic: string } {
  const topics: Record<string, string> = {
    fr: 'Французский', en: 'Английский', de: 'Немецкий', es: 'Испанский', ru: 'Русский',
  };
  if (code && topics[code]) return { subject: 'Языки', topic: topics[code] };
  return { subject: 'Другое', topic: 'Разное' };
}
