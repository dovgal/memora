-- Настройки человека, а не устройства.
--
-- Язык нужен именно такой: Дамир выбирает французский, и выбор едет за ним на
-- телефон, на Boox и на чужой компьютер. Хранить его в браузере значит
-- выбирать заново на каждом устройстве.
--
-- Таблица «ключ — значение», а не столбец в users: предпочтений в приложении
-- уже с полдюжины (электронные чернила, оформление, размер шрифта), и все они
-- пока живут только в браузере. Со временем переедут сюда без новой миграции.
CREATE TABLE IF NOT EXISTS user_settings (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, key)
);
