-- Универсальная геймификация: XP за повторения в коуче ЛЮБОГО курса.
-- Начисляется сервером в record_coach_review (клиенту не доверяем).
-- a2_xp остаётся как есть — legacy-поток A2-тренажёра; семейное табло
-- показывает сумму обоих.
CREATE TABLE IF NOT EXISTS user_xp (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp          INTEGER NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
