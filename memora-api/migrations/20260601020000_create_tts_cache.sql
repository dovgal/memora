-- Кэш TTS для произвольного текста (озвучивание примеров, вопросов, диалогов курса).
-- Ключ = SHA-256 от "voiceId|text". Аудио хранится как BYTEA (mp3 от Inworld).
CREATE TABLE IF NOT EXISTS tts_cache (
    cache_key  TEXT PRIMARY KEY,
    voice_id   TEXT NOT NULL,
    text       TEXT NOT NULL,
    audio_data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
