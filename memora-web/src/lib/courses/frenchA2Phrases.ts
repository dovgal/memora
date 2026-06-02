// Модуль ФРАЗ A2: ходовые выражения для реальных ситуаций (CEFR A2).
// + тест на знание фраз + банк фраз для карточек/FSRS.
// + расширенные сложные диктанты и дополнительные диалоги.
// Контент авторский по программе A2, без копирования учебников.

import { normalizeA2 } from "./frenchA2";

// ─────────────────────────────────────────────
// БАНК ФРАЗ A2 (для карточек, теста и плана повторения)
// category — коммуникативная ситуация
// ─────────────────────────────────────────────
export interface A2Phrase {
  id: number;
  category: string;
  fr: string;
  ru: string;
  note?: string; // когда употреблять
}

export const A2_PHRASES: A2Phrase[] = [
  // Знакомство и вежливость
  { id: 1, category: "Знакомство", fr: "Enchanté(e) de faire votre connaissance.", ru: "Приятно познакомиться.", note: "формально" },
  { id: 2, category: "Знакомство", fr: "Comment ça s'écrit ?", ru: "Как это пишется?" },
  { id: 3, category: "Знакомство", fr: "Vous pouvez répéter, s'il vous plaît ?", ru: "Повторите, пожалуйста." },
  { id: 4, category: "Вежливость", fr: "Je vous en prie.", ru: "Пожалуйста / Не за что.", note: "формальный ответ на merci" },
  { id: 5, category: "Вежливость", fr: "Excusez-moi de vous déranger.", ru: "Извините за беспокойство." },
  { id: 6, category: "Вежливость", fr: "Ce n'est pas grave.", ru: "Ничего страшного." },
  // Просьбы и предложения
  { id: 7, category: "Просьбы", fr: "Est-ce que vous pourriez m'aider ?", ru: "Не могли бы вы мне помочь?" },
  { id: 8, category: "Просьбы", fr: "Ça vous dérange si j'ouvre la fenêtre ?", ru: "Вы не против, если я открою окно?" },
  { id: 9, category: "Предложения", fr: "Ça te dit d'aller au cinéma ?", ru: "Не хочешь сходить в кино?", note: "неформально" },
  { id: 10, category: "Предложения", fr: "On pourrait se voir demain ?", ru: "Может, встретимся завтра?" },
  // Мнение
  { id: 11, category: "Мнение", fr: "À mon avis, ...", ru: "По-моему, ..." },
  { id: 12, category: "Мнение", fr: "Je suis d'accord avec toi.", ru: "Я с тобой согласен." },
  { id: 13, category: "Мнение", fr: "Je ne suis pas du tout d'accord.", ru: "Я совершенно не согласен." },
  { id: 14, category: "Мнение", fr: "Je trouve que c'est une bonne idée.", ru: "Я считаю, это хорошая идея." },
  // Чувства
  { id: 15, category: "Чувства", fr: "J'ai hâte de te voir.", ru: "Жду не дождусь встречи с тобой." },
  { id: 16, category: "Чувства", fr: "Ça me fait plaisir.", ru: "Мне это приятно." },
  { id: 17, category: "Чувства", fr: "Je suis désolé(e), je ne peux pas.", ru: "Извини, я не могу." },
  // В магазине / ресторане
  { id: 18, category: "Покупки", fr: "Combien ça coûte ?", ru: "Сколько это стоит?" },
  { id: 19, category: "Покупки", fr: "Je voudrais essayer ce pull.", ru: "Я хотел бы примерить этот свитер." },
  { id: 20, category: "Покупки", fr: "Vous payez comment ? — En carte.", ru: "Как вы платите? — Картой." },
  { id: 21, category: "Ресторан", fr: "L'addition, s'il vous plaît.", ru: "Счёт, пожалуйста." },
  { id: 22, category: "Ресторан", fr: "Qu'est-ce que vous me conseillez ?", ru: "Что вы посоветуете?" },
  // В дороге
  { id: 23, category: "Транспорт", fr: "Pour aller à la gare, s'il vous plaît ?", ru: "Как пройти к вокзалу?" },
  { id: 24, category: "Транспорт", fr: "À quelle heure part le prochain train ?", ru: "Во сколько следующий поезд?" },
  { id: 25, category: "Транспорт", fr: "Je suis perdu(e).", ru: "Я заблудился." },
  // Здоровье
  { id: 26, category: "Здоровье", fr: "Je ne me sens pas bien.", ru: "Я плохо себя чувствую." },
  { id: 27, category: "Здоровье", fr: "J'ai pris rendez-vous chez le médecin.", ru: "Я записался к врачу." },
  // Телефон / переписка
  { id: 28, category: "Связь", fr: "Ne quittez pas, je vous le passe.", ru: "Не вешайте трубку, я вас соединю." },
  { id: 29, category: "Связь", fr: "Je te rappelle plus tard.", ru: "Я перезвоню тебе позже." },
  { id: 30, category: "Связь", fr: "Tu peux m'envoyer un message ?", ru: "Можешь прислать мне сообщение?" },
  // Время и планы
  { id: 31, category: "Планы", fr: "Je suis libre ce week-end.", ru: "Я свободен в эти выходные." },
  { id: 32, category: "Планы", fr: "On se retrouve à quelle heure ?", ru: "Во сколько встречаемся?" },
  { id: 33, category: "Планы", fr: "Ça marche, à demain !", ru: "Договорились, до завтра!" },
  // Затруднения в речи
  { id: 34, category: "В разговоре", fr: "Comment dit-on ... en français ?", ru: "Как сказать ... по-французски?" },
  { id: 35, category: "В разговоре", fr: "Je n'ai pas bien compris.", ru: "Я не совсем понял." },
  { id: 36, category: "В разговоре", fr: "Qu'est-ce que ça veut dire ?", ru: "Что это значит?" },
  // Согласие/отказ
  { id: 37, category: "Реакции", fr: "Avec plaisir !", ru: "С удовольствием!" },
  { id: 38, category: "Реакции", fr: "Pourquoi pas !", ru: "Почему бы и нет!" },
  { id: 39, category: "Реакции", fr: "Malheureusement, je suis pris(e).", ru: "К сожалению, я занят." },
  { id: 40, category: "Реакции", fr: "Tant pis.", ru: "Ну и ладно / Тем хуже." },
];

