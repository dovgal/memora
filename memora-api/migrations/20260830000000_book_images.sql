-- Картинки из загруженных книг.
--
-- Лежат в базе, как и озвучка карточек: отдельное хранилище ради семейной
-- библиотеки заводить незачем, а приём в проекте уже обкатан.
--
-- Не встраиваем их в текст главы: картинка в виде текста раздувается на треть,
-- а глава с иллюстрациями перестала бы пролезать в ограничение на размер
-- запроса. Здесь они лежат двоичными и отдаются отдельным адресом.
CREATE TABLE IF NOT EXISTS book_images (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id    UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    mime       TEXT NOT NULL,
    bytes      BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_images_book ON book_images(book_id);
