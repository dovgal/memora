// Тренажёр письменной речи (production écrite) A2 — задания в формате DELF A2.
// ИИ-проверка по критериям через Ollama (/api/ai/learn/grade с расширенным промптом
// формируется на клиенте). Контент авторский по программе A2.

export interface WritingTask {
  id: number;
  type: "message" | "email" | "carte" | "recit" | "avis";
  title: string;
  prompt: string;        // задание (ru + контекст)
  minWords: number;
  maxWords: number;
  mustInclude: string[]; // что обязательно отразить
  usefulPhrases: string[]; // опорные выражения
  grammarFocus: string;  // целевая грамматика
}

export const A2_WRITING_TASKS: WritingTask[] = [
  {
    id: 1, type: "message", title: "Сообщение другу (приглашение)",
    prompt: "Напишите другу сообщение: пригласите его в кино на выходных, предложите день и время, спросите, что он хочет посмотреть.",
    minWords: 40, maxWords: 60,
    mustInclude: ["приглашение", "день и время", "вопрос о фильме"],
    usefulPhrases: ["Ça te dit de…", "On pourrait se voir…", "Qu'est-ce que tu veux voir ?", "À samedi !"],
    grammarFocus: "futur proche / présent, вопросы",
  },
  {
    id: 2, type: "email", title: "Письмо: бронь отеля",
    prompt: "Напишите письмо в отель: забронируйте номер на 3 ночи, укажите даты, спросите о завтраке и цене.",
    minWords: 60, maxWords: 80,
    mustInclude: ["формула вежливости", "даты и номер", "вопрос о завтраке/цене"],
    usefulPhrases: ["Madame, Monsieur,", "Je voudrais réserver…", "Pourriez-vous me dire…", "Dans l'attente de votre réponse,", "Cordialement,"],
    grammarFocus: "вежливые формы, conditionnel de politesse",
  },
  {
    id: 3, type: "carte", title: "Открытка с каникул",
    prompt: "Вы на каникулах. Напишите открытку другу: где вы, что делаете, какая погода, что вам нравится.",
    minWords: 40, maxWords: 60,
    mustInclude: ["место", "занятия (passé composé)", "погода", "впечатления"],
    usefulPhrases: ["Je suis à…", "Il fait beau / mauvais", "J'ai visité…", "C'est magnifique !", "Bises,"],
    grammarFocus: "passé composé, présent",
  },
  {
    id: 4, type: "recit", title: "Рассказ о прошлом",
    prompt: "Расскажите о вашем последнем дне рождения: что вы делали, с кем были, что было особенного (используйте passé composé и imparfait).",
    minWords: 60, maxWords: 90,
    mustInclude: ["passé composé (события)", "imparfait (описание/фон)", "эмоции"],
    usefulPhrases: ["Pour mon anniversaire, j'ai…", "Il y avait…", "C'était…", "Nous étions…", "On a fêté…"],
    grammarFocus: "passé composé vs imparfait",
  },
  {
    id: 5, type: "avis", title: "Ваше мнение (экология)",
    prompt: "Напишите короткий текст: что вы делаете для защиты окружающей среды и почему это важно (выразите мнение и приведите примеры).",
    minWords: 60, maxWords: 90,
    mustInclude: ["выражение мнения", "примеры действий", "обоснование (parce que)"],
    usefulPhrases: ["À mon avis,", "Je pense que…", "Il faut…", "parce que…", "Par exemple,"],
    grammarFocus: "il faut + inf., présent, connecteurs",
  },
  {
    id: 6, type: "email", title: "Письмо: жалоба / просьба",
    prompt: "Вы купили товар онлайн, но он бракованный. Напишите продавцу: опишите проблему, попросите замену или возврат.",
    minWords: 60, maxWords: 80,
    mustInclude: ["формула вежливости", "описание проблемы (passé composé)", "просьба"],
    usefulPhrases: ["Madame, Monsieur,", "J'ai commandé… mais…", "Le produit est cassé / ne marche pas", "Je vous demande de…", "Cordialement,"],
    grammarFocus: "passé composé, вежливые просьбы",
  },
  {
    id: 7, type: "message", title: "Сообщение: отмена встречи",
    prompt: "Вы не можете прийти на встречу. Напишите сообщение: извинитесь, объясните причину, предложите другой день.",
    minWords: 40, maxWords: 60,
    mustInclude: ["извинение", "причина", "альтернатива (futur)"],
    usefulPhrases: ["Je suis désolé(e), mais…", "Je ne peux pas venir parce que…", "On pourrait se voir…", "Ça te va ?"],
    grammarFocus: "ne...pas, parce que, futur proche",
  },
  {
    id: 8, type: "recit", title: "Планы на будущее",
    prompt: "Опишите ваши планы на следующий год: учёба/работа, путешествия, цели (используйте futur simple).",
    minWords: 60, maxWords: 90,
    mustInclude: ["futur simple", "минимум 3 плана", "обоснование"],
    usefulPhrases: ["L'année prochaine, je…", "Je vais…", "J'espère que…", "Mon objectif est de…"],
    grammarFocus: "futur simple, futur proche",
  },
];

// Формирует промпт-инструкцию для ИИ-оценки (как questionText в /api/ai/learn/grade).
export function buildWritingGradePrompt(task: WritingTask, text: string): string {
  return [
    `Ты — экзаменатор DELF A2. Оцени письменную работу студента (production écrite).`,
    `ЗАДАНИЕ: ${task.prompt}`,
    `Требуемый объём: ${task.minWords}-${task.maxWords} слов.`,
    `Должно быть отражено: ${task.mustInclude.join("; ")}.`,
    `Целевая грамматика: ${task.grammarFocus}.`,
    ``,
    `ТЕКСТ СТУДЕНТА:`,
    text,
    ``,
    `Оцени по критериям DELF A2 и верни в explanation КРАТКИЙ разбор на русском:`,
    `1) Выполнение задания (раскрыты ли все пункты).`,
    `2) Грамматика и спелл (укажи 2-4 конкретные ошибки с исправлением).`,
    `3) Лексика и связность.`,
    `4) Объём (уложился ли в рамки).`,
    `Дай балл 0-1 в score (>=0.6 = зачёт) и в correctAnswer приведи улучшенную версию 1-2 предложений из текста.`,
    `is_correct = true, если работа в целом соответствует A2.`,
  ].join("\n");
}

export function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export const WRITING_TYPE_LABELS: Record<WritingTask["type"], string> = {
  message: "Сообщение", email: "Письмо (email)", carte: "Открытка", recit: "Рассказ", avis: "Мнение",
};
