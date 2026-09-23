-- Игровой слой: XP, уровни, ежедневная серия с заморозками, дневная цель,
-- достижения. Отдельная от старых user_xp/a2_xp таблиц система — та копится
-- по каждому повторению в коуче и в лидерборде A2, эта считается сервером
-- из событий тренажёров (POST /api/game/event) с антифродом и разбором
-- достижений. Семья — весь приватный инстанс (см. handlers/family.rs).

-- Текущее состояние игрока: XP, уровень, серия, заморозки, дневная цель.
-- Поля minute_bucket/minute_xp — счётчик для антифрод-лимита «не больше N XP
-- в минуту», сбрасывается сам при следующем событии вне окна.
CREATE TABLE IF NOT EXISTS user_game_stats (
    user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp                BIGINT NOT NULL DEFAULT 0,
    level             INTEGER NOT NULL DEFAULT 1,
    streak_days       INTEGER NOT NULL DEFAULT 0,
    longest_streak    INTEGER NOT NULL DEFAULT 0,
    freezes           INTEGER NOT NULL DEFAULT 0,
    last_active_date  DATE,
    daily_goal        INTEGER NOT NULL DEFAULT 50,
    daily_xp          INTEGER NOT NULL DEFAULT 0,
    daily_date        DATE,
    minute_bucket     TIMESTAMPTZ,
    minute_xp         INTEGER NOT NULL DEFAULT 0,
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Счётчики для разблокировки достижений — то, что не выводится из xp/streak
-- напрямую (сколько раз что случилось за всё время).
CREATE TABLE IF NOT EXISTS user_game_counters (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_correct       INTEGER NOT NULL DEFAULT 0,
    total_sessions      INTEGER NOT NULL DEFAULT 0,
    perfect_sessions    INTEGER NOT NULL DEFAULT 0,
    good_pronunciations INTEGER NOT NULL DEFAULT 0,
    sentences_built     INTEGER NOT NULL DEFAULT 0,
    daily_goal_streak   INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Разблокированные достижения. Каталог (титулы/описания/эмодзи) живёт в коде
-- (handlers/game.rs) — тут только факт и момент разблокировки.
CREATE TABLE IF NOT EXISTS user_achievements (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- Журнал начислений XP — нужен только для «XP за неделю» на семейном табло
-- (сумма user_game_stats недостаточно: там лежит только XP за всё время).
CREATE TABLE IF NOT EXISTS user_game_xp_log (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    xp_delta   INTEGER NOT NULL,
    source     TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_game_xp_log_user_time ON user_game_xp_log (user_id, created_at DESC);
