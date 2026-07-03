-- Web Push подписки для напоминаний о повторениях.
-- Пуши отправляются БЕЗ payload (текст живёт в service worker) — поэтому
-- шифрование aes128gcm не требуется, а p256dh/auth сохраняются на будущее
-- (если появится шифрованный payload с числом просроченных).
CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint         TEXT PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh           TEXT NOT NULL,
    auth             TEXT NOT NULL,
    tz_offset_min    INT  NOT NULL DEFAULT 0,
    last_reminded_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
