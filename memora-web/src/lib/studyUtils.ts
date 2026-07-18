import { FlashcardResponse, FieldSchema } from "@/types/schema"

export function getCardText(card: FlashcardResponse, side: 'front' | 'back', schema?: FieldSchema[], includeLabels: boolean = true): string {
    if (!schema || schema.length === 0) {
        return side === 'front' ? card.term : card.definition;
    }
    const textFields = schema.filter(f => f.side === side && f.type === 'text').sort((a, b) => a.order - b.order);
    if (textFields.length === 0) return "(Без текста)";

    return textFields.map(field => {
        let value = "";
        if (field.id === 'term') value = card.term;
        else if (field.id === 'definition') value = card.definition;
        else { const v = card.fieldsData?.[field.id]; value = typeof v === 'string' ? v : ""; }

        if (!value) return null;
        if (textFields.length === 1 || !includeLabels) return value;
        return `${field.name.toUpperCase()}:\n${value}`;
    }).filter(text => text !== null).join('\n\n');
}

export interface MultipleChoiceQuestion {
    flashcard: FlashcardResponse
    prompt: string
    options: string[] // Array of answer options
    correctIndex: number // Index of the correct answer in the options array
    answerType: 'term' | 'definition'
}

export interface WrittenQuestion {
    prompt: string
    correctAnswer: string
    answerType: 'term' | 'definition'
    targetFieldName?: string // set when card has multiple fields on the answer side
}

/**
 * Picks a single random text field from the given side of a card.
 * Returns field name, its value, and whether the card has multiple fields on that side.
 */
export function getCardSingleField(
    card: FlashcardResponse,
    side: 'front' | 'back',
    schema?: FieldSchema[]
): { name: string; value: string; isMultiField: boolean } {
    if (!schema || schema.length === 0) {
        return {
            name: side === 'front' ? 'Term' : 'Definition',
            value: side === 'front' ? card.term : card.definition,
            isMultiField: false,
        };
    }

    const textFields = schema
        .filter(f => f.side === side && f.type === 'text')
        .sort((a, b) => a.order - b.order);

    if (textFields.length === 0) {
        return { name: '', value: '', isMultiField: false };
    }

    // Pick a random field
    const field = textFields[Math.floor(Math.random() * textFields.length)];

    let value = '';
    if (field.id === 'term') value = card.term;
    else if (field.id === 'definition') value = card.definition;
    else { const v = card.fieldsData?.[field.id]; value = typeof v === 'string' ? v : ''; }

    return { name: field.name, value, isMultiField: textFields.length > 1 };
}

export interface MatchingQuestion {
    pairs: { flashcardId: string; term: string; definition: string }[]
}

/**
 * Generates an array of distractors (incorrect answers) for a given flashcard
 * by randomly selecting values from other flashcards in the set.
 */
export function generateDistractors(
    correctCard: FlashcardResponse,
    allCards: FlashcardResponse[],
    numDistractors: number = 3,
    answerType: 'term' | 'definition' = 'definition',
    schema?: FieldSchema[]
): string[] {
    // Filter out the correct card
    const availableDistractors = allCards.filter((c) => c.id !== correctCard.id)

    // Shuffle the remaining cards
    const shuffled = [...availableDistractors].sort(() => 0.5 - Math.random())

    // Select the required number of distractors (or as many as available)
    const selectedCards = shuffled.slice(0, numDistractors)

    return selectedCards.map((c) => answerType === 'term' ? getCardText(c, 'front', schema) : getCardText(c, 'back', schema))
}

/**
 * Creates a multiple-choice question for a given flashcard.
 */
export function createMultipleChoiceQuestion(
    correctCard: FlashcardResponse,
    allCards: FlashcardResponse[],
    answerType: 'term' | 'definition' = 'definition',
    schema?: FieldSchema[]
): MultipleChoiceQuestion {
    // If the set has fewer than 4 cards, we adapt to however many we have
    const numDistractors = Math.min(3, allCards.length - 1)
    const distractors = generateDistractors(correctCard, allCards, numDistractors, answerType, schema)

    // Combine distractors with the correct answer
    const correctAnswer = answerType === 'term' ? getCardText(correctCard, 'front', schema) : getCardText(correctCard, 'back', schema)
    const prompt = answerType === 'term' ? getCardText(correctCard, 'back', schema) : getCardText(correctCard, 'front', schema)
    const allOptions = [...distractors, correctAnswer]

    // Shuffle the options so the correct answer isn't always last
    const shuffledOptions = [...allOptions].sort(() => 0.5 - Math.random())

    // Find the new index of the correct answer
    const correctIndex = shuffledOptions.findIndex((opt) => opt === correctAnswer)

    return {
        flashcard: correctCard,
        prompt,
        options: shuffledOptions,
        correctIndex,
        answerType
    }
}

