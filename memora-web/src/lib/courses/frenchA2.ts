// Курс «Французский A2» в Memora.
// Структура и темы соответствуют программе учебника Édito A2 (Didier FLE, 2e éd. 2022),
// 12 юнитов. Весь контент (правила, примеры, слова, задания) написан с нуля по программе —
// без копирования текста/аудио учебника (соблюдение авторских прав).
//
// Используется на странице /dashboard/student/courses/french-a2.

export type A2QuestionType = "mc" | "text";
export type A2Skill = "grammar" | "vocab" | "listening" | "speaking";

export interface A2Question {
  id: number;
  unit: number;             // 1..12
  skill: A2Skill;
  grammarPoint: string;     // ключевая тема (passé composé, gérondif, ...)
  type: A2QuestionType;
  prompt: string;
  options?: string[];
  answerIndex?: number;
  accept?: string[];
  speak?: string;           // фраза для озвучивания / произношения
  explanation: string;
}

export interface A2VocabCard {
  fr: string;     // французское слово/фраза
  ru: string;     // перевод
  example?: string;
}

export interface A2GrammarRule {
  point: string;
  rule: string;       // краткое правило
  examples: string[]; // примеры
}

export interface A2Unit {
  n: number;
  title: string;          // тема юнита (Édito A2)
  titleRu: string;
  objectives: string[];   // коммуникативные цели
  grammar: A2GrammarRule[];
  vocab: A2VocabCard[];
}

