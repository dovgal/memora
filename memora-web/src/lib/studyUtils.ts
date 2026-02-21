import { Flashcard } from "@/types/schema"

export interface MultipleChoiceQuestion {
    flashcard: Flashcard
    options: string[] // Array of definition options
    correctIndex: number // Index of the correct definition in the options array
}

/**
 * Generates an array of distractors (incorrect definitions) for a given flashcard
 * by randomly selecting definitions from other flashcards in the set.
 */
export function generateDistractors(
    correctCard: Flashcard,
    allCards: Flashcard[],
    numDistractors: number = 3
): string[] {
    // Filter out the correct card
    const availableDistractors = allCards.filter((c) => c.id !== correctCard.id)

    // Shuffle the remaining cards
    const shuffled = [...availableDistractors].sort(() => 0.5 - Math.random())

    // Select the required number of distractors (or as many as available)
    const selectedCards = shuffled.slice(0, numDistractors)

    return selectedCards.map((c) => c.definition)
}

/**
 * Creates a multiple-choice question for a given flashcard.
 */
export function createMultipleChoiceQuestion(
    correctCard: Flashcard,
    allCards: Flashcard[]
): MultipleChoiceQuestion {
    // If the set has fewer than 4 cards, we adapt to however many we have
    const numDistractors = Math.min(3, allCards.length - 1)
    const distractors = generateDistractors(correctCard, allCards, numDistractors)

    // Combine distractors with the correct definition
    const allOptions = [...distractors, correctCard.definition]

    // Shuffle the options so the correct answer isn't always last
    const shuffledOptions = [...allOptions].sort(() => 0.5 - Math.random())

    // Find the new index of the correct answer
    const correctIndex = shuffledOptions.findIndex((opt) => opt === correctCard.definition)

    return {
        flashcard: correctCard,
        options: shuffledOptions,
        correctIndex,
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
    allCards: Flashcard[],
    knownFlashcardIds: Set<string>
): Flashcard[] {
    const unknownCards = allCards.filter((c) => !knownFlashcardIds.has(c.id))
    const knownCards = allCards.filter((c) => knownFlashcardIds.has(c.id))

    // Shuffle both lists independently
    const shuffledUnknown = [...unknownCards].sort(() => 0.5 - Math.random())
    const shuffledKnown = [...knownCards].sort(() => 0.5 - Math.random())

    // Simple SR approach: put all unknown cards first, followed by known cards for review
    return [...shuffledUnknown, ...shuffledKnown]
}

export type QuestionType = "MULTIPLE_CHOICE" | "TRUE_FALSE"

export interface TestQuestion {
    flashcard: Flashcard
    type: QuestionType
    mcqData?: MultipleChoiceQuestion
    tfData?: { statement: string; isTrue: boolean }
}

/**
 * Generates a configured test from the flashcard set.
 */
export function generateTest(allCards: Flashcard[], limit?: number): TestQuestion[] {
    // Shuffle cards
    let selectedCards = [...allCards].sort(() => 0.5 - Math.random())

    if (limit && limit > 0 && limit < selectedCards.length) {
        selectedCards = selectedCards.slice(0, limit)
    }

    return selectedCards.map((card) => {
        // Randomly assign a question type. 
        // True/False is easier to generate if there aren't enough distractors.
        const isMCQ = Math.random() > 0.5 && allCards.length >= 3;

        if (isMCQ) {
            return {
                flashcard: card,
                type: "MULTIPLE_CHOICE",
                mcqData: createMultipleChoiceQuestion(card, allCards)
            }
        } else {
            // True/False Generation
            const makeTrue = Math.random() > 0.5;
            let statement = card.definition;

            if (!makeTrue && allCards.length > 1) {
                // Grab a wrong definition
                const wrongCard = allCards.filter(c => c.id !== card.id)[Math.floor(Math.random() * (allCards.length - 1))];
                statement = wrongCard.definition;
            }

            return {
                flashcard: card,
                type: "TRUE_FALSE",
                tfData: { statement, isTrue: makeTrue }
            }
        }
    })
}