export function phraseCategories(): string[] {
  return [...new Set(A2_PHRASES.map((p) => p.category))];
}

// ─────────────────────────────────────────────
// ТЕСТ НА ЗНАНИЕ ФРАЗ (RU→FR ввод / выбор)
// Генерируется из банка фраз.
// ─────────────────────────────────────────────
export interface PhraseQuestion {
  id: number;
  category: string;
  prompt: string;     // что нужно сказать (ru)
  accept: string[];   // принимаемые ответы (fr)
  fr: string;         // эталон
  ru: string;
}

export const PHRASE_TEST: PhraseQuestion[] = A2_PHRASES.map((p) => ({
  id: p.id,
  category: p.category,
  prompt: `Скажите по-французски: «${p.ru}»`,
  accept: [normalizeA2(p.fr)],
  fr: p.fr,
  ru: p.ru,
}));

// UUID карты фразы в сид-наборе (для Inworld-TTS).
export function phraseCardUuid(id: number): string {
  return `a2f0a2f0-0000-4a2f-8a2f-${id.toString(16).padStart(12, "0")}`;
}

// ─────────────────────────────────────────────
// СЛОЖНЫЕ ДИКТАНТЫ (многофразовые, до автоматизма)
// level: 1 простой … 3 сложный (несколько предложений, числа, даты)
// ─────────────────────────────────────────────
export interface HardDictation {
  id: number;
  level: 1 | 2 | 3;
  unit: number;
  fr: string;
  ru: string;
}

export const A2_HARD_DICTATIONS: HardDictation[] = [
  { id: 1, level: 1, unit: 1, fr: "Je me suis levé tôt et j'ai pris le bus.", ru: "Я встал рано и сел на автобус." },
  { id: 2, level: 1, unit: 2, fr: "Quand j'étais enfant, je lisais beaucoup.", ru: "В детстве я много читал." },
  { id: 3, level: 2, unit: 5, fr: "La semaine prochaine, nous partirons à Marseille en train.", ru: "На следующей неделе мы поедем в Марсель на поезде." },
  { id: 4, level: 2, unit: 6, fr: "Ajoutez deux œufs, un peu de farine et mélangez doucement.", ru: "Добавьте два яйца, немного муки и осторожно перемешайте." },
  { id: 5, level: 2, unit: 8, fr: "Je ne regarde plus les informations le soir, je préfère lire.", ru: "Я больше не смотрю новости вечером, предпочитаю читать." },
  { id: 6, level: 3, unit: 9, fr: "Pour protéger l'environnement, il faut que nous consommions moins et que nous recyclions davantage.", ru: "Чтобы защитить окружающую среду, нужно меньше потреблять и больше перерабатывать." },
  { id: 7, level: 3, unit: 10, fr: "En arrivant à l'aéroport, j'ai compris que j'avais oublié mon passeport à la maison.", ru: "Приехав в аэропорт, я понял, что забыл паспорт дома." },
  { id: 8, level: 3, unit: 12, fr: "C'est le plus beau paysage que j'aie jamais vu pendant mes voyages.", ru: "Это самый красивый пейзаж, что я когда-либо видел в путешествиях." },
  { id: 9, level: 2, unit: 4, fr: "Mon frère est plus âgé que moi, mais je suis plus grand que lui.", ru: "Мой брат старше меня, но я выше его." },
  { id: 10, level: 3, unit: 7, fr: "Le médecin m'a dit que je devais me reposer et boire beaucoup d'eau.", ru: "Врач сказал, что мне нужно отдыхать и пить много воды." },
  { id: 11, level: 2, unit: 11, fr: "Après mes études, j'ai trouvé un travail dans une grande entreprise.", ru: "После учёбы я нашёл работу в большой компании." },
  { id: 12, level: 3, unit: 3, fr: "Nous avons emménagé dans un appartement plus grand, près du centre-ville.", ru: "Мы переехали в квартиру побольше, рядом с центром города." },
];

