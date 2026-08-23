use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;
use super::errors::ApiError;
use reqwest::Client;
use serde_json::Value;
use base64::{Engine as _, engine::general_purpose};

pub async fn get_flashcard_audio(
    State(pool): State<PgPool>,
    optional_user: crate::middleware::auth::OptionalAuthenticatedUser,
    Path((flashcard_id_str, field_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    let flashcard_uuid = Uuid::parse_str(&flashcard_id_str)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid flashcard ID format"))?;

    use sqlx::Row;
    let row = sqlx::query(
        "SELECT audio_data FROM flashcard_audio WHERE flashcard_id = $1 AND field_id = $2"
    )
    .bind(flashcard_uuid)
    .bind(&field_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    match row {
        Some(record) => {
            let audio_bytes: Vec<u8> = record.get("audio_data");
            Ok((
                [(header::CONTENT_TYPE, "audio/mpeg"), (header::CACHE_CONTROL, "public, max-age=31536000")],
                audio_bytes,
            ))
        },
        None => {
            // AGGRESSIVE RECOVERY: If audio is missing but ends in _audio, it's TTS. Generate it!
            // On-the-fly generation costs money (Inworld API), so it requires authentication.
            if field_id.ends_with("_audio") && optional_user.0.is_some() {
                // 1. Fetch the flashcard text and set schema to know WHAT to speak and with WHICH VOICE
                let combined_record = sqlx::query(
                    r#"
                    SELECT f.term, f.definition, f.fields_data, s.fields_schema 
                    FROM flashcards f 
                    JOIN sets s ON f.set_id = s.id 
                    WHERE f.id = $1
                    "#
                )
                .bind(flashcard_uuid)
                .fetch_optional(&pool)
                .await
                .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                if let Some(record) = combined_record {
                    let clean_field_id = field_id.trim_end_matches("_audio");
                    
                    let term: String = record.get("term");
                    let definition: String = record.get("definition");
                    let fields_data: Value = record.get("fields_data");
                    let fields_schema: Value = record.get("fields_schema");

                    // A. Extract Text to Speak
                    let text = if field_id == "term_audio" {
                        Some(term)
                    } else if field_id == "definition_audio" {
                        Some(definition)
                    } else {
                        // Extract from fields_data JSON for custom fields
                        fields_data.get(clean_field_id).and_then(|v| v.as_str()).map(|s| s.to_string())
                    };

                    let text_to_speak = match text {
                        Some(t) if !t.trim().is_empty() => t,
                        _ => return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("Text for field '{field_id}' is empty, cannot generate TTS"))),
                    };

                    // B. Determine Voice ID from schema
                    let mut voice_id = "Clive".to_string(); // Ultimate default
                    
                    if let Some(schema_array) = fields_schema.as_array()
                        && let Some(field_schema) = schema_array.iter().find(|f| f.get("id").and_then(|v| v.as_str()) == Some(clean_field_id))
                            && let Some(settings) = field_schema.get("settings").and_then(|v| v.as_object()) {
                                // Use explicit ttsVoice if available
                                if let Some(v_id) = settings.get("ttsVoice").and_then(|v| v.as_str()) {
                                    let mapped_voice = match v_id {
                                        "Nolan" => "Carter",
                                        "Abby" => "Aria",
                                        _ => v_id
                                    };
                                    voice_id = mapped_voice.to_string();
                                } else {
                                    // Fallback to language defaults
                                    let lang = settings.get("language").and_then(|v| v.as_str()).unwrap_or("en");
                                    voice_id = match lang {
                                        "ru" => "Tatiana",
                                        "fr" => "Alain",
                                        "de" => "Josef",
                                        "es" => "Carmen",
                                        _ => "Clive"
                                    }.to_string();
                                }
                            }

                    println!("INFO: Generating TTS on-the-fly: Card={flashcard_uuid}, Field={field_id}, Voice={voice_id}, Text='{text_to_speak}'");
                    
                    let client = Client::new();
                    // SECURITY: never hardcode credentials. INWORLD_AUTH must come from the environment.
                    let auth_header = std::env::var("INWORLD_AUTH")
                        .map_err(|_| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, "INWORLD_AUTH not configured"))?;
                    
                    let res = client.post("https://api.inworld.ai/tts/v1/voice")
                        .header("Authorization", auth_header)
                        .json(&serde_json::json!({
                            "text": text_to_speak,
                            "voiceId": voice_id,
                            "modelId": "inworld-tts-1.5-max"
                        }))
                        .send()
                        .await
                        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Inworld API Request Failed: {e}")))?;

                    if res.status().is_success() {
                        let json: Value = res.json().await.map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse Inworld JSON: {e}")))?;
                        if let Some(base64) = json.get("audioContent").and_then(|v| v.as_str())
                            && let Ok(bytes) = general_purpose::STANDARD.decode(base64) {
                                // Save it for future requests
                                let _ = sqlx::query(
                                    "INSERT INTO flashcard_audio (flashcard_id, field_id, audio_data) 
                                     VALUES ($1, $2, $3) 
                                     ON CONFLICT (flashcard_id, field_id) DO UPDATE SET audio_data = $3"
                                )
                                .bind(flashcard_uuid)
                                .bind(&field_id)
                                .bind(&bytes)
                                .execute(&pool)
                                .await;

                                return Ok((
                                    [(header::CONTENT_TYPE, "audio/mpeg"), (header::CACHE_CONTROL, "public, max-age=31536000")],
                                    bytes,
                                ));
                            }
                        return Err(ApiError::response(StatusCode::BAD_GATEWAY, "Inworld response missing audioContent"));
                    } else {
                        let err_status = res.status();
                        let err_text = res.text().await.unwrap_or_default();
                        eprintln!("ERROR: Inworld TTS failed ({err_status}): {err_text}");
                        return Err(ApiError::response(StatusCode::BAD_GATEWAY, format!("Inworld API Error ({err_status}): {err_text}")));
                    }
                } else {
                    return Err(ApiError::response(StatusCode::NOT_FOUND, format!("Flashcard {flashcard_uuid} not found")));
                }
            }
            
            Err(ApiError::response(StatusCode::NOT_FOUND, format!("Audio not found for field '{field_id}'")))
        },
    }
}

