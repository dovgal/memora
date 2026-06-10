-- Коуч v2: журнал повторений для расчёта серии дней (streak),
-- дневной статистики и аналитики слабых мест.

CREATE TABLE IF NOT EXISTS course_review_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id   TEXT NOT NULL,
    unit_id     TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    rating      SMALLINT NOT NULL, -- 1=Again, 2=Hard, 3=Good, 4=Easy
    review_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_course_review_logs_user_course
    ON course_review_logs(user_id, course_id, review_time DESC);
