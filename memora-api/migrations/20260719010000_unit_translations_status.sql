-- Асинхронный перевод: статус задачи. 'pending' — генерируется в фоне,
-- 'ready' — готово. Клиент опрашивает эндпоинт до готовности.
ALTER TABLE unit_translations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ready';
