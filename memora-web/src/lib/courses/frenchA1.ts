// Банк заданий курса «Французский A1» (на основе программы CECRL / Sorbonne A1).
// Используется на странице /dashboard/student/courses/french-a1.
// Типы:
//   mc   — множественный выбор (есть options + answerIndex)
//   text — ввод ответа (есть accept[]), проверяется локально и при сомнении через Ollama

export type A1QuestionType = "mc" | "text";

export interface A1Question {
  id: number;
  category: string;
  type: A1QuestionType;
  prompt: string;
  /** для mc */
  options?: string[];
  answerIndex?: number;
  /** для text — список принимаемых ответов (первый — эталонный) */
  accept?: string[];
  /** текст, который озвучивается (по умолчанию = правильный ответ или prompt) */
  speak?: string;
  explanation: string;
}

export const A1_CATEGORIES: string[] = [
  "Артикли",
  "Глагол être",
  "Глагол avoir",
  "Глаголы -ER",
  "Числа",
  "Приветствия",
  "Вопросы",
  "Притяжательные",
  "Отрицание",
  "Предлоги",
  "Род и число",
  "Лексика: время",
  "Лексика",
  "Указательные",
  "Глаголы aller/faire",
  "Частичный артикль",
  "C'est / Il y a",
  "Согласование",
  "Перевод",
];

