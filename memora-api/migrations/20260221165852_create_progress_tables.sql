-- Create the flashcard_progress table to track individual card mastery per user
CREATE TABLE flashcard_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    is_known BOOLEAN NOT NULL DEFAULT false,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Ensure one progress record per user per flashcard
    CONSTRAINT unique_user_flashcard UNIQUE (user_id, flashcard_id)
);

-- Index for quickly calculating a user's progress on a whole set
CREATE INDEX idx_flashcard_progress_user ON flashcard_progress(user_id);
CREATE INDEX idx_flashcard_progress_flashcard ON flashcard_progress(flashcard_id);
