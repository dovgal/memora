-- Subject Packs, фаза 1: вводим предметный домен курса.
-- Изменение аддитивное и обратносовместимое: существующие строки получают
-- subject = 'language' (язык по-прежнему живёт в custom_courses.language,
-- pack-id собирается как 'language-{language}').
--
-- Предметно-нейтральные таблицы (course_exercise_reviews, course_review_logs,
-- course_exercise_variants, tts_cache) НЕ меняются — они уже ключуются по
-- course_id/unit_id/exercise_id и не зависят от предмета.
ALTER TABLE custom_courses
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'language';