// ──────────────────────────────────────────────────────────────────────────
// 12 ЮНИТОВ Édito A2
// ──────────────────────────────────────────────────────────────────────────
export const A2_UNITS: A2Unit[] = [
  {
    n: 1, title: "Nouvelles vies", titleRu: "Новая жизнь",
    objectives: ["Рассказать о переменах в жизни", "Говорить о прошлом (passé composé)", "Описывать действия в прошлом"],
    grammar: [
      { point: "Passé composé", rule: "Прошедшее завершённое: avoir/être (présent) + participe passé. Большинство глаголов с avoir; глаголы движения/состояния и возвратные — с être (тогда причастие согласуется в роде/числе с подлежащим).",
        examples: ["J'ai mangé une pomme.", "Elle est arrivée hier.", "Nous nous sommes levés tôt."] },
      { point: "Négation au passé composé", rule: "ne ... pas обрамляет вспомогательный глагол: ne + avoir/être + pas + participe.",
        examples: ["Je n'ai pas compris.", "Il n'est pas venu."] },
    ],
    vocab: [
      { fr: "déménager", ru: "переезжать", example: "Nous allons déménager à Lyon." },
      { fr: "un changement", ru: "перемена" },
      { fr: "recommencer", ru: "начинать заново" },
      { fr: "une étape", ru: "этап" },
      { fr: "s'installer", ru: "обустраиваться, поселиться" },
      { fr: "quitter", ru: "покидать" },
    ],
  },
  {
    n: 2, title: "Je me souviens", titleRu: "Я помню",
    objectives: ["Рассказывать о воспоминаниях", "Описывать прошлое (imparfait)", "Противопоставлять imparfait и passé composé"],
    grammar: [
      { point: "Imparfait", rule: "Прошедшее описательное (фон, привычки, состояния). Основа = форма nous в présent без -ons + окончания -ais, -ais, -ait, -ions, -iez, -aient.",
        examples: ["Quand j'étais petit, je jouais dehors.", "Il faisait beau.", "Nous habitions à Paris."] },
      { point: "Imparfait vs passé composé", rule: "Imparfait — фон/привычка/описание; passé composé — конкретное завершённое действие, продвигающее сюжет.",
        examples: ["Je lisais quand le téléphone a sonné.", "Il pleuvait, alors nous sommes restés."] },
    ],
    vocab: [
      { fr: "un souvenir", ru: "воспоминание" },
      { fr: "se rappeler", ru: "вспоминать" },
      { fr: "l'enfance (f)", ru: "детство" },
      { fr: "autrefois", ru: "раньше, в прошлом" },
      { fr: "à l'époque", ru: "в ту пору" },
      { fr: "une habitude", ru: "привычка" },
    ],
  },
  {
    n: 3, title: "Comme à la maison", titleRu: "Как дома",
    objectives: ["Описывать жильё", "Использовать местоимения y и en", "Говорить о месте и количестве"],
    grammar: [
      { point: "Pronoms Y et EN", rule: "Y заменяет место/предлог à + вещь (J'y vais). EN заменяет de + вещь и количества (J'en ai trois).",
        examples: ["Tu vas à Paris ? — J'y vais demain.", "Tu veux du café ? — Oui, j'en veux.", "Des amis ? J'en ai beaucoup."] },
      { point: "Place de l'adjectif", rule: "Большинство прилагательных — после существительного; короткие частые (beau, bon, grand, petit, jeune, nouveau, vieux) — перед.",
        examples: ["une grande maison", "un appartement moderne", "un nouveau quartier"] },
    ],
    vocab: [
      { fr: "un logement", ru: "жильё" },
      { fr: "louer", ru: "снимать (арендовать)" },
      { fr: "un loyer", ru: "арендная плата" },
      { fr: "un meuble", ru: "предмет мебели" },
      { fr: "le quartier", ru: "квартал, район" },
      { fr: "emménager", ru: "въезжать (в жильё)" },
    ],
  },
  {
    n: 4, title: "Tous pareils, tous différents", titleRu: "Все похожи, все разные",
    objectives: ["Сравнивать людей и вещи", "Использовать относительные местоимения", "Описывать характер"],
    grammar: [
      { point: "Comparatif", rule: "plus / moins / aussi + прилагательное + que. Особое: bon → meilleur, bien → mieux.",
        examples: ["Il est plus grand que moi.", "Elle parle mieux que lui.", "C'est un meilleur film."] },
      { point: "Pronoms relatifs qui, que, où", rule: "qui — подлежащее, que — дополнение, où — место/время.",
        examples: ["L'homme qui parle est mon prof.", "Le livre que je lis est intéressant.", "La ville où j'habite est belle."] },
    ],
    vocab: [
      { fr: "ressembler à", ru: "быть похожим на" },
      { fr: "la différence", ru: "различие" },
      { fr: "le caractère", ru: "характер" },
      { fr: "généreux / généreuse", ru: "щедрый" },
      { fr: "timide", ru: "застенчивый" },
      { fr: "partager", ru: "делить, разделять" },
    ],
  },
  {
    n: 5, title: "En route vers le futur !", titleRu: "В будущее!",
    objectives: ["Говорить о планах и прогнозах", "Использовать futur simple", "Говорить о технологиях"],
    grammar: [
      { point: "Futur simple", rule: "Инфинитив + окончания -ai, -as, -a, -ons, -ez, -ont (для -re убираем e). Есть неправильные основы: être→ser-, avoir→aur-, aller→ir-, faire→fer-.",
        examples: ["Je parlerai français.", "Nous serons là.", "Ils iront en France."] },
      { point: "Futur proche vs futur simple", rule: "Futur proche (aller + inf.) — близкое/намеченное; futur simple — общее будущее/прогноз.",
        examples: ["Je vais partir maintenant.", "Un jour, je voyagerai partout."] },
    ],
    vocab: [
      { fr: "l'avenir (m)", ru: "будущее" },
      { fr: "une invention", ru: "изобретение" },
      { fr: "un progrès", ru: "прогресс" },
      { fr: "prévoir", ru: "предвидеть, планировать" },
      { fr: "un robot", ru: "робот" },
      { fr: "améliorer", ru: "улучшать" },
    ],
  },
  {
    n: 6, title: "En cuisine", titleRu: "На кухне",
    objectives: ["Говорить о еде и рецептах", "Использовать партитивные артикли", "Давать инструкции (impératif)"],
    grammar: [
      { point: "Articles partitifs", rule: "du, de la, de l', des — неопределённое количество. После отрицания → de. Количество (un kilo de…) → de.",
        examples: ["Je mange du pain.", "Elle boit de l'eau.", "Je ne mange pas de viande.", "un litre de lait"] },
      { point: "Impératif", rule: "Повелительное наклонение: формы tu/nous/vous без местоимения; у -er глаголов tu без -s.",
        examples: ["Mange tes légumes !", "Ajoutez du sel.", "Mélangeons bien."] },
    ],
    vocab: [
      { fr: "une recette", ru: "рецепт" },
      { fr: "ajouter", ru: "добавлять" },
      { fr: "mélanger", ru: "смешивать" },
      { fr: "un ingrédient", ru: "ингредиент" },
      { fr: "couper", ru: "резать" },
      { fr: "cuire", ru: "готовить (варить/печь)" },
    ],
  },
  {
    n: 7, title: "À votre santé !", titleRu: "За ваше здоровье!",
    objectives: ["Говорить о здоровье и теле", "Давать советы", "Использовать местоимения COD/COI"],
    grammar: [
      { point: "Pronoms COD", rule: "Прямое дополнение: me, te, le/la, nous, vous, les — ставятся перед глаголом.",
        examples: ["Tu vois Marie ? — Je la vois.", "Les clés ? Je les ai."] },
      { point: "Pronoms COI", rule: "Косвенное дополнение (à qqn): me, te, lui, nous, vous, leur.",
        examples: ["Je parle à Paul → Je lui parle.", "J'écris à mes amis → Je leur écris."] },
    ],
    vocab: [
      { fr: "la santé", ru: "здоровье" },
      { fr: "avoir mal à", ru: "испытывать боль в" },
      { fr: "un médicament", ru: "лекарство" },
      { fr: "se reposer", ru: "отдыхать" },
      { fr: "guérir", ru: "выздоравливать, лечить" },
      { fr: "un conseil", ru: "совет" },
    ],
  },
  {
    n: 8, title: "Dans les médias", titleRu: "В медиа",
    objectives: ["Говорить о СМИ и новостях", "Передавать чужие слова", "Выражать мнение"],
    grammar: [
      { point: "Discours indirect (présent)", rule: "Косвенная речь: dire que…, demander si…, вопросительные слова сохраняются. Меняются местоимения.",
        examples: ["Il dit qu'il est fatigué.", "Elle demande si tu viens.", "Je me demande pourquoi il part."] },
      { point: "Négation (ne...plus, ne...jamais, ne...rien)", rule: "Разные отрицания обрамляют глагол: ne...plus (больше не), ne...jamais (никогда), ne...rien (ничего).",
        examples: ["Je ne fume plus.", "Il ne ment jamais.", "Je ne vois rien."] },
    ],
    vocab: [
      { fr: "une actualité", ru: "новость" },
      { fr: "un journal", ru: "газета" },
      { fr: "une chaîne", ru: "телеканал" },
      { fr: "un article", ru: "статья" },
      { fr: "s'informer", ru: "узнавать новости" },
      { fr: "une publicité", ru: "реклама" },
    ],
  },
  {
    n: 9, title: "Consommer responsable", titleRu: "Ответственное потребление",
    objectives: ["Говорить о покупках и экологии", "Выражать необходимость (il faut)", "Сравнивать (équivalence)"],
    grammar: [
      { point: "Comparaison d'équivalence", rule: "Равенство: aussi + прилаг. + que; autant de + сущ. + que; autant que (с глаголом).",
        examples: ["Il est aussi gentil que toi.", "J'ai autant de livres que lui.", "Je travaille autant que toi."] },
      { point: "Il faut / devoir", rule: "Необходимость: il faut + инфинитив (общее), devoir + инфинитив (личное обязательство).",
        examples: ["Il faut recycler.", "Tu dois acheter local.", "Il faut que je parte (subjonctif)."] },
    ],
    vocab: [
      { fr: "recycler", ru: "перерабатывать" },
      { fr: "le gaspillage", ru: "расточительство" },
      { fr: "durable", ru: "устойчивый, долговечный" },
      { fr: "consommer", ru: "потреблять" },
      { fr: "l'environnement (m)", ru: "окружающая среда" },
      { fr: "économiser", ru: "экономить" },
    ],
  },
  {
    n: 10, title: "Envies d'ailleurs ?", titleRu: "Тянет в путешествия?",
    objectives: ["Говорить о путешествиях", "Использовать gérondif", "Рассказывать об одновременных действиях"],
    grammar: [
      { point: "Gérondif", rule: "en + причастие настоящего (основа nous + -ant). Выражает одновременность, способ, условие.",
        examples: ["Il chante en travaillant.", "En arrivant, j'ai vu la mer.", "On apprend en pratiquant."] },
      { point: "Prépositions de lieu (pays/villes)", rule: "à + город; en + страна ж.р./на гласную; au + страна м.р.; aux + мн.ч.",
        examples: ["Je vais à Rome.", "en Italie", "au Japon", "aux Pays-Bas"] },
    ],
    vocab: [
      { fr: "un voyage", ru: "путешествие" },
      { fr: "à l'étranger", ru: "за границей" },
      { fr: "une valise", ru: "чемодан" },
      { fr: "découvrir", ru: "открывать для себя" },
      { fr: "un billet", ru: "билет" },
      { fr: "réserver", ru: "бронировать" },
    ],
  },
  {
    n: 11, title: "De jolis parcours", titleRu: "Красивые судьбы (карьеры)",
    objectives: ["Рассказывать о карьере и учёбе", "Использовать притяжательные/указательные местоимения", "Говорить о достижениях"],
    grammar: [
      { point: "Pronoms démonstratifs", rule: "celui, celle, ceux, celles (+ -ci/-là или + de/qui/que) — заменяют ранее названное.",
        examples: ["Quel livre ? Celui de Marie.", "Ces photos ? Celles-ci sont belles.", "Celui qui travaille réussit."] },
      { point: "Pronoms possessifs", rule: "le mien, le tien, le sien, le nôtre, le vôtre, le leur — заменяют притяж. прилаг. + сущ.",
        examples: ["C'est ton sac ? — Oui, c'est le mien.", "Nos idées et les leurs."] },
    ],
    vocab: [
      { fr: "un parcours", ru: "путь, карьера" },
      { fr: "réussir", ru: "добиваться успеха" },
      { fr: "un métier", ru: "профессия" },
      { fr: "une formation", ru: "обучение, подготовка" },
      { fr: "un diplôme", ru: "диплом" },
      { fr: "postuler", ru: "подавать заявку (на работу)" },
    ],
  },
  {
    n: 12, title: "Soif de nature", titleRu: "Жажда природы",
    objectives: ["Говорить о природе и экологии", "Выражать чувства/желания (subjonctif)", "Использовать superlatif"],
    grammar: [
      { point: "Subjonctif présent", rule: "После выражений желания/необходимости/эмоций (il faut que, je veux que, je suis content que). Основа = 3 л. мн.ч. présent + -e, -es, -e, -ions, -iez, -ent.",
        examples: ["Il faut que tu viennes.", "Je veux que tu sois là.", "Je suis content que tu réussisses."] },
      { point: "Superlatif", rule: "le/la/les plus / moins + прилаг. (+ de). Особое: le meilleur, le mieux.",
        examples: ["C'est la plus belle ville.", "le moins cher", "C'est le meilleur restaurant de la ville."] },
    ],
    vocab: [
      { fr: "la nature", ru: "природа" },
      { fr: "protéger", ru: "защищать" },
      { fr: "un paysage", ru: "пейзаж" },
      { fr: "respirer", ru: "дышать" },
      { fr: "la forêt", ru: "лес" },
      { fr: "préserver", ru: "сохранять" },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// ДИАГНОСТИЧЕСКИЙ ТЕСТ A2 (выявление пробелов по всем юнитам/темам)
// ──────────────────────────────────────────────────────────────────────────
export const A2_DIAGNOSTIC: A2Question[] = [
  // U1 — passé composé
  { id: 1, unit: 1, skill: "grammar", grammarPoint: "Passé composé", type: "mc", prompt: "Hier, j'____ un bon film.", options: ["ai regardé", "regarde", "regardais", "regarderai"], answerIndex: 0, speak: "Hier, j'ai regardé un bon film.", explanation: "Завершённое действие в прошлом → passé composé: avoir + participe (regardé)." },
  { id: 2, unit: 1, skill: "grammar", grammarPoint: "Passé composé (être)", type: "mc", prompt: "Elle ____ à la maison à 8 heures.", options: ["a rentré", "est rentrée", "est rentré", "rentrait"], answerIndex: 1, speak: "Elle est rentrée à la maison à 8 heures.", explanation: "Глагол движения rentrer спрягается с être; причастие согласуется: elle est rentrée." },
  { id: 3, unit: 1, skill: "grammar", grammarPoint: "Passé composé (négation)", type: "text", prompt: "Поставьте в отрицание: « J'ai compris. » →", accept: ["je n'ai pas compris"], speak: "Je n'ai pas compris.", explanation: "ne...pas обрамляет вспомогательный глагол: je n'ai pas compris." },

  // U2 — imparfait
  { id: 4, unit: 2, skill: "grammar", grammarPoint: "Imparfait", type: "mc", prompt: "Quand j'étais petit, je ____ au parc tous les jours.", options: ["vais", "suis allé", "allais", "irai"], answerIndex: 2, speak: "Quand j'étais petit, j'allais au parc.", explanation: "Привычка в прошлом → imparfait: allais." },
  { id: 5, unit: 2, skill: "grammar", grammarPoint: "Imparfait формы", type: "text", prompt: "Imparfait глагола être для « il »: « Il ___ tard. »", accept: ["était", "il était tard"], speak: "Il était tard.", explanation: "Imparfait être: j'étais, tu étais, il était…" },
  { id: 6, unit: 2, skill: "grammar", grammarPoint: "Imparfait vs passé composé", type: "mc", prompt: "Je ____ quand le téléphone a sonné.", options: ["dormais", "ai dormi", "dors", "dormirai"], answerIndex: 0, speak: "Je dormais quand le téléphone a sonné.", explanation: "Фон (длительное действие) → imparfait; прерывающее событие → passé composé (a sonné)." },

  // U3 — y/en, place adjectif
  { id: 7, unit: 3, skill: "grammar", grammarPoint: "Pronom Y", type: "mc", prompt: "Tu vas à Paris ? — Oui, j'____ vais demain.", options: ["en", "y", "le", "la"], answerIndex: 1, speak: "J'y vais demain.", explanation: "Y заменяет à + место: à Paris → y." },
  { id: 8, unit: 3, skill: "grammar", grammarPoint: "Pronom EN", type: "mc", prompt: "Tu veux du café ? — Oui, j'____ veux.", options: ["y", "le", "en", "la"], answerIndex: 2, speak: "Oui, j'en veux.", explanation: "EN заменяет du/de la/des + вещь: du café → en." },
  { id: 9, unit: 3, skill: "grammar", grammarPoint: "Place de l'adjectif", type: "mc", prompt: "Выберите верный порядок:", options: ["une maison grande", "une grande maison", "grande une maison", "maison une grande"], answerIndex: 1, speak: "une grande maison", explanation: "grand — короткое частое прилагательное, ставится перед существительным." },

  // U4 — comparatif, relatifs
  { id: 10, unit: 4, skill: "grammar", grammarPoint: "Comparatif", type: "mc", prompt: "Paul est ____ grand que Marie. (+)", options: ["plus", "moins", "aussi", "meilleur"], answerIndex: 0, speak: "Paul est plus grand que Marie.", explanation: "Превосходство → plus + прилаг. + que." },
  { id: 11, unit: 4, skill: "grammar", grammarPoint: "Comparatif (bon/bien)", type: "mc", prompt: "Ce gâteau est ____ que l'autre. (bon, +)", options: ["plus bon", "meilleur", "mieux", "plus bien"], answerIndex: 1, speak: "Ce gâteau est meilleur que l'autre.", explanation: "bon в сравнении → meilleur (не «plus bon»)." },
  { id: 12, unit: 4, skill: "grammar", grammarPoint: "Pronoms relatifs", type: "mc", prompt: "L'homme ____ parle est mon professeur.", options: ["que", "qui", "où", "dont"], answerIndex: 1, speak: "L'homme qui parle est mon professeur.", explanation: "qui — подлежащее придаточного (он говорит)." },
  { id: 13, unit: 4, skill: "grammar", grammarPoint: "Pronoms relatifs", type: "text", prompt: "Вставьте qui/que/où: « La ville ___ j'habite est belle. »", accept: ["où", "la ville où j'habite est belle"], speak: "La ville où j'habite est belle.", explanation: "où — для места." },

  // U5 — futur simple
  { id: 14, unit: 5, skill: "grammar", grammarPoint: "Futur simple", type: "mc", prompt: "Demain, je ____ mes amis.", options: ["vois", "voyais", "verrai", "ai vu"], answerIndex: 2, speak: "Demain, je verrai mes amis.", explanation: "voir в futur simple: основа verr- → je verrai." },
  { id: 15, unit: 5, skill: "grammar", grammarPoint: "Futur simple (être/avoir)", type: "text", prompt: "Futur simple: « Nous ___ à Paris l'an prochain. » (être)", accept: ["serons", "nous serons à paris l'an prochain"], speak: "Nous serons à Paris l'an prochain.", explanation: "être в futur: основа ser- → nous serons." },
  { id: 16, unit: 5, skill: "grammar", grammarPoint: "Futur proche vs simple", type: "mc", prompt: "Attention, tu ____ tomber !", options: ["vas", "iras", "allais", "es allé"], answerIndex: 0, speak: "Attention, tu vas tomber !", explanation: "Близкое/неминуемое действие → futur proche: aller + inf." },

  // U6 — partitifs, impératif
  { id: 17, unit: 6, skill: "grammar", grammarPoint: "Articles partitifs", type: "mc", prompt: "Je voudrais ____ eau, s'il vous plaît.", options: ["du", "de la", "de l'", "des"], answerIndex: 2, speak: "Je voudrais de l'eau.", explanation: "eau — ж.р. с гласной → de l'." },
  { id: 18, unit: 6, skill: "grammar", grammarPoint: "Partitif (négation)", type: "mc", prompt: "Je ne mange pas ____ viande.", options: ["de la", "du", "de", "des"], answerIndex: 2, speak: "Je ne mange pas de viande.", explanation: "После отрицания партитив → de." },
  { id: 19, unit: 6, skill: "grammar", grammarPoint: "Impératif", type: "text", prompt: "Impératif (tu) глагола manger: « ___ tes légumes ! »", accept: ["mange", "mange tes légumes"], speak: "Mange tes légumes !", explanation: "У -er глаголов в impératif (tu) без -s: mange." },

  // U7 — COD/COI
  { id: 20, unit: 7, skill: "grammar", grammarPoint: "Pronom COD", type: "mc", prompt: "Tu vois Marie ? — Oui, je ____ vois.", options: ["lui", "la", "elle", "y"], answerIndex: 1, speak: "Oui, je la vois.", explanation: "Marie — прямое дополнение ж.р. → la." },
  { id: 21, unit: 7, skill: "grammar", grammarPoint: "Pronom COI", type: "mc", prompt: "Je parle à Paul → Je ____ parle.", options: ["le", "la", "lui", "y"], answerIndex: 2, speak: "Je lui parle.", explanation: "parler à qqn — косвенное дополнение → lui." },
  { id: 22, unit: 7, skill: "grammar", grammarPoint: "Pronom COI (pluriel)", type: "text", prompt: "Замените: « J'écris à mes amis. » → « Je ___ écris. »", accept: ["leur", "je leur écris"], speak: "Je leur écris.", explanation: "à mes amis (мн.ч.) → leur." },

  // U8 — discours indirect, négations
  { id: 23, unit: 8, skill: "grammar", grammarPoint: "Discours indirect", type: "mc", prompt: "Il dit : « Je suis fatigué. » → Il dit ____ il est fatigué.", options: ["que", "qui", "si", "quoi"], answerIndex: 0, speak: "Il dit qu'il est fatigué.", explanation: "Утвердительное высказывание в косвенной речи → que." },
  { id: 24, unit: 8, skill: "grammar", grammarPoint: "Négation ne...plus", type: "mc", prompt: "Avant je fumais, maintenant je ne fume ____.", options: ["pas", "plus", "jamais", "rien"], answerIndex: 1, speak: "Je ne fume plus.", explanation: "ne...plus = «больше не» (прекращение действия)." },
  { id: 25, unit: 8, skill: "grammar", grammarPoint: "Négation ne...rien", type: "text", prompt: "Переведите: « Я ничего не вижу. »", accept: ["je ne vois rien"], speak: "Je ne vois rien.", explanation: "ne...rien = ничего: je ne vois rien." },

  // U9 — équivalence, il faut
  { id: 26, unit: 9, skill: "grammar", grammarPoint: "Comparaison équivalence", type: "mc", prompt: "J'ai ____ de livres que toi.", options: ["aussi", "autant", "plus de", "moins"], answerIndex: 1, speak: "J'ai autant de livres que toi.", explanation: "Равное количество существительного → autant de … que." },
  { id: 27, unit: 9, skill: "grammar", grammarPoint: "Il faut", type: "mc", prompt: "Pour protéger la planète, il faut ____.", options: ["recycler", "recyclé", "recycle", "recyclant"], answerIndex: 0, speak: "Il faut recycler.", explanation: "il faut + инфинитив." },
  { id: 28, unit: 9, skill: "grammar", grammarPoint: "Devoir", type: "text", prompt: "Спряжение devoir: « Tu ___ acheter local. »", accept: ["dois", "tu dois acheter local"], speak: "Tu dois acheter local.", explanation: "devoir: je dois, tu dois, il doit…" },

  // U10 — gérondif, prépositions
  { id: 29, unit: 10, skill: "grammar", grammarPoint: "Gérondif", type: "mc", prompt: "Il écoute de la musique ____ (travailler).", options: ["en travaillant", "travaillant", "à travailler", "de travailler"], answerIndex: 0, speak: "Il écoute de la musique en travaillant.", explanation: "Одновременность → gérondif: en + travaillant." },
  { id: 30, unit: 10, skill: "grammar", grammarPoint: "Prépositions pays", type: "mc", prompt: "Cet été, je vais ____ Japon.", options: ["en", "à", "au", "aux"], answerIndex: 2, speak: "Je vais au Japon.", explanation: "Страна мужского рода → au." },
  { id: 31, unit: 10, skill: "grammar", grammarPoint: "Gérondif формы", type: "text", prompt: "Образуйте gérondif от « faire »:", accept: ["en faisant"], speak: "en faisant", explanation: "Основа nous (faisons) + -ant, с en → en faisant." },

  // U11 — démonstratifs, possessifs
  { id: 32, unit: 11, skill: "grammar", grammarPoint: "Pronoms démonstratifs", type: "mc", prompt: "Quel livre ? — ____ de Marie.", options: ["Celui", "Celle", "Ceux", "Ce"], answerIndex: 0, speak: "Celui de Marie.", explanation: "livre — м.р. ед.ч. → celui." },
  { id: 33, unit: 11, skill: "grammar", grammarPoint: "Pronoms possessifs", type: "mc", prompt: "C'est ton sac ? — Oui, c'est ____.", options: ["le mien", "la mienne", "le tien", "mon"], answerIndex: 0, speak: "Oui, c'est le mien.", explanation: "sac — м.р., принадлежит мне → le mien." },
  { id: 34, unit: 11, skill: "vocab", grammarPoint: "Lexique parcours", type: "text", prompt: "Переведите: « профессия » (одно слово, м.р.)", accept: ["métier", "un métier", "le métier"], speak: "un métier", explanation: "профессия = un métier." },

  // U12 — subjonctif, superlatif
  { id: 35, unit: 12, skill: "grammar", grammarPoint: "Subjonctif", type: "mc", prompt: "Il faut que tu ____ à l'heure.", options: ["es", "sois", "seras", "étais"], answerIndex: 1, speak: "Il faut que tu sois à l'heure.", explanation: "После «il faut que» → subjonctif: que tu sois." },
  { id: 36, unit: 12, skill: "grammar", grammarPoint: "Subjonctif формы", type: "text", prompt: "Subjonctif (que je) глагола venir: « Il faut que je ___. »", accept: ["vienne", "il faut que je vienne"], speak: "Il faut que je vienne.", explanation: "venir в subjonctif: que je vienne." },
  { id: 37, unit: 12, skill: "grammar", grammarPoint: "Superlatif", type: "mc", prompt: "C'est ____ belle ville du pays.", options: ["la plus", "plus", "le plus", "très"], answerIndex: 0, speak: "C'est la plus belle ville du pays.", explanation: "Превосходная степень ж.р. → la plus + прилаг." },

  // Лексика по юнитам (vocab skill)
  { id: 38, unit: 1, skill: "vocab", grammarPoint: "Lexique", type: "mc", prompt: "« déménager » означает:", options: ["переезжать", "обедать", "опаздывать", "отдыхать"], answerIndex: 0, speak: "déménager", explanation: "déménager = переезжать (менять жильё)." },
  { id: 39, unit: 6, skill: "vocab", grammarPoint: "Lexique cuisine", type: "mc", prompt: "« ajouter » в рецепте означает:", options: ["резать", "добавлять", "смешивать", "варить"], answerIndex: 1, speak: "ajouter", explanation: "ajouter = добавлять." },
  { id: 40, unit: 9, skill: "vocab", grammarPoint: "Lexique écologie", type: "text", prompt: "Переведите на французский: « перерабатывать (отходы) »", accept: ["recycler"], speak: "recycler", explanation: "перерабатывать = recycler." },

  // Аудирование (на слух — кнопка 🔊, затем выбор/ввод)
  { id: 41, unit: 2, skill: "listening", grammarPoint: "Compréhension orale", type: "mc", prompt: "🔊 Послушайте и выберите, что сказано:", options: ["Il faisait beau.", "Il fait beau.", "Il fera beau.", "Il a fait beau."], answerIndex: 0, speak: "Il faisait beau.", explanation: "На слух — imparfait «faisait» (описание погоды в прошлом)." },
  { id: 42, unit: 5, skill: "listening", grammarPoint: "Compréhension orale", type: "text", prompt: "🔊 Запишите услышанную фразу:", accept: ["je voyagerai partout", "un jour je voyagerai partout"], speak: "Un jour, je voyagerai partout.", explanation: "Futur simple voyager → je voyagerai." },
  { id: 43, unit: 10, skill: "listening", grammarPoint: "Compréhension orale", type: "text", prompt: "🔊 Запишите услышанное:", accept: ["on apprend en pratiquant"], speak: "On apprend en pratiquant.", explanation: "Gérondif: en pratiquant." },

  // Говорение/произношение (кнопка 🎙)
  { id: 44, unit: 7, skill: "speaking", grammarPoint: "Production orale", type: "mc", prompt: "🎙 Произнесите фразу и нажмите проверку. Какой здесь pronom COI?", options: ["la", "lui", "le", "y"], answerIndex: 1, speak: "Je lui donne un conseil.", explanation: "donner à qqn → COI → lui. Потренируйте произношение фразы." },
  { id: 45, unit: 12, skill: "speaking", grammarPoint: "Production orale", type: "text", prompt: "🎙 Произнесите и впишите: пожелание с subjonctif (à l'heure)", accept: ["il faut que tu sois à l'heure"], speak: "Il faut que tu sois à l'heure.", explanation: "Тренируем subjonctif в речи: que tu sois." },
];

export function normalizeA2(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[‘’ʼ`´]/g, "'") // все апострофы → прямой '
    .replace(/[‐-―−]/g, "-")            // все дефисы/тире → -
    .replace(/[.,!?;:«»"]/g, "")
    .replace(/œ/g, "oe")
    .replace(/\s*'\s*/g, "'")                           // убрать пробелы вокруг апострофа
    .replace(/\s+/g, " ")
    .trim();
}

export const A2_SKILL_LABELS: Record<A2Skill, string> = {
  grammar: "Грамматика",
  vocab: "Лексика",
  listening: "Аудирование",
  speaking: "Говорение",
};
