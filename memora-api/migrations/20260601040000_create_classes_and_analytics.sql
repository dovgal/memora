-- Классы, лидерборд, диагностики, назначения и аналитика ошибок для курса A2.

-- Класс (группа), создаёт преподаватель. join_code — короткий код для вступления.
CREATE TABLE IF NOT EXISTS classes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    join_code   TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);

-- Участники класса (ученики).
CREATE TABLE IF NOT EXISTS class_members (
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON class_members(user_id);

-- Накопленный XP по курсу A2 (для лидерборда). Одна строка на пользователя.
CREATE TABLE IF NOT EXISTS a2_xp (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp          INTEGER NOT NULL DEFAULT 0,
    streak      INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Результаты диагностики A2 (последняя на пользователя + история).
CREATE TABLE IF NOT EXISTS a2_diagnostics (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_pct    INTEGER NOT NULL,
    right_count  INTEGER NOT NULL,
    total        INTEGER NOT NULL,
    weak_units   JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [1,4,7]
    by_skill     JSONB NOT NULL DEFAULT '{}'::jsonb,    -- {"grammar":{"r":..,"t":..}}
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_a2_diag_user ON a2_diagnostics(user_id, created_at DESC);

-- Назначения «Моего плана» от преподавателя ученику.
CREATE TABLE IF NOT EXISTS a2_assignments (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id     UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topics       JSONB NOT NULL DEFAULT '[]'::jsonb,    -- грам.точки/юниты
    note         TEXT,
    done         BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_a2_assign_student ON a2_assignments(student_id, done);

-- Агрегированная статистика ошибок по грам.точкам (для аналитики курса).
CREATE TABLE IF NOT EXISTS a2_error_stats (
    grammar_point TEXT PRIMARY KEY,
    attempts      INTEGER NOT NULL DEFAULT 0,
    errors        INTEGER NOT NULL DEFAULT 0,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
