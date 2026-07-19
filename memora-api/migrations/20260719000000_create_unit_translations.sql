-- Кэш переводов юнитов курса на другой язык интерфейса.
-- Перевод генерируется LLM по запросу и кэшируется; src_hash инвалидирует
-- кэш при изменении исходного юнита. payload хранит переведённые
-- {title, description, vocabulary, exercises} (структура/ids сохранены).
CREATE TABLE IF NOT EXISTS unit_translations (
    unit_id    UUID NOT NULL REFERENCES custom_course_units(id) ON DELETE CASCADE,
    lang       TEXT NOT NULL,
    src_hash   TEXT NOT NULL,
    payload    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (unit_id, lang)
);
