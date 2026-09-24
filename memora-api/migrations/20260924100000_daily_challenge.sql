-- «Разговор дня»: пятиминутный разговорный вызов раз в сутки.
--
-- Сам каталог и выбор «разговора на сегодня» — в коде (handlers/challenge*.rs):
-- выбор детерминирован по (пользователь, дата), хранить его не нужно. Здесь
-- только факт выполнения. Первичный ключ (user_id, challenge_date) и есть
-- правило «не больше одного засчитанного разговора в день» — повторная
-- отправка (двойной тап, второе устройство) упирается в него, а не в код.
-- Дата — календарная по Europe/Paris, как у серии дней в игровом слое.
CREATE TABLE IF NOT EXISTS user_daily_challenges (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_date DATE NOT NULL,
    challenge_id   TEXT NOT NULL,
    turns          INTEGER NOT NULL,
    minutes        DOUBLE PRECISION NOT NULL,
    completed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, challenge_date)
);

-- Счётчики для достижений «Разговорчивый» (7 разговоров) и «Неделя
-- разговоров» (7 дней подряд). Серия разговоров своя, отдельно от общей
-- серии: общую держит любое занятие, эта — только разговоры.
ALTER TABLE user_game_counters
    ADD COLUMN IF NOT EXISTS challenges_completed INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS challenge_streak     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_challenge_date  DATE;