// ─────────────────────────────────────────────
// ДОПОЛНИТЕЛЬНЫЕ ДИАЛОГИ (расширение)
// ─────────────────────────────────────────────
export interface DialogueLine { speaker: "bot" | "user"; fr: string; ru: string; }
export interface Dialogue { id: string; unit: number; title: string; scene: string; lines: DialogueLine[]; }

export const A2_DIALOGUES_EXTRA: Dialogue[] = [
  {
    id: "magasin", unit: 9, title: "Au magasin de vêtements", scene: "Вы покупаете одежду.",
    lines: [
      { speaker: "bot", fr: "Bonjour, je peux vous aider ?", ru: "Здравствуйте, могу помочь?" },
      { speaker: "user", fr: "Oui, je cherche un pull en laine.", ru: "Да, я ищу шерстяной свитер." },
      { speaker: "bot", fr: "Quelle taille faites-vous ?", ru: "Какой у вас размер?" },
      { speaker: "user", fr: "Je fais du M. Je peux l'essayer ?", ru: "У меня M. Можно примерить?" },
      { speaker: "bot", fr: "Bien sûr, la cabine est au fond.", ru: "Конечно, примерочная в глубине." },
      { speaker: "user", fr: "Il me va bien, je le prends.", ru: "Он мне подходит, я беру." },
    ],
  },
  {
    id: "hotel", unit: 10, title: "À la réception de l'hôtel", scene: "Вы заселяетесь в отель.",
    lines: [
      { speaker: "bot", fr: "Bonsoir, vous avez une réservation ?", ru: "Добрый вечер, у вас бронь?" },
      { speaker: "user", fr: "Oui, au nom de Petrov, pour deux nuits.", ru: "Да, на имя Петров, на две ночи." },
      { speaker: "bot", fr: "Très bien. Le petit-déjeuner est inclus.", ru: "Отлично. Завтрак включён." },
      { speaker: "user", fr: "À quelle heure est le petit-déjeuner ?", ru: "Во сколько завтрак?" },
      { speaker: "bot", fr: "De 7 h à 10 h. Voici votre clé, chambre 25.", ru: "С 7 до 10. Вот ваш ключ, комната 25." },
    ],
  },
  {
    id: "telephone", unit: 8, title: "Au téléphone", scene: "Вы звоните другу, чтобы договориться.",
    lines: [
      { speaker: "bot", fr: "Allô ? Salut, c'est moi.", ru: "Алло? Привет, это я." },
      { speaker: "user", fr: "Salut ! Ça te dit d'aller au resto ce soir ?", ru: "Привет! Не хочешь сходить в ресторан вечером?" },
      { speaker: "bot", fr: "Bonne idée ! À quelle heure ?", ru: "Хорошая идея! Во сколько?" },
      { speaker: "user", fr: "On se retrouve à 19 h devant le métro ?", ru: "Встретимся в 19 у метро?" },
      { speaker: "bot", fr: "Ça marche, à ce soir !", ru: "Договорились, до вечера!" },
    ],
  },
  {
    id: "travail", unit: 11, title: "Entretien d'embauche", scene: "Короткое собеседование.",
    lines: [
      { speaker: "bot", fr: "Parlez-moi un peu de vous.", ru: "Расскажите немного о себе." },
      { speaker: "user", fr: "J'ai étudié le marketing et j'ai deux ans d'expérience.", ru: "Я изучал маркетинг и имею два года опыта." },
      { speaker: "bot", fr: "Pourquoi voulez-vous travailler chez nous ?", ru: "Почему вы хотите работать у нас?" },
      { speaker: "user", fr: "Parce que votre entreprise est innovante.", ru: "Потому что ваша компания инновационная." },
      { speaker: "bot", fr: "Merci, nous vous rappellerons.", ru: "Спасибо, мы вам перезвоним." },
    ],
  },
  {
    id: "boulangerie", unit: 6, title: "À la boulangerie", scene: "Утренняя покупка хлеба.",
    lines: [
      { speaker: "bot", fr: "Bonjour, vous désirez ?", ru: "Здравствуйте, что желаете?" },
      { speaker: "user", fr: "Une baguette et deux croissants, s'il vous plaît.", ru: "Багет и два круассана, пожалуйста." },
      { speaker: "bot", fr: "Et avec ceci ?", ru: "Что-нибудь ещё?" },
      { speaker: "user", fr: "Ce sera tout, merci. Ça fait combien ?", ru: "Это всё, спасибо. Сколько с меня?" },
      { speaker: "bot", fr: "Quatre euros vingt, s'il vous plaît.", ru: "Четыре евро двадцать, пожалуйста." },
    ],
  },
];