/**
 * Determines the order of cards to study in "Learn" mode.
 * Prioritizes cards that are NOT marked as 'known' in the user's progress.
 * If progress data is unavailable, falls back to shuffling all cards.
 * 
 * Note: Progress data structure would typically map flashcardId -> isKnown boolean.
 * We'll use a simplified mapping here based on the SetProgressResponse or similar session data.
 */
export function generateLearnQueue(
    allCards: FlashcardResponse[],
    knownFlashcardIds: Set<string>
): FlashcardResponse[] {
    const unknownCards = allCards.filter((c) => !knownFlashcardIds.has(c.id))
    const knownCards = allCards.filter((c) => knownFlashcardIds.has(c.id))

    // Shuffle both lists independently
    const shuffledUnknown = [...unknownCards].sort(() => 0.5 - Math.random())
    const shuffledKnown = [...knownCards].sort(() => 0.5 - Math.random())

    // Simple SR approach: put all unknown cards first, followed by known cards for review
    return [...shuffledUnknown, ...shuffledKnown]
}

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE" | "WRITTEN" | "MATCHING"

export interface TestQuestion {
    flashcard: FlashcardResponse // For MATCHING, this is the first card of the chunk for backward compatibility
    type: QuestionType
    mcqData?: MultipleChoiceQuestion
    tfData?: { statement: string; isTrue: boolean }
    writtenData?: WrittenQuestion
    matchingData?: MatchingQuestion
}

/**
 * Config for test generation
 */
export interface TestConfig {
    limit?: number;
    allowedTypes: {
        trueFalse: boolean;
        multipleChoice: boolean;
        written: boolean;
        matching: boolean;
    };
    schema?: FieldSchema[];
}

/**
 * Generates a configured test from the flashcard set.
 */
export function generateTest(allCards: FlashcardResponse[], config: TestConfig): TestQuestion[] {
    // Shuffle cards
    let selectedCards = [...allCards].sort(() => 0.5 - Math.random())

    if (config.limit && config.limit > 0 && config.limit < selectedCards.length) {
        selectedCards = selectedCards.slice(0, config.limit)
    }

    const testQuestions: TestQuestion[] = [];
    const processingCards = [...selectedCards];

    const availableTypes: QuestionType[] = [];
    if (config.allowedTypes.multipleChoice) availableTypes.push("MULTIPLE_CHOICE");
    if (config.allowedTypes.trueFalse) availableTypes.push("TRUE_FALSE");
    if (config.allowedTypes.written) availableTypes.push("WRITTEN");
    if (config.allowedTypes.matching) availableTypes.push("MATCHING");

    while (processingCards.length > 0) {
        let chosenType: QuestionType = "TRUE_FALSE";

        if (availableTypes.length > 0) {
            chosenType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }

        // Avoid matching if < 2
        if (chosenType === "MATCHING" && processingCards.length < 2) {
            const others = availableTypes.filter(t => t !== "MATCHING");
            chosenType = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : "TRUE_FALSE";
        }

        // Avoid MCQ if absolutely no distractors possible in the entire original set
        if (chosenType === "MULTIPLE_CHOICE" && allCards.length < 2) {
            const others = availableTypes.filter(t => t !== "MULTIPLE_CHOICE");
            chosenType = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : "TRUE_FALSE";
        }

        if (chosenType === "MATCHING") {
            // grab 2 to 5 cards for the matching block
            const take = Math.min(5, Math.max(2, processingCards.length));
            const chunkCards = processingCards.splice(0, take);

            testQuestions.push({
                flashcard: chunkCards[0],
                type: "MATCHING",
                matchingData: {
                    pairs: chunkCards.map(c => ({
                        flashcardId: c.id,
                        term: getCardText(c, 'front', config.schema),
                        definition: getCardText(c, 'back', config.schema)
                    }))
                }
            });
        } else {
            const card = processingCards.shift()!;

            if (chosenType === "MULTIPLE_CHOICE") {
                testQuestions.push({
                    flashcard: card,
                    type: "MULTIPLE_CHOICE",
                    mcqData: createMultipleChoiceQuestion(card, allCards, 'definition', config.schema)
                });
            } else if (chosenType === "WRITTEN") {
                const answerType = Math.random() > 0.5 ? 'term' : 'definition';
                testQuestions.push({
                    flashcard: card,
                    type: "WRITTEN",
                    writtenData: {
                        prompt: answerType === 'term' ? getCardText(card, 'back', config.schema) : getCardText(card, 'front', config.schema),
                        correctAnswer: answerType === 'term' ? getCardText(card, 'front', config.schema) : getCardText(card, 'back', config.schema),
                        answerType
                    }
                });
            } else {
                // True/False
                const makeTrue = Math.random() > 0.5;
                let statement = getCardText(card, 'back', config.schema);

                if (!makeTrue && allCards.length > 1) {
                    const wrongCard = allCards.filter(c => c.id !== card.id)[Math.floor(Math.random() * (allCards.length - 1))];
                    statement = getCardText(wrongCard, 'back', config.schema);
                }

                testQuestions.push({
                    flashcard: card,
                    type: "TRUE_FALSE",
                    tfData: { statement, isTrue: makeTrue }
                });
            }
        }
    }

    return testQuestions;
}

