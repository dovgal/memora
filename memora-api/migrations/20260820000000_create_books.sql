-- Читалка книг с адаптивным переводом (anylang-подобный сервис).
--
-- Текст извлекается на КЛИЕНТЕ (pdf.js/mammoth/JSZip/DOMParser) — тот же приём,
-- что и у source_documents: Rust-образ не тянет парсеры EPUB/PDF.
-- Книга приходит главами пачками: один запрос на всю книгу не проходит через
-- 30-секундный прокси Railway, а вставка по одной строке упирается в тот же
-- лимит уже на 200+ элементах (урок больших наборов карточек).

CREATE TABLE IF NOT EXISTS books (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    author          TEXT NOT NULL DEFAULT '',
    -- ISO 639-1 языка оригинала. Пустая строка — ещё не определён (ждёт ИИ).
    language        TEXT NOT NULL DEFAULT '',
    -- Язык перевода, выбранный при открытии книги: помним между сессиями.
    target_language TEXT NOT NULL DEFAULT 'ru',
    source_format   TEXT NOT NULL DEFAULT 'txt',
    chapter_count   INT  NOT NULL DEFAULT 0,
    word_count      INT  NOT NULL DEFAULT 0,
    -- Набор карточек этой книги: создаётся при первом сохранённом слове.
    set_id          UUID REFERENCES sets(id) ON DELETE SET NULL,
    -- Позиция чтения: номер главы и доля прокрутки внутри неё (0..1).
    last_chapter    INT  NOT NULL DEFAULT 0,
    last_offset     REAL NOT NULL DEFAULT 0,
    -- processing — главы ещё грузятся; ready — можно читать.
    status          TEXT NOT NULL DEFAULT 'processing',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_owner ON books(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS book_chapters (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    position   INT  NOT NULL,
    title      TEXT NOT NULL DEFAULT '',
    content    TEXT NOT NULL,
    word_count INT  NOT NULL DEFAULT 0,
    UNIQUE (book_id, position)
);

CREATE INDEX IF NOT EXISTS idx_book_chapters_book ON book_chapters(book_id, position);

-- Словарь читателя. Ключ — пара (язык, слово), а НЕ книга: слово, выученное
-- в одной книге, должно быть уже знакомым в следующей — ради этого вся затея.
CREATE TABLE IF NOT EXISTS user_vocab (
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    language    TEXT NOT NULL,
    -- Слово в нижнем регистре, как встретилось в тексте (без лемматизации:
    -- морфологию для 30 языков не потянем, а формы всё равно узнаются глазом).
    word        TEXT NOT NULL,
    -- 0 — новое, 1 — учу, 2 — узнаю, 3 — знаю, 4 — игнорировать (имена, числа).
    status      SMALLINT NOT NULL DEFAULT 0,
    translation TEXT NOT NULL DEFAULT '',
    -- Книга, где слово впервые сохранено — для отчёта «слова из этой книги».
    book_id     UUID REFERENCES books(id) ON DELETE SET NULL,
    seen_count  INT NOT NULL DEFAULT 1,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, language, word)
);

CREATE INDEX IF NOT EXISTS idx_user_vocab_book ON user_vocab(book_id) WHERE book_id IS NOT NULL;

-- Кэш переводов: DeepL Free даёт 500 000 символов в месяц, и без кэша одна
-- глава при активном наведении мыши съедает недельную квоту. Ключ — хэш от
-- (провайдер|язык-источник|язык-цель|контекст|текст), общий на всю платформу.
CREATE TABLE IF NOT EXISTS translation_cache (
    hash        TEXT PRIMARY KEY,
    provider    TEXT NOT NULL,
    source_lang TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    source_text TEXT NOT NULL,
    translated  TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_created ON translation_cache(created_at DESC);