use axum::extract::Query;
use serde::Deserialize;

#[derive(Deserialize)]
pub struct SynthesizeParams {
    pub text: String,
    pub voice: Option<String>,
    /// Язык курса (код 'fr'/'en'/… или название) — выбирает голос через предметный пак,
    /// если явный `voice` не передан.
    pub language: Option<String>,
    /// Предметный домен курса ('language' по умолчанию).
    pub subject: Option<String>,
}

/// GET /api/tts?text=...&voice=Alain (или ...&language=en — голос из предметного пака)
/// Озвучивание ПРОИЗВОЛЬНОГО текста ТОЛЬКО через Inworld.ai (с кэшем в БД).
/// Используется тестами/упражнениями курса, где нет карточки в БД.
/// Требует авторизации: Inworld — платный API, нельзя оставлять открытым.
#[derive(serde::Deserialize)]
pub struct TranscribeParams {
    /// Код языка для распознавания: fr, en, ru…
    #[serde(default)]
    pub language: Option<String>,
}

/// POST /api/audio/transcribe — распознать запись ученика на своём сервисе.
///
/// Нужен потому, что браузерный Web Speech API не позволяет выбрать микрофон:
/// он всегда слушает вход по умолчанию, и при Bluetooth-гарнитуре голос
/// приходит в узкой полосе, а оценки произношения выходят ниже реальных.
/// Здесь распознаётся та запись, которую страница сделала сама, с выбранного
/// нами устройства.
///
/// Тело запроса — сам аудиофайл; парсить multipart незачем, MediaRecorder
/// отдаёт один blob.
pub async fn transcribe_audio(
    _user: crate::middleware::auth::AuthenticatedUser,
    Query(params): Query<TranscribeParams>,
    body: axum::body::Bytes,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let base = std::env::var("WHISPER_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| ApiError::response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Серверное распознавание не настроено",
        ))?;

    if body.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Empty audio"));
    }
    if body.len() > 12 * 1024 * 1024 {
        return Err(ApiError::response(StatusCode::PAYLOAD_TOO_LARGE, "Audio too large"));
    }

    let language = params.language.unwrap_or_else(|| "fr".to_string());
    let language: String = language.chars().take(5).filter(|c| c.is_ascii_alphanumeric() || *c == '-').collect();

    // Таймаут больше обычного: на процессоре распознавание пятисекундной
    // реплики занимает единицы секунд, и обрывать его на середине нет смысла.
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("client: {e}")))?;

    let mut req = client
        .post(format!("{}/transcribe?language={language}", base.trim_end_matches('/')))
        .header("Content-Type", "application/octet-stream")
        .body(body.to_vec());

    if let Ok(token) = std::env::var("WHISPER_TOKEN") {
        if !token.trim().is_empty() {
            req = req.header("Authorization", format!("Bearer {}", token.trim()));
        }
    }

    let res = req.send().await.map_err(|e| {
        ApiError::response(StatusCode::BAD_GATEWAY, format!("Сервис распознавания недоступен: {e}"))
    })?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        eprintln!("[transcribe] whisper responded {status}: {}", text.chars().take(200).collect::<String>());
        return Err(ApiError::response(StatusCode::BAD_GATEWAY, format!("Сервис распознавания ответил {status}")));
    }

    let value: Value = serde_json::from_str(&text)
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Неразборный ответ распознавания: {e}")))?;

    Ok((StatusCode::OK, Json(value)))
}

