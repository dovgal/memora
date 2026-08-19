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
    subject: 'Французский язык', topic: 'Французский', level: 'A1', emoji: '🇫🇷',
  },
  {
    id: 'french-a1', href: '/dashboard/student/courses/french-a1',
    title: 'Французский A1',
    description: 'Базовый курс с карточками и упражнениями.',
    subject: 'Французский язык', topic: 'Французский', level: 'A1', emoji: '📘',
  },
  {
    id: 'edito-a2', href: '/dashboard/student/courses/edito-a2',
    title: 'Тренажер Édito A2',
    description: '12 юнитов уровня A2: прошедшие времена, субжонктив, местоимения — с коучем и экзаменами.',
    subject: 'Французский язык', topic: 'Французский', level: 'A2', emoji: '🇫🇷',
  },
  {
    id: 'french-a2', href: '/dashboard/student/courses/french-a2',
    title: 'Французский A2',
    description: 'Продвинутый тренажёр: диагностика, мой план, классы и лидерборд.',
    subject: 'Французский язык', topic: 'Французский', level: 'A2', emoji: '📗',
  },
  {
    id: 'mettre-remettre', href: '/dashboard/student/courses/mettre',
    title: 'Mettre & Remettre',
    description: 'Устойчивые выражения с mettre и remettre — с коучем и экзаменами.',
    subject: 'Французский язык', topic: 'Французский', level: 'A2–B1', emoji: '🗝️',
  },
  {
    id: 'niveau-b1', href: '/dashboard/student/courses/niveau/b1',
    title: 'Французский B1',
    description: 'Рассказ о прошлом, субжонктив, гипотезы, местоимения, пассив, косвенная речь.',
    subject: 'Французский язык', topic: 'Французский', level: 'B1', emoji: '🔵',
  },
  {
    id: 'niveau-b2', href: '/dashboard/student/courses/niveau/b2',
    title: 'Французский B2',
    description: 'Времена прошлого и passé simple, выбор режима, уступка, причастия + пробный DELF B2.',
    subject: 'Французский язык', topic: 'Французский', level: 'B2', emoji: '🟣',
  },
  {
    id: 'niveau-c1', href: '/dashboard/student/courses/niveau/c1',
    title: 'Французский C1',
    description: 'Модализация, литературные времена, коннекторы, регистры + пробный DALF C1.',
    subject: 'Французский язык', topic: 'Французский', level: 'C1', emoji: '🟠',
  },
  {
    id: 'niveau-c2', href: '/dashboard/student/courses/niveau/c2',
    title: 'Французский C2',
    description: 'Синтез, фигуры речи, идиоматика soutenu, аргументация, тонкости грамматики.',
    subject: 'Французский язык', topic: 'Французский', level: 'C2', emoji: '🔴',
  },
  {
    id: 'niveau-presse', href: '/dashboard/student/courses/niveau/presse',
    title: 'Язык прессы',
    description: 'Лексика и приёмы новостей: заголовки, экономика, общество — мост к DELF B2/DALF.',
    subject: 'Французский язык', topic: 'Французский', level: 'B1–C1', emoji: '📰',
  },
  {
    id: 'niveau-phonetique', href: '/dashboard/student/courses/niveau/phonetique',
    title: 'Фонетика B1–B2',
    description: 'Интонация, ритм, факультативные liaisons и e caduc — звучать естественно.',
    subject: 'Французский язык', topic: 'Французский', level: 'B1–B2', emoji: '🔊',
  },
  {
    id: 'niveau-lecture', href: '/dashboard/student/courses/niveau/lecture',
    title: 'Lecture suivie — чтение книг',
    description: 'Компаньон к адаптированным книгам: Lupin, Le Rouge et le Noir, Moby Dick, Monte-Cristo.',
    subject: 'Французский язык', topic: 'Французский', level: 'A2–B2', emoji: '📖',
  },
  {
    id: 'niveau-verbes', href: '/dashboard/student/courses/niveau/verbes',
    title: 'Les verbes et leurs prépositions',
    description: 'Глагольные управления: transitif/intransitif, à или de, двойные дополнения, инфинитивы.',
    subject: 'Французский язык', topic: 'Французский', level: 'A2–B2', emoji: '🔗',
  },
  {
    id: 'niveau-homophones', href: '/dashboard/student/courses/niveau/homophones',
    title: 'Омофоны и ловушки',
    description: 'Метод Projet Voltaire: a/à, ce/se, son/sont, leur/leurs, peut/peu… с приёмами подстановки (Astuces).',
    subject: 'Французский язык', topic: 'Французский', level: 'A2–C1', emoji: '🎯',
  },
  {
    id: 'niveau-orthographe', href: '/dashboard/student/courses/niveau/orthographe',
    title: "Orthographe d'usage",
    description: 'Наречия -amment/-emment, удвоение согласных, accents и cédille, омофоны session/cession, voix/voie.',
    subject: 'Французский язык', topic: 'Французский', level: 'B1–C1', emoji: '✒️',
  },
  {
    id: 'niveau-orthotypo', href: '/dashboard/student/courses/niveau/orthotypo',
    title: 'Orthotypographie',
    description: 'Типографика: пробелы перед ; : ! ?, 30 %, 8 h 30, n° 10, кавычки « », M./Mme, État, etc.',
    subject: 'Французский язык', topic: 'Французский', level: 'B2–C1', emoji: '📐',
  },
  {
    id: 'niveau-pro-intersport', href: '/dashboard/student/courses/niveau/pro',
    title: 'Français professionnel — Entretien',
    description: 'Лексика собеседования (Responsable Adjointe, Intersport): договоры, зарплата, управление командой, KPI, клиенты. Карточки FR↔RU с озвучкой.',
    subject: 'Французский язык', topic: 'Французский', level: 'Pro · B1–B2', emoji: '💼',
  },

  // ---------- Программирование ----------
  {
    id: 'coding-python', href: '/coding/python',
    title: 'Python: Академия юных кодеров',
    description: '14 игровых уроков: от первой команды до своей игры. Код запускается прямо в браузере.',
    subject: 'Программирование', topic: 'Python', level: 'С нуля', emoji: '🐍',
  },
  {
    id: 'coding-sql', href: '/coding/sql',
    title: 'SQL: Детектив данных',
    description: 'Дела-уроки: SELECT, WHERE, GROUP BY, JOIN, VIEW, оконные функции. Запросы выполняет Postgres в браузере.',
    subject: 'Программирование', topic: 'SQL', level: 'С нуля', emoji: '🐘',
  },
  {
    id: 'coding-data-analyst', href: '/coding/data-analyst',
    title: 'Python и SQL для аналитика данных',
    description: 'Прикладной трек: выборки, агрегации, соединения и разбор данных на реальных задачах.',
    subject: 'Программирование', topic: 'Аналитика данных', emoji: '📊',
  },
  {
    id: 'coding-oop', href: '/coding/oop',
    title: 'ООП на Python',
    description: 'Классы и объекты, наследование, исключения, classmethod и абстрактные базовые классы.',
    subject: 'Программирование', topic: 'Python', emoji: '⚔️',
  },
  {
    id: 'coding-statistics', href: '/coding/statistics',
    title: 'Статистика и вероятность для аналитика',
    description: '12 уроков: описательные статистики, распределения, проверка гипотез.',
    subject: 'Программирование', topic: 'Статистика', emoji: '🎲',
  },

  // ---------- Здоровье ----------
  {
    id: 'vision-trainer', href: '/vision',
    title: 'Зоркий глаз — гимнастика для глаз',
    description: 'Тренажёр для детей: 17 упражнений с анимацией и таймером, распорядок дня, звёзды и серия дней. Метод Бейтса плюс доказанные привычки.',
    subject: 'Здоровье глаз', topic: 'Гимнастика для глаз', level: 'Детям', emoji: '👁️',
  },

  // ---------- Головоломки ----------
  {
    id: 'cube-rubik', href: '/cube',
    title: 'Кубик Рубика — послойная сборка',
    description: '6 этапов и 8 коротких формул. Каждая — со схемами ходов и объёмной картинкой, что изменится.',
    subject: 'Кубик Рубика', topic: 'Сборка', level: 'С нуля', emoji: '🧩',
  },
];

/** Тема для пользовательского курса по коду языка. */
export function subjectForLanguage(code?: string): { subject: string; topic: string } {
  // Каждый язык — своя рубрика верхнего уровня: пользователь ищет курс
  // по предмету («французский»), а не по общей категории «Языки».
  const topics: Record<string, string> = {
    fr: 'Французский', en: 'Английский', de: 'Немецкий', es: 'Испанский', ru: 'Русский',
  };
  if (code && topics[code]) return { subject: `${topics[code]} язык`, topic: topics[code] };
  return { subject: 'Другое', topic: 'Разное' };
}

/** Рубрика каталога с учётом предметного домена (Subject Packs). */
export function subjectForCourse(subject?: string, language?: string): { subject: string; topic: string } {
  // Предметные домены — самостоятельные рубрики каталога.
  const domains: Record<string, { subject: string; topic: string }> = {
    math: { subject: 'Математика', topic: 'Математика' },
    physics: { subject: 'Физика и химия', topic: 'Физика' },
    history: { subject: 'История', topic: 'История' },
    safety: { subject: 'Электробезопасность', topic: 'Habilitation électrique' },
  };
  if (subject && domains[subject]) return domains[subject];
  return subjectForLanguage(language);
}
