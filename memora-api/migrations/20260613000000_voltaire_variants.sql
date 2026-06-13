-- Voltaire-метод: слой «правило → варианты».
-- Цель: при повторе упражнения (FSRS) показывать НОВОЕ предложение того же правила,
-- сгенерированное LLM, а не тот же заученный текст. Планирование остаётся на правиле
-- (course_exercise_reviews.exercise_id), эту таблицу НЕ трогаем.
--
-- Эта таблица — НЕ предзагруженный пул, а: (а) память анти-повтора (не показывать
-- одно и то же предложение подряд), (б) фолбэк при недоступности Ollama / невалидном
-- ответе, (в) журнал для модерации и кнопки «пожаловаться на вопрос».

CREATE TABLE IF NOT EXISTS course_exercise_variants (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID        NOT NULL,
    course_id    TEXT        NOT NULL,           -- встроенный (строка) или пользовательский (UUID-текст) курс
    unit_id      TEXT        NOT NULL,
    exercise_id  TEXT        NOT NULL,           -- = стабильный ключ ПРАВИЛА (как в course_exercise_reviews)
    rule_key     TEXT,                           -- опц. явный skill/rule (напр. 'verb-government')
    format       TEXT        NOT NULL DEFAULT 'error-hunt',
    payload      JSONB       NOT NULL,           -- сгенерированный EditoExercise-вариант (в формате курса)
    sentence     TEXT,                           -- нормализованный текст предложения — для анти-повтора/поиска
    source       TEXT        NOT NULL DEFAULT 'ollama',  -- 'ollama' | 'fallback' | 'seed'
    flagged      BOOLEAN     NOT NULL DEFAULT FALSE,      -- пользователь пожаловался на качество
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Быстрый поиск последних вариантов конкретного правила у конкретного пользователя
-- (анти-повтор + фолбэк): «дай последние N предложений для этого exercise_id».
CREATE INDEX IF NOT EXISTS idx_variants_lookup
    ON course_exercise_variants (user_id, course_id, unit_id, exercise_id, created_at DESC);

-- Журнал жалоб для модерации контента.
CREATE INDEX IF NOT EXISTS idx_variants_flagged
    ON course_exercise_variants (flagged)
    WHERE flagged = TRUE;
