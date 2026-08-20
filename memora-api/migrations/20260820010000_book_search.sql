-- Полнотекстовый поиск по книге: найти, где встречалось слово или фраза.
--
-- Конфигурация 'simple' (без стемминга) намеренно: книги на любом языке, а
-- выбрать словарь под каждый Postgres не даст — 'simple' работает везде и
-- ищет по точным словоформам, чего для «найти это место в книге» достаточно.
ALTER TABLE book_chapters
    ADD COLUMN IF NOT EXISTS tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('simple', left(content, 200000))) STORED;

CREATE INDEX IF NOT EXISTS idx_book_chapters_tsv ON book_chapters USING GIN(tsv);
