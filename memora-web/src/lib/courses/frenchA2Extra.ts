// Дополнительные модули курса A2: спряжения, ролевые диалоги, аудио-диктанты,
// épreuve blanche, геймификация, визуальная лексика, «ошибка дня».
// Весь контент написан по программе A2 (без копирования учебника).

import { A2_DIAGNOSTIC, A2Question, normalizeA2 } from "./frenchA2";

// ─────────────────────────────────────────────────────────────
// ИДЕЯ 3: ГЕНЕРАТИВНЫЙ ТРЕНАЖЁР СПРЯЖЕНИЙ
// Локальный генератор (бесконечные примеры) + промпт для Ollama-обогащения.
// ─────────────────────────────────────────────────────────────
export type Tense = "present" | "passe_compose" | "imparfait" | "futur" | "subjonctif";

export const TENSE_LABELS: Record<Tense, string> = {
  present: "Présent",
  passe_compose: "Passé composé",
  imparfait: "Imparfait",
  futur: "Futur simple",
  subjonctif: "Subjonctif présent",
};

const PRONOUNS = ["je", "tu", "il", "nous", "vous", "ils"] as const;
type Pronoun = typeof PRONOUNS[number];

// Небольшая таблица частотных глаголов A2 со всеми нужными формами.
interface VerbForms {
  inf: string;
  ru: string;
  aux: "avoir" | "être";
  pp: string; // participe passé
  present: Record<Pronoun, string>;
  imparfait: Record<Pronoun, string>;
  futur: Record<Pronoun, string>;
  subjonctif: Record<Pronoun, string>;
}

