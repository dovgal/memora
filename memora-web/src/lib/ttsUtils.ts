import { FieldSchema, FlashcardResponse } from "@/types/schema";

export async function processFlashcardsWithTTS(
    flashcards: any[],
    fieldsSchema: FieldSchema[]
): Promise<any[]> {
    const textFieldsWithTTS = fieldsSchema.filter(f => f.type === 'text' && f.settings?.ttsEnabled);

    if (textFieldsWithTTS.length === 0) {
        return flashcards;
    }

    const processedCards = await Promise.all(flashcards.map(async (card) => {
        const newCard = { ...card, fieldsData: { ...card.fieldsData } };

        for (const field of textFieldsWithTTS) {
            let textToRead = "";
            if (field.id === 'term') textToRead = newCard.term;
            else if (field.id === 'definition') textToRead = newCard.definition;
            else textToRead = newCard.fieldsData[field.id] || "";

            textToRead = textToRead.trim();

            const audioKey = `${field.id}_audio`;
            const audioTextKey = `${field.id}_audio_text`;

            // Skip if text is empty
            if (!textToRead) {
                delete newCard.fieldsData[audioKey];
                delete newCard.fieldsData[audioTextKey];
                continue;
            }

            // Skip if the text hasn't changed since we last generated audio
            if (newCard.fieldsData[audioKey] && newCard.fieldsData[audioTextKey] === textToRead) {
                continue;
            }

            // Generate new TTS Audio
            try {
                const voiceId = field.settings?.ttsVoice || 'Clive';
                const response = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textToRead, voiceId })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.audioContent) {
                        newCard.fieldsData[audioKey] = `data:audio/mp3;base64,${data.audioContent}`;
                        newCard.fieldsData[audioTextKey] = textToRead;
                    }
                } else {
                    console.error("Failed to generate TTS for field", field.id);
                }
            } catch (err) {
                console.error("Error generating TTS for field", field.id, err);
            }
        }

        return newCard;
    }));

    return processedCards;
}
