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
            if field_id.ends_with("_audio") {
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
                        _ => return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("Text for field '{}' is empty, cannot generate TTS", field_id))),
                    };

                    // B. Determine Voice ID from schema
                    let mut voice_id = "Clive".to_string(); // Ultimate default
                    
                    if let Some(schema_array) = fields_schema.as_array() {
                        if let Some(field_schema) = schema_array.iter().find(|f| f.get("id").and_then(|v| v.as_str()) == Some(clean_field_id)) {
                            if let Some(settings) = field_schema.get("settings").and_then(|v| v.as_object()) {
                                // Use explicit ttsVoice if available
                                if let Some(v_id) = settings.get("ttsVoice").and_then(|v| v.as_str()) {
                                    voice_id = v_id.to_string();
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
                        }
                    }

                    println!("INFO: Generating TTS on-the-fly: Card={}, Field={}, Voice={}, Text='{}'", 
                        flashcard_uuid, field_id, voice_id, text_to_speak);
                    
                    let client = Client::new();
                    let auth_raw = std::env::var("INWORLD_AUTH").ok();
                    
                    if auth_raw.is_none() {
                        eprintln!("CRITICAL: INWORLD_AUTH is not set! Using fallback.");
                    }

                    let auth_header = auth_raw.unwrap_or_else(|| "Basic SDFtYWl4VHFNVm9xclZhcUw0enB2TnhoYlhmRDJlU3k6VHRSa05maWZhS1lvUEtkWWp3Tk43RG5keldtVDlNc1k1Y2hJZlVUYUFLcXRCNzdmR0FRUzFPNFFZUFphdFJ3NQ==".to_string());
                    
                    let res = client.post("https://api.inworld.ai/tts/v1/voice")
                        .header("Authorization", auth_header)
                        .json(&serde_json::json!({
                            "text": text_to_speak,
                            "voiceId": voice_id,
                            "modelId": "inworld-tts-1.5-max"
                        }))
                        .send()
                        .await
                        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Inworld API Request Failed: {}", e)))?;

                    if res.status().is_success() {
                        let json: Value = res.json().await.map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse Inworld JSON: {}", e)))?;
                        if let Some(base64) = json.get("audioContent").and_then(|v| v.as_str()) {
                            if let Ok(bytes) = general_purpose::STANDARD.decode(base64) {
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
                        }
                        return Err(ApiError::response(StatusCode::BAD_GATEWAY, "Inworld response missing audioContent"));
                    } else {
                        let err_status = res.status();
                        let err_text = res.text().await.unwrap_or_default();
                        eprintln!("ERROR: Inworld TTS failed ({}): {}", err_status, err_text);
                        return Err(ApiError::response(StatusCode::BAD_GATEWAY, format!("Inworld API Error ({}): {}", err_status, err_text)));
                    }
                } else {
                    return Err(ApiError::response(StatusCode::NOT_FOUND, format!("Flashcard {} not found", flashcard_uuid)));
                }
            }
            
            Err(ApiError::response(StatusCode::NOT_FOUND, format!("Audio not found for field '{}'", field_id)))
        },
    }
}