pub async fn synthesize_tts(
    State(pool): State<PgPool>,
    _user: crate::middleware::auth::AuthenticatedUser,
    Query(params): Query<SynthesizeParams>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let text = params.text.trim().to_string();
    if text.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Empty text"));
    }
    if text.chars().count() > 600 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Text too long"));
    }
    // Голос: явный параметр > голос предметного пака (по subject/language) > FR-пак ('Alain').
    let voice_id = params.voice.unwrap_or_else(|| {
        let subject = params.subject.as_deref().unwrap_or("language");
        let lang = params.language.as_deref().and_then(crate::subjects::normalize_language);
        crate::subjects::pack_for(subject, lang).tts_voice.default.to_string()
    });

    // Ключ кэша = sha256("voice|text")
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(format!("{voice_id}|{text}").as_bytes());
    // sha2 0.11: finalize() -> Array<u8, _>, у которого нет LowerHex.
    // Собираем hex вручную — тот же lowercase-формат, что давал прежний {:x}
    // (иначе ключи tts_cache перестали бы совпадать).
    let cache_key: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();

    // 1. Пытаемся отдать из кэша
    use sqlx::Row;
    if let Ok(Some(row)) = sqlx::query("SELECT audio_data FROM tts_cache WHERE cache_key = $1")
        .bind(&cache_key)
        .fetch_optional(&pool)
        .await
    {
        let bytes: Vec<u8> = row.get("audio_data");
        return Ok((
            [(header::CONTENT_TYPE, "audio/mpeg"), (header::CACHE_CONTROL, "public, max-age=31536000")],
            bytes,
        ));
    }

    // 2. Генерируем через Inworld
    let client = Client::new();
    let auth_header = std::env::var("INWORLD_AUTH")
        .map_err(|_| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, "INWORLD_AUTH not configured"))?;

    let res = client.post("https://api.inworld.ai/tts/v1/voice")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "text": text,
            "voiceId": voice_id,
            "modelId": "inworld-tts-1.5-max"
        }))
        .send()
        .await
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Inworld API Request Failed: {e}")))?;

    if !res.status().is_success() {
        let st = res.status();
        let body = res.text().await.unwrap_or_default();
        eprintln!("ERROR: Inworld TTS failed ({st}): {body}");
        return Err(ApiError::response(StatusCode::BAD_GATEWAY, format!("Inworld API Error ({st}): {body}")));
    }

    let json: Value = res.json().await
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse Inworld JSON: {e}")))?;
    let base64 = json.get("audioContent").and_then(|v| v.as_str())
        .ok_or_else(|| ApiError::response(StatusCode::BAD_GATEWAY, "Inworld response missing audioContent"))?;
    let bytes = general_purpose::STANDARD.decode(base64)
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("base64 decode: {e}")))?;

    // 3. Кэшируем
    let _ = sqlx::query(
        "INSERT INTO tts_cache (cache_key, voice_id, text, audio_data) VALUES ($1, $2, $3, $4)
         ON CONFLICT (cache_key) DO NOTHING"
    )
    .bind(&cache_key)
    .bind(&voice_id)
    .bind(&text)
    .bind(&bytes)
    .execute(&pool)
    .await;

    Ok((
        [(header::CONTENT_TYPE, "audio/mpeg"), (header::CACHE_CONTROL, "public, max-age=31536000")],
        bytes,
    ))
}

