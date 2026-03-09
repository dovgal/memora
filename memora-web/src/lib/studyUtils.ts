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
        else value = card.fieldsData?.[field.id] || "";

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
    let processingCards = [...selectedCards];

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
