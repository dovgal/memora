-- Add FSRS tracking tables

CREATE TABLE IF NOT EXISTS fsrs_records (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    state SMALLINT NOT NULL DEFAULT 0, -- 0=New, 1=Learning, 2=Review, 3=Relearning
    due TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stability REAL NOT NULL,
    difficulty REAL NOT NULL,
    elapsed_days INTEGER NOT NULL DEFAULT 0,
    scheduled_days INTEGER NOT NULL DEFAULT 0,
    reps INTEGER NOT NULL DEFAULT 0,
    lapses INTEGER NOT NULL DEFAULT 0,
    last_review TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, flashcard_id)
);

CREATE TABLE IF NOT EXISTS review_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flashcard_id UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL, -- 1=Again, 2=Hard, 3=Good, 4=Easy
    review_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    elapsed_days INTEGER NOT NULL,
    scheduled_days INTEGER NOT NULL
);

-- Index for quickly finding due cards for a user
CREATE INDEX IF NOT EXISTS idx_fsrs_records_user_due ON fsrs_records(user_id, due);