export const A2_VERBS: VerbForms[] = [
  {
    inf: "parler", ru: "говорить", aux: "avoir", pp: "parlé",
    present: { je: "parle", tu: "parles", il: "parle", nous: "parlons", vous: "parlez", ils: "parlent" },
    imparfait: { je: "parlais", tu: "parlais", il: "parlait", nous: "parlions", vous: "parliez", ils: "parlaient" },
    futur: { je: "parlerai", tu: "parleras", il: "parlera", nous: "parlerons", vous: "parlerez", ils: "parleront" },
    subjonctif: { je: "parle", tu: "parles", il: "parle", nous: "parlions", vous: "parliez", ils: "parlent" },
  },
  {
    inf: "être", ru: "быть", aux: "avoir", pp: "été",
    present: { je: "suis", tu: "es", il: "est", nous: "sommes", vous: "êtes", ils: "sont" },
    imparfait: { je: "étais", tu: "étais", il: "était", nous: "étions", vous: "étiez", ils: "étaient" },
    futur: { je: "serai", tu: "seras", il: "sera", nous: "serons", vous: "serez", ils: "seront" },
    subjonctif: { je: "sois", tu: "sois", il: "soit", nous: "soyons", vous: "soyez", ils: "soient" },
  },
  {
    inf: "avoir", ru: "иметь", aux: "avoir", pp: "eu",
    present: { je: "ai", tu: "as", il: "a", nous: "avons", vous: "avez", ils: "ont" },
    imparfait: { je: "avais", tu: "avais", il: "avait", nous: "avions", vous: "aviez", ils: "avaient" },
    futur: { je: "aurai", tu: "auras", il: "aura", nous: "aurons", vous: "aurez", ils: "auront" },
    subjonctif: { je: "aie", tu: "aies", il: "ait", nous: "ayons", vous: "ayez", ils: "aient" },
  },
  {
    inf: "aller", ru: "идти/ехать", aux: "être", pp: "allé",
    present: { je: "vais", tu: "vas", il: "va", nous: "allons", vous: "allez", ils: "vont" },
    imparfait: { je: "allais", tu: "allais", il: "allait", nous: "allions", vous: "alliez", ils: "allaient" },
    futur: { je: "irai", tu: "iras", il: "ira", nous: "irons", vous: "irez", ils: "iront" },
    subjonctif: { je: "aille", tu: "ailles", il: "aille", nous: "allions", vous: "alliez", ils: "aillent" },
  },
  {
    inf: "faire", ru: "делать", aux: "avoir", pp: "fait",
    present: { je: "fais", tu: "fais", il: "fait", nous: "faisons", vous: "faites", ils: "font" },
    imparfait: { je: "faisais", tu: "faisais", il: "faisait", nous: "faisions", vous: "faisiez", ils: "faisaient" },
    futur: { je: "ferai", tu: "feras", il: "fera", nous: "ferons", vous: "ferez", ils: "feront" },
    subjonctif: { je: "fasse", tu: "fasses", il: "fasse", nous: "fassions", vous: "fassiez", ils: "fassent" },
  },
  {
    inf: "venir", ru: "приходить", aux: "être", pp: "venu",
    present: { je: "viens", tu: "viens", il: "vient", nous: "venons", vous: "venez", ils: "viennent" },
    imparfait: { je: "venais", tu: "venais", il: "venait", nous: "venions", vous: "veniez", ils: "venaient" },
    futur: { je: "viendrai", tu: "viendras", il: "viendra", nous: "viendrons", vous: "viendrez", ils: "viendront" },
    subjonctif: { je: "vienne", tu: "viennes", il: "vienne", nous: "venions", vous: "veniez", ils: "viennent" },
  },
  {
    inf: "prendre", ru: "брать", aux: "avoir", pp: "pris",
    present: { je: "prends", tu: "prends", il: "prend", nous: "prenons", vous: "prenez", ils: "prennent" },
    imparfait: { je: "prenais", tu: "prenais", il: "prenait", nous: "prenions", vous: "preniez", ils: "prenaient" },
    futur: { je: "prendrai", tu: "prendras", il: "prendra", nous: "prendrons", vous: "prendrez", ils: "prendront" },
    subjonctif: { je: "prenne", tu: "prennes", il: "prenne", nous: "prenions", vous: "preniez", ils: "prennent" },
  },
  {
    inf: "pouvoir", ru: "мочь", aux: "avoir", pp: "pu",
    present: { je: "peux", tu: "peux", il: "peut", nous: "pouvons", vous: "pouvez", ils: "peuvent" },
    imparfait: { je: "pouvais", tu: "pouvais", il: "pouvait", nous: "pouvions", vous: "pouviez", ils: "pouvaient" },
    futur: { je: "pourrai", tu: "pourras", il: "pourra", nous: "pourrons", vous: "pourrez", ils: "pourront" },
    subjonctif: { je: "puisse", tu: "puisses", il: "puisse", nous: "puissions", vous: "puissiez", ils: "puissent" },
  },
];

export interface ConjugationItem {
  verb: string;
  ru: string;
  pronoun: string;
  tense: Tense;
  answer: string;       // правильная форма (для passé composé — полная: aux+pp)
  display: string;      // эталонная фраза целиком
  hint: string;
}

export function generateConjugation(tense: Tense, seed?: number): ConjugationItem {
  const r = seed ?? Math.random();
  const verb = A2_VERBS[Math.floor((r * 7919) % A2_VERBS.length)];
  const pron = PRONOUNS[Math.floor((r * 104729) % PRONOUNS.length)];

  let answer: string; let hint: string;
  if (tense === "passe_compose") {
    const aux = verb.aux === "avoir" ? verb.present[pron === "je" ? "je" : pron] : verb.present[pron];
    // вспомогательный в présent + participe passé
    const auxForm = verb.aux === "avoir"
      ? ({ je: "ai", tu: "as", il: "a", nous: "avons", vous: "avez", ils: "ont" } as Record<Pronoun, string>)[pron]
      : ({ je: "suis", tu: "es", il: "est", nous: "sommes", vous: "êtes", ils: "sont" } as Record<Pronoun, string>)[pron];
    const jPref = pron === "je" ? "j'" : pron + " ";
    const agree = verb.aux === "être" ? agreePP(verb.pp, pron) : verb.pp;
    answer = `${pron === "je" && auxForm[0] && "ai".includes(auxForm) ? "" : ""}${auxForm} ${agree}`.trim();
    void aux;
    hint = `${TENSE_LABELS[tense]}: ${verb.aux} (${auxForm}) + participe (${verb.pp})`;
    return { verb: verb.inf, ru: verb.ru, pronoun: pron, tense, answer, display: `${jPref}${answer}`, hint };
  } else {
    answer = verb[tense][pron];
    hint = tense === "subjonctif"
      ? `Subjonctif часто после «il faut que…», «que je…»`
      : `${TENSE_LABELS[tense]} глагола ${verb.inf}`;
    const jPref = pron === "je" && /^[aeiouéèêh]/i.test(answer) ? "j'" : pron + " ";
    const display = tense === "subjonctif" ? `que ${pron === "je" && /^[aeiouéèêh]/i.test(answer) ? "j'" : pron + " "}${answer}` : `${jPref}${answer}`;
    return { verb: verb.inf, ru: verb.ru, pronoun: pron, tense, answer, display, hint };
  }
}