/// Голос для поля из его settings: явный ttsVoice (с историческим маппингом
/// снятых голосов) → иначе дефолт по языку. Совпадает с логикой recovery в
/// get_flashcard_audio, чтобы предгенерация и генерация «на лету» звучали одинаково.
fn resolve_tts_voice(settings: &serde_json::Map<String, Value>) -> String {
    if let Some(v_id) = settings.get("ttsVoice").and_then(|v| v.as_str()) {
        return match v_id {
            "Nolan" => "Carter",
            "Abby" => "Aria",
            other => other,
        }.to_string();
    }
    let lang = settings.get("language").and_then(|v| v.as_str()).unwrap_or("en");
    match lang {
        "ru" => "Tatiana",
        "fr" => "Alain",
        "de" => "Josef",
        "es" => "Carmen",
        _ => "Clive",
    }.to_string()
}

/// Синтез TTS с использованием кэша tts_cache: сначала ищем по ключу
/// sha256("voice|text"), при промахе — зовём Inworld и кладём в кэш. Возвращает
/// mp3-байты. Тот же ключ и формат, что в synthesize_tts (иначе кэш разъедется).
pub async fn get_or_synthesize_tts(pool: &PgPool, voice_id: &str, text: &str) -> Result<Vec<u8>, String> {
    let text = text.trim();
    if text.is_empty() {
        return Err("empty text".to_string());
    }
    if text.chars().count() > 600 {
        return Err("text too long".to_string());
    }

    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(format!("{voice_id}|{text}").as_bytes());
    let cache_key: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();

    use sqlx::Row;
    if let Ok(Some(row)) = sqlx::query("SELECT audio_data FROM tts_cache WHERE cache_key = $1")
        .bind(&cache_key)
        .fetch_optional(pool)
        .await
    {
        return Ok(row.get("audio_data"));
    }

    let client = Client::new();
    let auth_header = std::env::var("INWORLD_AUTH").map_err(|_| "INWORLD_AUTH not configured".to_string())?;
    let res = client.post("https://api.inworld.ai/tts/v1/voice")
        .header("Authorization", auth_header)
        .json(&serde_json::json!({
            "text": text,
            "voiceId": voice_id,
            "modelId": "inworld-tts-1.5-max"
        }))
        .send()
        .await
        .map_err(|e| format!("Inworld request failed: {e}"))?;

    if !res.status().is_success() {
        let st = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("Inworld error ({st}): {body}"));
    }

    let json: Value = res.json().await.map_err(|e| format!("parse Inworld JSON: {e}"))?;
    let base64 = json.get("audioContent").and_then(|v| v.as_str())
        .ok_or_else(|| "Inworld response missing audioContent".to_string())?;
    let bytes = general_purpose::STANDARD.decode(base64).map_err(|e| format!("base64 decode: {e}"))?;

    let _ = sqlx::query(
        "INSERT INTO tts_cache (cache_key, voice_id, text, audio_data) VALUES ($1, $2, $3, $4)
         ON CONFLICT (cache_key) DO NOTHING"
    )
    .bind(&cache_key)
    .bind(voice_id)
    .bind(text)
    .bind(&bytes)
    .execute(pool)
    .await;

    Ok(bytes)
}

