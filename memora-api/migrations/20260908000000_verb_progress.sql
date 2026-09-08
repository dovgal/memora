-- Занятия по неправильным глаголам английского.
--
-- Отдельные таблицы, а не общая course_progress: та хранит только ключи —
-- «упражнение пройдено», и места под значение в ней нет. Состояние глагола
-- (ступень, срок, серия, промахи) пришлось бы прятать внутрь ключа, а тогда
-- каждый ответ — это удаление и вставка вместо одного обновления, поиск по
-- образцу вместо обращения по ключу, и потеря записи, если между двумя
-- действиями что-то оборвётся.

CREATE TABLE IF NOT EXISTS verb_progress (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Номер глагола в школьной таблице, 1…125. Он же ключ на бумаге.
    n          SMALLINT NOT NULL,
    -- Ступень лесенки повторений.
    step       SMALLINT NOT NULL DEFAULT 0,
    -- Когда спросить снова.
    due        DATE NOT NULL,
    streak     INTEGER NOT NULL DEFAULT 0,
    misses     INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, n)
);

-- Заданная учителем партия: «с 1 по 20». У человека она одна.
CREATE TABLE IF NOT EXISTS verb_assignment (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    range_from SMALLINT NOT NULL,
    range_to   SMALLINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
