-- Книги общие, чтение личное.
--
-- Раньше позиция чтения, выбранный язык перевода и набор карточек лежали в
-- самой книге — то есть были общими на всех, кто её откроет. Как только полка
-- становится общей, это ломается: двое читателей затирали бы друг другу место
-- в тексте и складывали слова в один набор. Переносим личное в отдельную
-- таблицу, в книге остаётся только то, что действительно про книгу.

-- Категория для полки: «приключения», «история», «наука»…
-- Определяется моделью при загрузке, владелец может поправить.
ALTER TABLE books ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_books_topic ON books(topic);
CREATE INDEX IF NOT EXISTS idx_books_author ON books(author);

CREATE TABLE IF NOT EXISTS user_book_state (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id         UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    -- На какой язык переводит ИМЕННО этот читатель.
    target_language TEXT NOT NULL DEFAULT 'ru',
    -- Его место в тексте: глава и доля прокрутки внутри неё.
    last_chapter    INT  NOT NULL DEFAULT 0,
    last_offset     REAL NOT NULL DEFAULT 0,
    -- Его личный набор карточек по этой книге.
    set_id          UUID REFERENCES sets(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_user_book_state_user ON user_book_state(user_id, updated_at DESC);

-- Переносим то, что владельцы уже начитали, чтобы никто не потерял место.
INSERT INTO user_book_state (user_id, book_id, target_language, last_chapter, last_offset, set_id)
SELECT owner_id, id, target_language, last_chapter, last_offset, set_id FROM books
ON CONFLICT (user_id, book_id) DO NOTHING;

-- Колонки books.target_language / last_chapter / last_offset / set_id больше не
-- читаются: они остались лишь для того, чтобы старый контейнер не падал в те
-- секунды, пока Railway переключает деплой. Новый код их не трогает.
