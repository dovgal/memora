-- Универсальный прогресс прохождения курсов (не привязан к конкретному курсу).
-- Используется тренажёром Edito A1 (course_id = 'edito-a1') и может переиспользоваться другими курсами.

CREATE TABLE IF NOT EXISTS course_progress (
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id    TEXT NOT NULL,
    unit_id      TEXT NOT NULL,
    exercise_id  TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id, unit_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_course_progress_user_course ON course_progress(user_id, course_id);
