-- Пользовательские курсы: любой пользователь может создавать и редактировать курсы
-- по образцу встроенных (Édito A1). Юниты хранят словарь и упражнения как JSONB
-- в том же формате, что и edito-a1/*.json — это позволяет рендерить их
-- существующими компонентами ExerciseRenderer без изменений.

CREATE TABLE IF NOT EXISTS custom_courses (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    language     TEXT NOT NULL DEFAULT 'fr',
    level        TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_courses_owner ON custom_courses(owner_id);
CREATE INDEX IF NOT EXISTS idx_custom_courses_published ON custom_courses(is_published) WHERE is_published;

CREATE TABLE IF NOT EXISTS custom_course_units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id   UUID NOT NULL REFERENCES custom_courses(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    vocabulary  JSONB NOT NULL DEFAULT '[]',
    exercises   JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_course_units_course ON custom_course_units(course_id, position);

-- Коуч-режим: интервальное повторение упражнений курса (FSRS, как у карточек).
-- course_id хранится текстом: и встроенные курсы ('edito-a1'), и UUID пользовательских.
CREATE TABLE IF NOT EXISTS course_exercise_reviews (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id    TEXT NOT NULL,
    unit_id      TEXT NOT NULL,
    exercise_id  TEXT NOT NULL,
    state        SMALLINT NOT NULL DEFAULT 0, -- 0=New, 1=Learning, 2=Review, 3=Relearning
    due          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stability    REAL NOT NULL DEFAULT 0,
    difficulty   REAL NOT NULL DEFAULT 0,
    reps         INTEGER NOT NULL DEFAULT 0,
    lapses       INTEGER NOT NULL DEFAULT 0,
    last_review  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id, unit_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_course_exercise_reviews_due ON course_exercise_reviews(user_id, course_id, due);
