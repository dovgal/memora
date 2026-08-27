-- Адаптация книги под уровень владения языком.
--
-- Исходный текст не трогаем: адаптация складывается рядом, отдельными записями.
-- Так можно переключать уровень туда-обратно, сравнивать с оригиналом и не
-- бояться, что переписывание испортит книгу.
--
-- Глава режется на куски: целая глава романа не помещается ни в один ответ
-- модели, а прокси рвёт связь на тридцати секундах. Куски нарезаются
-- детерминированно по длине, поэтому номер куска и есть ключ кэша.

CREATE TABLE IF NOT EXISTS book_chapter_levels (
    book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position   INT  NOT NULL,
    -- A1.1, A1.2, A2, B1, B2, C1, C2
    level      TEXT NOT NULL,
    -- Порядковый номер куска внутри главы.
    slice      INT  NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (book_id, position, level, slice)
);

CREATE INDEX IF NOT EXISTS idx_book_chapter_levels_lookup
    ON book_chapter_levels(book_id, position, level, slice);

-- Уровень чтения — вещь личная: полка общая, и один читает оригинал, другой
-- то же самое на A2.
ALTER TABLE user_book_state ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT '';
