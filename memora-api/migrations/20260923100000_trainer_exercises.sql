-- Серверный движок тренажёра карточек: профиль карточки + провалидированные упражнения.
--
-- Раньше упражнения выдумывались LLM заново на каждую сессию по одному и тому же
-- шаблону для любой карточки — отсюда «negate: une porte» и «change tense: BREAK».
-- Теперь сервер сначала классифицирует карточку (card_profiles: часть речи, языки
-- сторон, род, лемма), затем строит упражнения по виду карточки: часть —
-- детерминированно из самой карточки, часть — через LLM с проверкой судьи (judge).
-- Прошедшее проверку хранится здесь и переиспользуется между сессиями, пока
-- карточка не изменится (card_hash — хэш term+definition+fields_data).

CREATE TABLE IF NOT EXISTS card_profiles (
    flashcard_id UUID PRIMARY KEY REFERENCES flashcards(id) ON DELETE CASCADE,
    kind         TEXT NOT NULL,
    lang_front   TEXT NOT NULL,
    lang_back    TEXT NOT NULL,
    lemma        TEXT,
    gender       TEXT,
    example      JSONB,
    mnemonic     TEXT,
    card_hash    TEXT NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_exercises (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flashcard_id     UUID NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    kind             TEXT NOT NULL,
    prompt           TEXT NOT NULL,
    prompt_lang      TEXT NOT NULL,
    answer           TEXT NOT NULL,
    accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_lang      TEXT NOT NULL,
    options          JSONB,
    hint             TEXT,
    explanation      TEXT,
    confidence       REAL NOT NULL DEFAULT 1.0,
    card_hash        TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Все упражнения карточки — чтобы посчитать pending и собрать ответ одним проходом.
CREATE INDEX IF NOT EXISTS idx_card_exercises_flashcard_id ON card_exercises(flashcard_id);
-- Упражнения, актуальные под текущий card_hash карточки (idempotent prepare).
CREATE INDEX IF NOT EXISTS idx_card_exercises_flashcard_hash ON card_exercises(flashcard_id, card_hash);