function agreePP(pp: string, pron: Pronoun): string {
  // упрощённое согласование для être-глаголов (ils → +s)
  if (pron === "ils") return pp + "s";
  if (pron === "nous") return pp + "s";
  return pp;
}

export function checkConjugation(item: ConjugationItem, user: string): boolean {
  const u = normalizeA2(user).replace(/^(je|j'|tu|il|elle|nous|vous|ils|elles|que)\s*/g, "").trim();
  const a = normalizeA2(item.answer);
  return u === a || normalizeA2(user) === normalizeA2(item.display);
}

// ─────────────────────────────────────────────────────────────
// ИДЕЯ 4: РОЛЕВЫЕ ДИАЛОГИ
// ─────────────────────────────────────────────────────────────
export interface DialogueLine { speaker: "bot" | "user"; fr: string; ru: string; }
export interface Dialogue { id: string; unit: number; title: string; scene: string; lines: DialogueLine[]; }

export const A2_DIALOGUES: Dialogue[] = [
  {
    id: "restaurant", unit: 6, title: "Au restaurant", scene: "Вы заказываете еду в ресторане.",
    lines: [
      { speaker: "bot", fr: "Bonjour ! Vous avez choisi ?", ru: "Здравствуйте! Вы выбрали?" },
      { speaker: "user", fr: "Oui, je voudrais le menu du jour, s'il vous plaît.", ru: "Да, я хотел бы меню дня, пожалуйста." },
      { speaker: "bot", fr: "Très bien. Et comme boisson ?", ru: "Отлично. А из напитков?" },
      { speaker: "user", fr: "Je prends de l'eau, merci.", ru: "Я возьму воду, спасибо." },
      { speaker: "bot", fr: "Parfait, j'arrive tout de suite.", ru: "Отлично, сейчас принесу." },
    ],
  },
  {
    id: "medecin", unit: 7, title: "Chez le médecin", scene: "Вы на приёме у врача.",
    lines: [
      { speaker: "bot", fr: "Bonjour, qu'est-ce qui ne va pas ?", ru: "Здравствуйте, что вас беспокоит?" },
      { speaker: "user", fr: "J'ai mal à la tête depuis hier.", ru: "У меня болит голова со вчерашнего дня." },
      { speaker: "bot", fr: "Vous avez de la fièvre ?", ru: "У вас есть температура?" },
      { speaker: "user", fr: "Oui, un peu. Je suis fatigué aussi.", ru: "Да, немного. Я ещё и устал." },
      { speaker: "bot", fr: "Reposez-vous et buvez beaucoup d'eau.", ru: "Отдыхайте и пейте много воды." },
    ],
  },
  {
    id: "voyage", unit: 10, title: "À la gare", scene: "Вы покупаете билет на поезд.",
    lines: [
      { speaker: "bot", fr: "Bonjour, je peux vous aider ?", ru: "Здравствуйте, могу помочь?" },
      { speaker: "user", fr: "Je voudrais un billet pour Lyon, s'il vous plaît.", ru: "Я хотел бы билет до Лиона, пожалуйста." },
      { speaker: "bot", fr: "Aller simple ou aller-retour ?", ru: "В одну сторону или туда-обратно?" },
      { speaker: "user", fr: "Un aller-retour, pour demain matin.", ru: "Туда-обратно, на завтра утром." },
      { speaker: "bot", fr: "Voilà. Bon voyage !", ru: "Вот, пожалуйста. Счастливого пути!" },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// ИДЕЯ 2: АУДИО-ДИКТАНТЫ (фразы по юнитам, проигрываются TTS)
// ─────────────────────────────────────────────────────────────
export interface Dictation { id: number; unit: number; fr: string; ru: string; }
export const A2_DICTATIONS: Dictation[] = [
  { id: 1, unit: 1, fr: "Nous avons déménagé le mois dernier.", ru: "Мы переехали в прошлом месяце." },
  { id: 2, unit: 2, fr: "Quand j'étais jeune, je jouais du piano.", ru: "Когда я был молод, я играл на пианино." },
  { id: 3, unit: 4, fr: "Elle est plus grande que sa sœur.", ru: "Она выше своей сестры." },
  { id: 4, unit: 5, fr: "L'année prochaine, nous voyagerons en Italie.", ru: "В следующем году мы поедем в Италию." },
  { id: 5, unit: 6, fr: "Ajoutez du sel et mélangez bien.", ru: "Добавьте соль и хорошо перемешайте." },
  { id: 6, unit: 8, fr: "Je ne regarde plus la télévision.", ru: "Я больше не смотрю телевизор." },
  { id: 7, unit: 10, fr: "En arrivant, j'ai vu la mer.", ru: "Приехав, я увидел море." },
  { id: 8, unit: 12, fr: "Il faut que nous protégions la nature.", ru: "Нужно, чтобы мы защищали природу." },
];

// ─────────────────────────────────────────────────────────────
// ИДЕЯ 5: «ОШИБКА ДНЯ» — типичные ошибки A2
// ─────────────────────────────────────────────────────────────
export interface CommonMistake { wrong: string; right: string; why: string; }
export const A2_COMMON_MISTAKES: CommonMistake[] = [
  { wrong: "Je suis allé à le cinéma.", right: "Je suis allé au cinéma.", why: "à + le = au (слияние артикля)." },
  { wrong: "Je ne mange pas de la viande.", right: "Je ne mange pas de viande.", why: "После отрицания партитив du/de la/des → de." },
  { wrong: "C'est plus bon que ça.", right: "C'est meilleur que ça.", why: "bon в сравнении → meilleur, а не «plus bon»." },
  { wrong: "Il faut que tu es là.", right: "Il faut que tu sois là.", why: "После «il faut que» — subjonctif: que tu sois." },
  { wrong: "J'ai allé à Paris.", right: "Je suis allé à Paris.", why: "Глаголы движения (aller) в passé composé с être." },
  { wrong: "Je l'ai parlé.", right: "Je lui ai parlé.", why: "parler à qqn → COI (lui), а не COD (l')." },
  { wrong: "En travailler, il écoute la radio.", right: "En travaillant, il écoute la radio.", why: "Gérondif: en + причастие (travaillant)." },
  { wrong: "Je vais à Japon.", right: "Je vais au Japon.", why: "Страна мужского рода → au." },
];

export function mistakeOfTheDay(date = new Date()): CommonMistake {
  const day = Math.floor(date.getTime() / 86400000);
  return A2_COMMON_MISTAKES[day % A2_COMMON_MISTAKES.length];
}

// ─────────────────────────────────────────────────────────────
// ИДЕЯ 7: ВИЗУАЛЬНАЯ ЛЕКСИКА — эмодзи к словам (память по образам)
// ─────────────────────────────────────────────────────────────
export const VOCAB_EMOJI: Record<string, string> = {
  "déménager": "📦", "un changement": "🔄", "recommencer": "🔁", "une étape": "🪜", "s'installer": "🏠", "quitter": "👋",
  "un souvenir": "💭", "se rappeler": "🧠", "l'enfance (f)": "🧒", "autrefois": "⏳", "à l'époque": "📅", "une habitude": "♻️",
  "un logement": "🏘️", "louer": "🔑", "un loyer": "💶", "un meuble": "🪑", "le quartier": "🏙️", "emménager": "🚚",
  "ressembler à": "👯", "la différence": "🔀", "le caractère": "🎭", "généreux / généreuse": "🎁", "timide": "🙈", "partager": "🤝",
  "l'avenir (m)": "🔮", "une invention": "💡", "un progrès": "📈", "prévoir": "📊", "un robot": "🤖", "améliorer": "⬆️",
  "une recette": "📋", "ajouter": "➕", "mélanger": "🥄", "un ingrédient": "🧂", "couper": "🔪", "cuire": "🍳",
  "la santé": "❤️", "avoir mal à": "🤕", "un médicament": "💊", "se reposer": "🛌", "guérir": "🩹", "un conseil": "💬",
  "une actualité": "📰", "un journal": "🗞️", "une chaîne": "📺", "un article": "📄", "s'informer": "🔍", "une publicité": "📢",
  "recycler": "♻️", "le gaspillage": "🗑️", "durable": "🌱", "consommer": "🛒", "l'environnement (m)": "🌍", "économiser": "💰",
  "un voyage": "✈️", "à l'étranger": "🌐", "une valise": "🧳", "découvrir": "🗺️", "un billet": "🎫", "réserver": "📅",
  "un parcours": "🛤️", "réussir": "🏆", "un métier": "💼", "une formation": "🎓", "un diplôme": "📜", "postuler": "✉️",
  "la nature": "🌳", "protéger": "🛡️", "un paysage": "🏞️", "respirer": "🫁", "la forêt": "🌲", "préserver": "🌿",
};

// ─────────────────────────────────────────────────────────────
// ИДЕЯ «ÉPREUVE BLANCHE DELF A2» — выборка смешанного экзамена
// ─────────────────────────────────────────────────────────────
export function buildExam(count = 20): A2Question[] {
  const pool = [...A2_DIAGNOSTIC];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// ─────────────────────────────────────────────────────────────
// ИДЕИ 6+8: ГЕЙМИФИКАЦИЯ (localStorage)
// ─────────────────────────────────────────────────────────────
export interface Gamification {
  xp: number;
  streak: number;
  lastActiveDay: string;     // YYYY-MM-DD
  badges: string[];          // ["unit-1", "exam-pass", ...]
  weakUnits: number[];       // из диагностики
}

const GKEY = "memora_a2_gamification";

export function loadGamification(): Gamification {
  if (typeof window === "undefined") return { xp: 0, streak: 0, lastActiveDay: "", badges: [], weakUnits: [] };
  try {
    const raw = localStorage.getItem(GKEY);
    if (raw) return JSON.parse(raw) as Gamification;
  } catch { /* ignore */ }
  return { xp: 0, streak: 0, lastActiveDay: "", badges: [], weakUnits: [] };
}

export function saveGamification(g: Gamification) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(GKEY, JSON.stringify(g)); } catch { /* ignore */ }
}

function today(): string { return new Date().toISOString().slice(0, 10); }

export function addXp(amount: number): Gamification {
  const g = loadGamification();
  g.xp += amount;
  const t = today();
  if (g.lastActiveDay !== t) {
    const yest = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    g.streak = g.lastActiveDay === yest ? g.streak + 1 : 1;
    g.lastActiveDay = t;
  }
  saveGamification(g);
  return g;
}

export function awardBadge(badge: string): Gamification {
  const g = loadGamification();
  if (!g.badges.includes(badge)) { g.badges.push(badge); saveGamification(g); }
  return g;
}

export function setWeakUnits(units: number[]): Gamification {
  const g = loadGamification();
  g.weakUnits = units;
  saveGamification(g);
  return g;
}

export function levelFromXp(xp: number): { level: number; title: string; next: number } {
  const level = Math.floor(xp / 100) + 1;
  const titles = ["Débutant", "Explorateur", "Apprenti", "Voyageur", "Confirmé", "Expert A2"];
  return { level, title: titles[Math.min(level - 1, titles.length - 1)], next: level * 100 };
}
