-- Классы v2: универсальные задания (для всего класса или ученика),
-- лента сообщений класса и подписки пользователя на курсы.

-- Задание: либо всему классу (student_id IS NULL), либо конкретному ученику.
-- Может ссылаться на курс/юнит тренажёра (course_id/unit_id) или на набор карточек (set_id).
CREATE TABLE IF NOT EXISTS class_assignments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id    UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    student_id  UUID REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    course_href TEXT,                -- ссылка на материал внутри платформы
    due_date    DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_assignments_class ON class_assignments(class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_class_assignments_student ON class_assignments(student_id);

-- Отметка о выполнении (на ученика, работает и для общеклассных заданий).
CREATE TABLE IF NOT EXISTS class_assignment_done (
    assignment_id UUID NOT NULL REFERENCES class_assignments(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    done_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (assignment_id, user_id)
);

-- Лента сообщений класса (взаимодействие преподавателя и учеников).
CREATE TABLE IF NOT EXISTS class_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id   UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_messages_class ON class_messages(class_id, created_at DESC);

-- Подписки пользователя на курсы (встроенные тренажёры и пользовательские курсы).
CREATE TABLE IF NOT EXISTS user_course_subscriptions (
    user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL,          -- 'edito-a1', 'niveau-b1', UUID кастомного курса...
    title     TEXT NOT NULL,
    href      TEXT NOT NULL,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id)
);