export const FRENCH_A1_QUESTIONS: A1Question[] = [
  // ===== Артикли =====
  { id: 1, category: "Артикли", type: "mc", prompt: "____ soleil brille aujourd'hui.", options: ["Le", "La", "Les", "L'"], answerIndex: 0, speak: "Le soleil brille aujourd'hui.", explanation: "«Soleil» — существительное мужского рода в ед. числе, поэтому определённый артикль le. La — женский род, les — множественное число, l' — только перед гласной или h." },
  { id: 2, category: "Артикли", type: "mc", prompt: "Je voudrais ____ pomme, s'il vous plaît.", options: ["un", "une", "des", "le"], answerIndex: 1, speak: "Je voudrais une pomme.", explanation: "«Pomme» — женского рода, предмет неопределённый (одно из многих), значит неопределённый артикль une." },
  { id: 3, category: "Артикли", type: "mc", prompt: "Ce sont ____ enfants de Marie.", options: ["le", "la", "les", "un"], answerIndex: 2, speak: "Ce sont les enfants de Marie.", explanation: "«Enfants» во множественном числе и это конкретные дети Марии → определённый артикль les." },
  { id: 4, category: "Артикли", type: "mc", prompt: "J'habite dans ____ appartement.", options: ["un", "une", "des", "le"], answerIndex: 0, speak: "J'habite dans un appartement.", explanation: "«Appartement» — мужской род, квартира не уточняется → неопределённый артикль un." },
  { id: 5, category: "Артикли", type: "mc", prompt: "____ école est fermée le dimanche.", options: ["Le", "La", "L'", "Les"], answerIndex: 2, speak: "L'école est fermée le dimanche.", explanation: "«École» женского рода, но начинается с гласной, поэтому артикль усекается: l'école." },
  { id: 6, category: "Артикли", type: "text", prompt: "Вставьте артикль: « Elle achète ___ fleurs au marché. » (неопр. мн.ч.)", accept: ["des", "elle achète des fleurs au marché"], speak: "Elle achète des fleurs au marché.", explanation: "Множественное число неопределённого артикля (un/une) — это des: des fleurs (какие-то цветы)." },
  { id: 7, category: "Артикли", type: "text", prompt: "Вставьте артикль: « C'est ___ livre de français. » (неопр. м.р.)", accept: ["un", "c'est un livre de français"], speak: "C'est un livre de français.", explanation: "«Livre» — мужской род, предмет вводится впервые → неопределённый артикль un." },

  // ===== Глагол être =====
  { id: 8, category: "Глагол être", type: "mc", prompt: "Je ____ étudiant.", options: ["es", "suis", "est", "sommes"], answerIndex: 1, speak: "Je suis étudiant.", explanation: "Спряжение être: je suis, tu es, il est, nous sommes, vous êtes, ils sont." },
  { id: 9, category: "Глагол être", type: "mc", prompt: "Tu ____ français ?", options: ["es", "est", "suis", "êtes"], answerIndex: 0, speak: "Tu es français ?", explanation: "Для «tu» форма être — es: tu es." },
  { id: 10, category: "Глагол être", type: "mc", prompt: "Il ____ professeur.", options: ["es", "suis", "est", "sont"], answerIndex: 2, speak: "Il est professeur.", explanation: "Для «il/elle» форма être — est. После être профессия идёт без артикля." },
  { id: 11, category: "Глагол être", type: "text", prompt: "Спряжение être: « Nous ___ contents. »", accept: ["sommes", "nous sommes contents"], speak: "Nous sommes contents.", explanation: "Для «nous» форма être — sommes: nous sommes contents." },
  { id: 12, category: "Глагол être", type: "text", prompt: "Спряжение être: « Vous ___ en retard. »", accept: ["êtes", "etes", "vous êtes en retard"], speak: "Vous êtes en retard.", explanation: "Для «vous» форма être — êtes: vous êtes." },
  { id: 13, category: "Глагол être", type: "mc", prompt: "Elles ____ amies.", options: ["est", "es", "sont", "sommes"], answerIndex: 2, speak: "Elles sont amies.", explanation: "«Elles» — 3-е лицо мн. числа → être = sont." },

  // ===== Глагол avoir =====
  { id: 14, category: "Глагол avoir", type: "mc", prompt: "J'____ vingt ans.", options: ["a", "ai", "as", "ont"], answerIndex: 1, speak: "J'ai vingt ans.", explanation: "Спряжение avoir: j'ai, tu as, il a, nous avons, vous avez, ils ont. Возраст по-французски выражается через avoir." },
  { id: 15, category: "Глагол avoir", type: "mc", prompt: "Tu ____ un chien ?", options: ["a", "as", "ai", "avez"], answerIndex: 1, speak: "Tu as un chien ?", explanation: "Для «tu» форма avoir — as: tu as." },
  { id: 16, category: "Глагол avoir", type: "mc", prompt: "Elle ____ une voiture.", options: ["a", "as", "ai", "ont"], answerIndex: 0, speak: "Elle a une voiture.", explanation: "Для «il/elle» форма avoir — a: elle a." },
  { id: 17, category: "Глагол avoir", type: "text", prompt: "Спряжение avoir: « Nous ___ faim. »", accept: ["avons", "nous avons faim"], speak: "Nous avons faim.", explanation: "Для «nous» форма avoir — avons. «Голод» тоже через avoir: avoir faim." },
  { id: 18, category: "Глагол avoir", type: "text", prompt: "Спряжение avoir: « Ils ___ deux enfants. »", accept: ["ont", "ils ont deux enfants"], speak: "Ils ont deux enfants.", explanation: "Для «ils/elles» форма avoir — ont. Не путать с «sont» (être)!" },
  { id: 19, category: "Глагол avoir", type: "mc", prompt: "Vous ____ des questions ?", options: ["avons", "avez", "ont", "as"], answerIndex: 1, speak: "Vous avez des questions ?", explanation: "Для «vous» форма avoir — avez: vous avez." },

  // ===== Глаголы -ER =====
  { id: 20, category: "Глаголы -ER", type: "mc", prompt: "Je ____ le français. (parler)", options: ["parle", "parles", "parlez", "parlent"], answerIndex: 0, speak: "Je parle le français.", explanation: "Глаголы на -er: -e, -es, -e, -ons, -ez, -ent. Для «je» → parle." },
  { id: 21, category: "Глаголы -ER", type: "mc", prompt: "Tu ____ à Paris. (habiter)", options: ["habite", "habites", "habitez", "habitent"], answerIndex: 1, speak: "Tu habites à Paris.", explanation: "Для «tu» окончание -es → habites (буква -s не читается)." },
  { id: 22, category: "Глаголы -ER", type: "mc", prompt: "Il ____ la musique. (aimer)", options: ["aime", "aimes", "aimez", "aiment"], answerIndex: 0, speak: "Il aime la musique.", explanation: "Для «il/elle» окончание -e → aime." },
  { id: 23, category: "Глаголы -ER", type: "text", prompt: "Поставьте глагол: « Nous ___ la radio. » (écouter)", accept: ["écoutons", "ecoutons", "nous écoutons la radio"], speak: "Nous écoutons la radio.", explanation: "Для «nous» окончание -ons → écoutons." },
  { id: 24, category: "Глаголы -ER", type: "mc", prompt: "Vous ____ beaucoup. (travailler)", options: ["travaille", "travailles", "travaillez", "travaillent"], answerIndex: 2, speak: "Vous travaillez beaucoup.", explanation: "Для «vous» окончание -ez → travaillez." },
  { id: 25, category: "Глаголы -ER", type: "mc", prompt: "Ils ____ au football. (jouer)", options: ["joue", "joues", "jouez", "jouent"], answerIndex: 3, speak: "Ils jouent au football.", explanation: "Для «ils/elles» окончание -ent (не читается) → jouent. Jouer à + игра." },
  { id: 26, category: "Глаголы -ER", type: "text", prompt: "Поставьте глагол: « Elle ___ un café. » (commander)", accept: ["commande", "elle commande un café"], speak: "Elle commande un café.", explanation: "Для «elle» окончание -e → commande." },

  // ===== Числа =====
  { id: 27, category: "Числа", type: "mc", prompt: "Comment écrit-on « 7 » ?", options: ["six", "sept", "huit", "neuf"], answerIndex: 1, speak: "sept", explanation: "7 = sept. (six=6, huit=8, neuf=9)." },
  { id: 28, category: "Числа", type: "mc", prompt: "« Quinze » correspond à :", options: ["14", "15", "16", "50"], answerIndex: 1, speak: "quinze", explanation: "«Quinze» = 15. (quatorze=14, seize=16, cinquante=50)." },
  { id: 29, category: "Числа", type: "mc", prompt: "Comment dit-on « 20 » ?", options: ["dix", "douze", "vingt", "trente"], answerIndex: 2, speak: "vingt", explanation: "20 = vingt. (dix=10, douze=12, trente=30)." },
  { id: 30, category: "Числа", type: "text", prompt: "Напишите число словами по-французски: « 100 »", accept: ["cent"], speak: "cent", explanation: "100 = cent." },
  { id: 31, category: "Числа", type: "text", prompt: "Напишите число словами по-французски: « 12 »", accept: ["douze"], speak: "douze", explanation: "12 = douze." },
  { id: 32, category: "Числа", type: "mc", prompt: "Quel est le nombre « quarante » ?", options: ["14", "40", "44", "4"], answerIndex: 1, speak: "quarante", explanation: "«Quarante» = 40. Не путать с «quatorze» (14)." },

  // ===== Приветствия =====
  { id: 33, category: "Приветствия", type: "mc", prompt: "Pour dire bonjour le soir, on dit :", options: ["Bonjour", "Bonsoir", "Bonne nuit", "Salut"], answerIndex: 1, speak: "Bonsoir", explanation: "Вечером здороваются Bonsoir. «Bonne nuit» — спокойной ночи (перед сном)." },
  { id: 34, category: "Приветствия", type: "mc", prompt: "Pour remercier, on dit :", options: ["Pardon", "Merci", "S'il vous plaît", "Au revoir"], answerIndex: 1, speak: "Merci", explanation: "Спасибо = Merci. «Pardon» — извинение, «s'il vous plaît» — пожалуйста." },
  { id: 35, category: "Приветствия", type: "mc", prompt: "« Comment ____-vous ? » (demander l'état)", options: ["allez", "êtes", "avez", "faites"], answerIndex: 0, speak: "Comment allez-vous ?", explanation: "«Как дела?»: Comment allez-vous? — устойчивая фраза с глаголом aller." },
  { id: 36, category: "Приветствия", type: "text", prompt: "Ответ на « Merci » (два слова, «не за что»):", accept: ["de rien"], speak: "De rien.", explanation: "Стандартный вежливый ответ на «merci» — de rien («не за что»)." },
  { id: 37, category: "Приветствия", type: "mc", prompt: "Pour dire au revoir :", options: ["Bonjour", "Merci", "Au revoir", "Oui"], answerIndex: 2, speak: "Au revoir", explanation: "«До свидания» = Au revoir." },

  // ===== Вопросы =====
  { id: 38, category: "Вопросы", type: "mc", prompt: "____ tu t'appelles ?", options: ["Comment", "Où", "Quand", "Combien"], answerIndex: 0, speak: "Comment tu t'appelles ?", explanation: "«Как тебя зовут?» = Comment tu t'appelles? Comment = как." },
  { id: 39, category: "Вопросы", type: "mc", prompt: "____ habites-tu ?", options: ["Qui", "Où", "Quoi", "Quand"], answerIndex: 1, speak: "Où habites-tu ?", explanation: "«Где ты живёшь?» = Où habites-tu? Où = где/куда." },
  { id: 40, category: "Вопросы", type: "mc", prompt: "____ ça coûte ? (le prix)", options: ["Comment", "Où", "Combien", "Pourquoi"], answerIndex: 2, speak: "Combien ça coûte ?", explanation: "Цена спрашивается словом Combien (сколько)." },
  { id: 41, category: "Вопросы", type: "text", prompt: "Вопросительное слово «когда» по-французски:", accept: ["quand"], speak: "quand", explanation: "«Когда» = quand." },
  { id: 42, category: "Вопросы", type: "mc", prompt: "____ est cette femme ? (l'identité)", options: ["Qui", "Où", "Quand", "Combien"], answerIndex: 0, speak: "Qui est cette femme ?", explanation: "О личности спрашивают Qui (кто)." },
  { id: 43, category: "Вопросы", type: "mc", prompt: "____ tu apprends le français ? (la raison)", options: ["Comment", "Pourquoi", "Où", "Combien"], answerIndex: 1, speak: "Pourquoi tu apprends le français ?", explanation: "Причину спрашивают словом Pourquoi (почему). Ответ — с «parce que»." },

  // ===== Притяжательные =====
  { id: 44, category: "Притяжательные", type: "mc", prompt: "C'est ____ livre. (à moi)", options: ["mon", "ma", "mes", "ton"], answerIndex: 0, speak: "C'est mon livre.", explanation: "«Livre» — мужской род, ед. число → mon (мой)." },
  { id: 45, category: "Притяжательные", type: "mc", prompt: "____ sœur est gentille. (à moi)", options: ["Mon", "Ma", "Mes", "Ta"], answerIndex: 1, speak: "Ma sœur est gentille.", explanation: "«Sœur» — женский род, ед. число → ma (моя)." },
  { id: 46, category: "Притяжательные", type: "mc", prompt: "Ce sont ____ parents. (à moi)", options: ["mon", "ma", "mes", "ton"], answerIndex: 2, speak: "Ce sont mes parents.", explanation: "«Parents» — мн. число → mes (мои). Согласуется с предметом, не с владельцем." },
  { id: 47, category: "Притяжательные", type: "text", prompt: "Вставьте притяжательное (à toi, ж.р.): « Voici ___ maison. »", accept: ["ta", "voici ta maison"], speak: "Voici ta maison.", explanation: "«Maison» — женский род → ta (твоя)." },
  { id: 48, category: "Притяжательные", type: "mc", prompt: "C'est ____ voiture. (à lui/elle)", options: ["son", "sa", "ses", "leur"], answerIndex: 1, speak: "C'est sa voiture.", explanation: "«Voiture» — женский род → sa (его/её). Род определяется существительным." },
  { id: 49, category: "Притяжательные", type: "mc", prompt: "____ amis sont là. (à nous)", options: ["Notre", "Nos", "Votre", "Leur"], answerIndex: 1, speak: "Nos amis sont là.", explanation: "«Amis» — мн. число, «у нас» → nos (наши). Notre — для ед. числа." },

  // ===== Отрицание =====
  { id: 50, category: "Отрицание", type: "mc", prompt: "Je ____ parle ____ anglais.", options: ["ne / pas", "pas / ne", "ne / plus", "n' / pas"], answerIndex: 0, speak: "Je ne parle pas anglais.", explanation: "Отрицание двойное и охватывает глагол: ne ... pas. Je ne parle pas anglais." },
  { id: 51, category: "Отрицание", type: "mc", prompt: "Il n'____ pas de voiture.", options: ["a", "as", "ai", "ont"], answerIndex: 0, speak: "Il n'a pas de voiture.", explanation: "Перед гласной «ne» → «n'»: il n'a pas. После отрицания un/une/des → «de»." },
  { id: 52, category: "Отрицание", type: "mc", prompt: "Forme négative de « J'ai un chat » :", options: ["Je n'ai pas de chat", "Je n'ai pas un chat", "Je ai pas chat", "Je ne ai pas chat"], answerIndex: 0, speak: "Je n'ai pas de chat.", explanation: "В отрицании неопределённый артикль превращается в «de»: Je n'ai pas de chat." },
  { id: 53, category: "Отрицание", type: "text", prompt: "Сделайте отрицательным: « Je fume. » →", accept: ["je ne fume pas"], speak: "Je ne fume pas.", explanation: "Ставим ne перед глаголом и pas после: Je ne fume pas." },

  // ===== Предлоги =====
  { id: 54, category: "Предлоги", type: "mc", prompt: "J'habite ____ Paris.", options: ["à", "en", "au", "aux"], answerIndex: 0, speak: "J'habite à Paris.", explanation: "С городами используется à: à Paris, à Moscou." },
  { id: 55, category: "Предлоги", type: "mc", prompt: "Je vais ____ France.", options: ["à", "en", "au", "aux"], answerIndex: 1, speak: "Je vais en France.", explanation: "Со странами женского рода — en: en France, en Russie." },
  { id: 56, category: "Предлоги", type: "mc", prompt: "Il habite ____ Portugal.", options: ["à", "en", "au", "aux"], answerIndex: 2, speak: "Il habite au Portugal.", explanation: "Со странами мужского рода — au: au Portugal, au Canada." },
  { id: 57, category: "Предлоги", type: "mc", prompt: "Nous allons ____ États-Unis.", options: ["à", "en", "au", "aux"], answerIndex: 3, speak: "Nous allons aux États-Unis.", explanation: "Со странами во мн. числе — aux: aux États-Unis." },
  { id: 58, category: "Предлоги", type: "text", prompt: "Предлог «на столе»: « Le livre est ___ la table. »", accept: ["sur", "le livre est sur la table"], speak: "Le livre est sur la table.", explanation: "«На (поверхности)» = sur. (dans=внутри, sous=под)." },
  { id: 59, category: "Предлоги", type: "mc", prompt: "Le chat est ____ la boîte. (à l'intérieur)", options: ["sur", "dans", "sous", "devant"], answerIndex: 1, speak: "Le chat est dans la boîte.", explanation: "«Внутри» = dans. (sur=на, sous=под, devant=перед)." },

  // ===== Род и число =====
  { id: 60, category: "Род и число", type: "mc", prompt: "Pluriel de « un journal » :", options: ["des journals", "des journaux", "des journales", "des journauxs"], answerIndex: 1, speak: "des journaux", explanation: "Слова на -al → мн. число на -aux: un journal → des journaux." },
  { id: 61, category: "Род и число", type: "mc", prompt: "Féminin de « un acteur » :", options: ["une acteur", "une actrice", "une acteuse", "une acteure"], answerIndex: 1, speak: "une actrice", explanation: "Слова на -teur дают женский род на -trice: acteur → actrice." },
  { id: 62, category: "Род и число", type: "mc", prompt: "Pluriel de « le cheval » :", options: ["les chevals", "les chevaux", "les chevales", "les cheval"], answerIndex: 1, speak: "les chevaux", explanation: "Правило -al → -aux: le cheval → les chevaux." },
  { id: 63, category: "Род и число", type: "text", prompt: "Женский род прилагательного « grand » :", accept: ["grande"], speak: "grande", explanation: "Женский род обычно образуется добавлением -e: grand → grande." },
  { id: 64, category: "Род и число", type: "mc", prompt: "Pluriel de « un œil » :", options: ["des œils", "des yeux", "des oeils", "des yeuxs"], answerIndex: 1, speak: "des yeux", explanation: "Это исключение: un œil → des yeux (запомнить)." },

  // ===== Лексика: время =====
  { id: 65, category: "Лексика: время", type: "mc", prompt: "Quel jour vient après lundi ?", options: ["dimanche", "mardi", "mercredi", "samedi"], answerIndex: 1, speak: "mardi", explanation: "После понедельника (lundi) идёт вторник — mardi." },
  { id: 66, category: "Лексика: время", type: "mc", prompt: "« Janvier » est :", options: ["un jour", "un mois", "une saison", "une heure"], answerIndex: 1, speak: "un mois", explanation: "«Janvier» (январь) — это месяц (un mois)." },
  { id: 67, category: "Лексика: время", type: "mc", prompt: "Quelle saison est la plus froide ?", options: ["l'été", "le printemps", "l'hiver", "l'automne"], answerIndex: 2, speak: "l'hiver", explanation: "Самое холодное время года — зима, l'hiver." },
  { id: 68, category: "Лексика: время", type: "text", prompt: "Сколько дней в неделе (число словами по-фр.)?", accept: ["sept"], speak: "sept", explanation: "В неделе 7 дней → sept." },
  { id: 69, category: "Лексика: время", type: "mc", prompt: "« Il est midi » signifie :", options: ["12h00", "00h00", "18h00", "06h00"], answerIndex: 0, speak: "Il est midi.", explanation: "«Midi» = полдень = 12:00. Полночь — «minuit» (00:00)." },

  // ===== Лексика =====
  { id: 70, category: "Лексика", type: "mc", prompt: "Le ciel est ____.", options: ["bleu", "rouge", "vert", "noir"], answerIndex: 0, speak: "Le ciel est bleu.", explanation: "Небо голубое → bleu. (rouge=красный, vert=зелёный, noir=чёрный)." },
  { id: 71, category: "Лексика", type: "mc", prompt: "On boit du ____ le matin.", options: ["pain", "café", "fromage", "poisson"], answerIndex: 1, speak: "On boit du café le matin.", explanation: "Пьют (boire) кофе — café. Остальное едят: pain=хлеб, fromage=сыр, poisson=рыба." },
  { id: 72, category: "Лексика", type: "mc", prompt: "Le frère de ma mère est mon ____.", options: ["père", "oncle", "cousin", "grand-père"], answerIndex: 1, speak: "C'est mon oncle.", explanation: "Брат матери — это дядя, oncle." },
  { id: 73, category: "Лексика", type: "text", prompt: "Цвет помидора по-французски (прилаг.):", accept: ["rouge"], speak: "rouge", explanation: "Помидор красный → rouge (не меняется в женском роде)." },
  { id: 74, category: "Лексика", type: "mc", prompt: "On mange la soupe avec une ____.", options: ["fourchette", "cuillère", "couteau", "assiette"], answerIndex: 1, speak: "une cuillère", explanation: "Суп едят ложкой — cuillère. (fourchette=вилка, couteau=нож, assiette=тарелка)." },
  { id: 75, category: "Лексика", type: "mc", prompt: "Le fils de mon fils est mon ____.", options: ["neveu", "petit-fils", "oncle", "cousin"], answerIndex: 1, speak: "mon petit-fils", explanation: "Сын сына — это внук, petit-fils. (neveu=племянник)." },

  // ===== Указательные =====
  { id: 76, category: "Указательные", type: "mc", prompt: "____ homme est grand.", options: ["Ce", "Cet", "Cette", "Ces"], answerIndex: 0, speak: "Ce homme est grand.", explanation: "«Этот» для м.р. перед согласной — ce. Перед гласной/h было бы «cet»." },
  { id: 77, category: "Указательные", type: "mc", prompt: "____ femme est jeune.", options: ["Ce", "Cet", "Cette", "Ces"], answerIndex: 2, speak: "Cette femme est jeune.", explanation: "«Эта» для женского рода — cette." },
  { id: 78, category: "Указательные", type: "mc", prompt: "____ enfants jouent.", options: ["Ce", "Cet", "Cette", "Ces"], answerIndex: 3, speak: "Ces enfants jouent.", explanation: "«Эти» для множественного числа — ces." },
  { id: 79, category: "Указательные", type: "mc", prompt: "____ ami est sympa. (перед гласной)", options: ["Ce", "Cet", "Cette", "Ces"], answerIndex: 1, speak: "Cet ami est sympa.", explanation: "М.р. перед гласной требует форму cet: cet ami (для благозвучия)." },

  // ===== Глаголы aller / faire =====
  { id: 80, category: "Глаголы aller/faire", type: "mc", prompt: "Je ____ à l'école. (aller)", options: ["va", "vais", "vas", "allons"], answerIndex: 1, speak: "Je vais à l'école.", explanation: "Aller: je vais, tu vas, il va, nous allons, vous allez, ils vont." },
  { id: 81, category: "Глаголы aller/faire", type: "mc", prompt: "Tu ____ au cinéma. (aller)", options: ["va", "vas", "vais", "allez"], answerIndex: 1, speak: "Tu vas au cinéma.", explanation: "Для «tu» форма aller — vas." },
  { id: 82, category: "Глаголы aller/faire", type: "text", prompt: "Спряжение aller: « Nous ___ au parc. »", accept: ["allons", "nous allons au parc"], speak: "Nous allons au parc.", explanation: "Для «nous» форма aller — allons." },
  { id: 83, category: "Глаголы aller/faire", type: "mc", prompt: "Il ____ ses devoirs. (faire)", options: ["fais", "fait", "faites", "font"], answerIndex: 1, speak: "Il fait ses devoirs.", explanation: "Faire: je fais, tu fais, il fait, nous faisons, vous faites, ils font." },
  { id: 84, category: "Глаголы aller/faire", type: "mc", prompt: "Ils ____ du sport. (faire)", options: ["fait", "faites", "font", "faisons"], answerIndex: 2, speak: "Ils font du sport.", explanation: "Для «ils/elles» форма faire — font." },
  { id: 85, category: "Глаголы aller/faire", type: "text", prompt: "Спряжение faire: « Vous ___ la cuisine. »", accept: ["faites", "vous faites la cuisine"], speak: "Vous faites la cuisine.", explanation: "Для «vous» форма faire — faites (исключение, не «faisez»)." },

  // ===== Частичный артикль =====
  { id: 86, category: "Частичный артикль", type: "mc", prompt: "Je mange ____ pain.", options: ["du", "de la", "des", "le"], answerIndex: 0, speak: "Je mange du pain.", explanation: "Частичный артикль для м.р. — du (немного хлеба)." },
  { id: 87, category: "Частичный артикль", type: "mc", prompt: "Elle boit ____ eau.", options: ["du", "de la", "de l'", "des"], answerIndex: 2, speak: "Elle boit de l'eau.", explanation: "«Eau» — ж.р. и с гласной → частичный артикль de l'." },
  { id: 88, category: "Частичный артикль", type: "mc", prompt: "Nous achetons ____ légumes.", options: ["du", "de la", "des", "le"], answerIndex: 2, speak: "Nous achetons des légumes.", explanation: "«Légumes» — мн. число → des." },

  // ===== C'est / Il y a =====
  { id: 89, category: "C'est / Il y a", type: "mc", prompt: "____ un livre sur la table.", options: ["C'est", "Il y a", "Il est", "Ce sont"], answerIndex: 1, speak: "Il y a un livre sur la table.", explanation: "Наличие чего-то выражается оборотом Il y a (есть, имеется)." },
  { id: 90, category: "C'est / Il y a", type: "mc", prompt: "____ mon ami Pierre.", options: ["C'est", "Il y a", "Ils sont", "Ce sont"], answerIndex: 0, speak: "C'est mon ami Pierre.", explanation: "Для представления одного человека — C'est (это)." },
  { id: 91, category: "C'est / Il y a", type: "mc", prompt: "____ des étudiants étrangers.", options: ["C'est", "Il est", "Ce sont", "Il y est"], answerIndex: 2, speak: "Ce sont des étudiants étrangers.", explanation: "Для идентификации во мн. числе — Ce sont." },

  // ===== Согласование =====
  { id: 92, category: "Согласование", type: "mc", prompt: "Des fleurs ____. (joli)", options: ["joli", "jolie", "jolies", "jolis"], answerIndex: 2, speak: "des fleurs jolies", explanation: "«Fleurs» — ж.р., мн. число → прилагательное -e и -s: jolies." },

  // ===== Перевод RU → FR =====
  { id: 93, category: "Перевод", type: "text", prompt: "Переведите на французский: « Привет! » (неформ.)", accept: ["salut"], speak: "Salut !", explanation: "Неформальное «привет» = Salut. Формально — «Bonjour»." },
  { id: 94, category: "Перевод", type: "text", prompt: "Переведите: « Меня зовут Анна. »", accept: ["je m'appelle anna", "je mappelle anna"], speak: "Je m'appelle Anna.", explanation: "Возвратный глагол s'appeler: Je m'appelle Anna (буквально «я себя называю»)." },
  { id: 95, category: "Перевод", type: "text", prompt: "Переведите: « Я говорю по-французски. »", accept: ["je parle français", "je parle francais"], speak: "Je parle français.", explanation: "Je parle français. Название языка без артикля после parler." },
  { id: 96, category: "Перевод", type: "text", prompt: "Переведите: « Спасибо большое. »", accept: ["merci beaucoup"], speak: "Merci beaucoup.", explanation: "Merci beaucoup. «Beaucoup» = много/очень." },
  { id: 97, category: "Перевод", type: "text", prompt: "Переведите: « Сколько это стоит? »", accept: ["combien ça coûte", "combien ca coute", "ça coûte combien", "ca coute combien", "c'est combien", "cest combien"], speak: "Combien ça coûte ?", explanation: "Combien ça coûte ? (или разговорное «C'est combien?»)." },
  { id: 98, category: "Перевод", type: "text", prompt: "Переведите: « Я не понимаю. »", accept: ["je ne comprends pas"], speak: "Je ne comprends pas.", explanation: "Je ne comprends pas. Глагол comprendre + рамка отрицания ne...pas." },
  { id: 99, category: "Перевод", type: "text", prompt: "Переведите: « Доброе утро / Добрый день! »", accept: ["bonjour"], speak: "Bonjour !", explanation: "Bonjour — универсальное дневное приветствие." },
  { id: 100, category: "Перевод", type: "text", prompt: "Переведите: « Я живу в Париже. »", accept: ["j'habite à paris", "jhabite a paris", "j'habite a paris"], speak: "J'habite à Paris.", explanation: "J'habite à Paris. С городами — предлог «à», «je» перед гласной → «j'»." },
];

// Утилита нормализации ответов (как в HTML-прототипе)
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[‘’ʼ`´]/g, "'") // все апострофы → прямой '
    .replace(/[‐-―−]/g, "-")            // все дефисы/тире → -
    .replace(/[.,!?;:«»"]/g, "")
    .replace(/œ/g, "oe")
    .replace(/\s*'\s*/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