// ---------- Умная проверка письменных ответов ----------

// Русские числительные для эквивалентности «7 часов» == «семь часов».
const RU_NUMBERS: Record<string, string> = {
    '0': 'ноль', '1': 'один', '2': 'два', '3': 'три', '4': 'четыре', '5': 'пять',
    '6': 'шесть', '7': 'семь', '8': 'восемь', '9': 'девять', '10': 'десять',
    '11': 'одиннадцать', '12': 'двенадцать', '13': 'тринадцать', '14': 'четырнадцать',
    '15': 'пятнадцать', '16': 'шестнадцать', '17': 'семнадцать', '18': 'восемнадцать',
    '19': 'девятнадцать', '20': 'двадцать', '30': 'тридцать', '40': 'сорок',
    '50': 'пятьдесят', '60': 'шестьдесят', '70': 'семьдесят', '80': 'восемьдесят',
    '90': 'девяносто', '100': 'сто',
};

function normalizeAnswer(s: string): string {
    return s
        .toLowerCase()
        .replace(/ё/g, 'е')
        // терминальная и «декоративная» пунктуация не влияет на смысл
        .replace(/[.,!?;:«»"„“”…]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        // одиночные числа заменяем словами (только точные ключи из словаря)
        .split(' ')
        .map(w => RU_NUMBERS[w] ?? w)
        .join(' ');
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}

/**
 * Эталон карточки → список допустимых ответов:
 * - ведущая транскрипция «[bɔ̃ʒuʁ] привет» отбрасывается;
 * - альтернативы через « / » или «;» — каждая засчитывается отдельно;
 * - текст в скобках опционален: «привет (неформально)» ≈ «привет».
 */
export function acceptableAnswers(correct: string): string[] {
    const noIpa = correct.trim().replace(/^\[[^\]]*\]\s*/, '');
    const variants = noIpa.split(/\s*[/;]\s*/).filter(Boolean);

    // Запятая в словарном переводе обычно тоже разделяет синонимы
    // («здравствуйте, добрый день»). Но только если каждая часть короткая —
    // предложения с запятыми («Спасибо, я приду завтра утром») не режем.
    const commaExpanded: string[] = [];
    for (const v of variants) {
        commaExpanded.push(v);
        const parts = v.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length > 1 && parts.every(p => p.split(/\s+/).length <= 3)) {
            commaExpanded.push(...parts);
        }
    }

    const out = new Set<string>();
    for (const v of commaExpanded) {
        out.add(normalizeAnswer(v));
        const noParens = v.replace(/\s*\([^)]*\)\s*/g, ' ');
        if (noParens !== v) out.add(normalizeAnswer(noParens));
    }
    out.delete('');
    return [...out];
}

/**
 * Проверка письменного ответа с учётом режима оценивания.
 * strict — точное совпадение после нормализации (регистр/пунктуация/скобки/числа);
 * soft — дополнительно прощает 1 опечатку в слове от 5 букв (2 — от 9 букв).
 */
export function checkWrittenAnswer(userAnswer: string, correctAnswer: string, mode: 'soft' | 'moderate' | 'strict' = 'strict'): boolean {
    const user = normalizeAnswer(userAnswer);
    if (!user) return false;
    const targets = acceptableAnswers(correctAnswer);
    if (targets.includes(user)) return true;
    if (mode === 'strict') return false;

    // Мягкий/умеренный режим: допускаем небольшие опечатки.
    for (const t of targets) {
        const dist = levenshtein(user, t);
        const allowed = t.length >= 9 ? 2 : t.length >= 5 ? 1 : 0;
        if (dist <= allowed) return true;
    }
    return false;
}