/// Фоновая предгенерация озвучки для всех текстовых полей набора с ttsEnabled.
/// Запускается ПОСЛЕ коммита сохранения (tokio::spawn), не блокируя ответ —
/// иначе набор из сотен карточек упёрся бы в 30-секундный таймаут прокси.
/// Идемпотентна: перезаписывает flashcard_audio, а неизменный текст берётся из
/// tts_cache без обращения к Inworld (поэтому дешева и на повторных сохранениях,
/// и корректно обновляет звук, если текст карточки изменился).
pub async fn pregenerate_set_tts(pool: PgPool, set_id: Uuid) {
    use sqlx::Row;

    let schema_row = match sqlx::query("SELECT fields_schema FROM sets WHERE id = $1")
        .bind(set_id)
        .fetch_optional(&pool)
        .await
    {
        Ok(Some(r)) => r,
        _ => return,
    };
    let fields_schema: Value = schema_row.get("fields_schema");
    let schema = match fields_schema.as_array() {
        Some(a) => a,
        None => return,
    };

    // Текстовые поля с озвучкой: (field_id, voice_id).
    let mut tts_fields: Vec<(String, String)> = Vec::new();
    for f in schema {
        let is_text = f.get("type").and_then(|v| v.as_str()) == Some("text");
        let settings = f.get("settings").and_then(|v| v.as_object());
        let enabled = settings.and_then(|s| s.get("ttsEnabled")).and_then(|v| v.as_bool()) == Some(true);
        if is_text && enabled
            && let (Some(id), Some(s)) = (f.get("id").and_then(|v| v.as_str()), settings) {
                tts_fields.push((id.to_string(), resolve_tts_voice(s)));
            }
    }
    if tts_fields.is_empty() {
        return;
    }

    let cards = match sqlx::query("SELECT id, term, definition, fields_data FROM flashcards WHERE set_id = $1")
        .bind(set_id)
        .fetch_all(&pool)
        .await
    {
        Ok(c) => c,
        Err(e) => { eprintln!("pregen TTS: load cards failed for set {set_id}: {e}"); return; }
    };

    let mut ok = 0u32;
    let mut failed = 0u32;
    for card in &cards {
        let card_id: Uuid = card.get("id");
        let term: String = card.get("term");
        let definition: String = card.get("definition");
        let fields_data: Value = card.get("fields_data");

        for (fid, voice) in &tts_fields {
            let text = if fid == "term" {
                term.clone()
            } else if fid == "definition" {
                definition.clone()
            } else {
                fields_data.get(fid).and_then(|v| v.as_str()).unwrap_or("").to_string()
            };
            if text.trim().is_empty() {
                continue;
            }
            let audio_field = format!("{fid}_audio");
            match get_or_synthesize_tts(&pool, voice, &text).await {
                Ok(bytes) => {
                    let _ = sqlx::query(
                        "INSERT INTO flashcard_audio (flashcard_id, field_id, audio_data) VALUES ($1, $2, $3)
                         ON CONFLICT (flashcard_id, field_id) DO UPDATE SET audio_data = $3"
                    )
                    .bind(card_id)
                    .bind(&audio_field)
                    .bind(&bytes)
                    .execute(&pool)
                    .await;
                    ok += 1;
                }
                Err(e) => {
                    failed += 1;
                    eprintln!("pregen TTS failed card={card_id} field={audio_field}: {e}");
                }
            }
        }
    }
    println!("INFO: TTS pre-generation done for set {set_id}: {ok} ok, {failed} failed");
}

#[cfg(test)]
mod tests {
    use sha2::{Digest, Sha256};

    /// Ключ TTS-кэша под sha2 0.11 должен давать ТОТ ЖЕ lowercase-hex, что и прежний
    /// format!("{:x}", finalize) под 0.10 — иначе существующие записи tts_cache
    /// перестанут находиться. Эталон — hashlib.sha256("Alain|Bonjour").
    #[test]
    fn cache_key_hex_matches_reference() {
        let mut hasher = Sha256::new();
        hasher.update("Alain|Bonjour".as_bytes());
        let key: String = hasher.finalize().iter().map(|b| format!("{b:02x}")).collect();
        // gitleaks:allow — это эталонный sha256 «Alain|Bonjour», а не секрет.
        assert_eq!(key, "76825d5d77ca8a729d171c23eedeab8c6e5024e7caf473df0317e3481dca0962"); // gitleaks:allow
        assert_eq!(key.len(), 64); // 32 байта × 2 hex-символа
    }
}
