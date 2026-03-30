-- Create table to store binary audio data for flashcards
CREATE TABLE flashcard_audio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    audio_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flashcard_id, field_id)
);

CREATE INDEX idx_flashcard_audio_card_field ON flashcard_audio(flashcard_id, field_id);
