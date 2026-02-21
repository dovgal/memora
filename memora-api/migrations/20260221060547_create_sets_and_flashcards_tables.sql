-- Create sets table
CREATE TABLE IF NOT EXISTS sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for public queries
CREATE INDEX IF NOT EXISTS idx_sets_is_public ON sets(is_public);

-- Create flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    term TEXT NOT NULL,
    definition TEXT NOT NULL,
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying cards by set
CREATE INDEX IF NOT EXISTS idx_flashcards_set_id ON flashcards(set_id);

-- SEED MOCK PUBLIC SET FOR EPIC 1 STORY 1.5 VERIFICATION
-- This creates a dummy user and a public set so we can test the unauthenticated viewer flow.
INSERT INTO users (id, email, role) 
VALUES ('11111111-1111-1111-1111-111111111111', 'demo-teacher@memora.local', 'teacher')
ON CONFLICT (id) DO NOTHING;

INSERT INTO sets (id, creator_id, title, description, is_public) 
VALUES (
    '22222222-2222-2222-2222-222222222222', 
    '11111111-1111-1111-1111-111111111111', 
    'Rust Programming Basics', 
    'A beginner-friendly intro to Rust concepts.', 
    true
)
ON CONFLICT (id) DO NOTHING;

-- Seed Flashcards associated with the mock set
INSERT INTO flashcards (id, set_id, term, definition, order_index) VALUES
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Ownership', 'Rusts most unique feature. Enables memory safety without needing a garbage collector.', 1),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Borrow Checker', 'A compiler component that enforces ownership rules, ensuring references do not outlive the data they point to.', 2),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Cargo', 'The Rust package manager and build system.', 3),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'Lifetime', 'A construct the compiler uses to ensure all borrows are valid. Often inferred, but sometimes requires explicit annotations.', 4)
ON CONFLICT DO NOTHING;
