-- Фоновая прегенерация вариантов: понятие «запаса».
-- used_at = NULL  → вариант сгенерирован впрок и ещё не показан (запас);
-- used_at != NULL → вариант уже отдан учащемуся.
--
-- Существующие строки создавались только по живому запросу и показывались сразу,
-- поэтому бэкфиллим used_at = created_at — они не должны считаться запасом.

ALTER TABLE course_exercise_variants
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

UPDATE course_exercise_variants SET used_at = created_at WHERE used_at IS NULL;

-- Быстрая проверка «есть ли запас у этого правила» (воркер и отдача из кэша).
CREATE INDEX IF NOT EXISTS idx_variants_unused
    ON course_exercise_variants (user_id, course_id, unit_id, exercise_id)
    WHERE used_at IS NULL AND flagged = FALSE;
