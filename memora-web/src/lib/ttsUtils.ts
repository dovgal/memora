import { CreateFlashcardRequest, FieldSchema } from "@/types/schema";

/**
 * Processes flashcards to ensure fields with TTS enabled have the necessary markers.
 * This function is synchronous but keeps the signature for compatibility with calling sites.
 */
export async function processFlashcardsWithTTS(
    flashcards: CreateFlashcardRequest[],
    fieldsSchema: FieldSchema[]
): Promise<CreateFlashcardRequest[]> {
    const textFieldsWithTTS = fieldsSchema.filter(f => f.type === 'text' && f.settings?.ttsEnabled);

    if (textFieldsWithTTS.length === 0) {
        // Cleanup markers if TTS was disabled
        return flashcards.map(card => {
            const newCard = { ...card, fieldsData: { ...card.fieldsData } };
            Object.keys(newCard.fieldsData).forEach(key => {
                if (key.endsWith('_audio') && newCard.fieldsData[key] === "__AUDIO_ON_SERVER__") {
                    delete newCard.fieldsData[key];
                }
            });
            return newCard;
        });
    }

    return flashcards.map((card) => {
        const newCard = { ...card, fieldsData: { ...card.fieldsData } };

        for (const field of textFieldsWithTTS) {
            let textToRead = "";
            if (field.id === 'term') textToRead = newCard.term;
            else if (field.id === 'definition') textToRead = newCard.definition;
            else { const v = newCard.fieldsData[field.id]; textToRead = typeof v === 'string' ? v : ""; }

            textToRead = (textToRead || "").trim();

            const audioKey = `${field.id}_audio`;
            const marker = "__AUDIO_ON_SERVER__";

            // If text is empty, remove marker
            if (!textToRead) {
                if (newCard.fieldsData[audioKey] === marker) {
                    delete newCard.fieldsData[audioKey];
                }
                continue;
            }

            // Set marker if not present (only if it's currently empty or already a marker)
            // We don't overwrite user-uploaded base64 audio if it's there
            if (!newCard.fieldsData[audioKey] || newCard.fieldsData[audioKey] === marker) {
                newCard.fieldsData[audioKey] = marker;
            }
        }

        return newCard;
    });
}
