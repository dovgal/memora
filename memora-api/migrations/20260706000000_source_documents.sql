-- Ингест учебников («курс из PDF»): исходные материалы владельца, порезанные
-- на главы/фрагменты. Текст извлекается на КЛИЕНТЕ (pdf.js) — Rust-образ не
-- раздуваем (тот же урок, что с whisper-rs).
--
-- Поиск v1 — полнотекстовый Postgres (tsvector, конфиг 'french' — корпус
-- франкоязычный). Семантический поиск (pgvector + эмбеддинги) — follow-up,
-- когда выберем провайдера эмбеддингов; схема расширяется колонкой embedding.

CREATE TABLE IF NOT EXISTS source_documents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    language    TEXT NOT NULL DEFAULT 'fr',
    chunk_count INT  NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_documents_owner
    ON source_documents(owner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS source_chunks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
    position    INT  NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL,
    -- Полнотекстовый индекс по содержимому (лимит на объём — safety для генерируемой колонки).
    tsv tsvector GENERATED ALWAYS AS (to_tsvector('french', left(content, 100000))) STORED
);

CREATE INDEX IF NOT EXISTS idx_source_chunks_doc ON source_chunks(document_id, position);
CREATE INDEX IF NOT EXISTS idx_source_chunks_tsv ON source_chunks USING GIN(tsv);
