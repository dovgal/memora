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

    let row = sqlx::query!(
        "SELECT audio_data FROM flashcard_audio WHERE flashcard_id = $1 AND field_id = $2",
        flashcard_uuid,
        field_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        None => {
            // AGGRESSIVE RECOVERY: If audio is missing but ends in _audio, it's TTS. Generate it!
            if field_id.ends_with("_audio") {
                // 1. Fetch the flashcard to get the text
                let card_record = sqlx::query!(
                    "SELECT term, definition FROM flashcards WHERE id = $1",
                    flashcard_uuid
                )
                .fetch_optional(&pool)
                .await
                .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                if let Some(card) = card_record {
                    let text = if field_id == "term_audio" {
                        Some(card.term)
                    } else if field_id == "definition_audio" {
                        Some(card.definition)
                    } else {
                        // Handle custom fields if they exist? For now just term/definition
                        None
                    };

                    if let Some(text_to_speak) = text {
                        if !text_to_speak.trim().is_empty() {
                            println!("DEBUG: Generating TTS on-the-fly for card {} field {}", flashcard_uuid, field_id);
                            
                            let client = Client::new();
                            let auth_header = "Basic SDFtYWl4VHFNVm9xclZhcUw0enB2TnhoYlhmRDJlU3k6VHRSa05maWZhS1lvUEtkWWp3Tk43RG5keldtVDlNc1k1Y2hJZlVUYUFLcXRCNzdmR0FRUzFPNFFZUFphdFJ3NQ==";
                            
                            let res = client.post("https://api.inworld.ai/tts/v1/voice")
                                .header("Authorization", auth_header)
                                .json(&serde_json::json!({
                                    "text": text_to_speak,
                                    "voiceId": "en-US-Wavenet-B",
                                    "modelId": "inworld-tts-1.5-max"
                                }))
                                .send()
                                .await
                                .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("TTS Generation Failed: {}", e)))?;

                            if res.status().is_success() {
                                let json: Value = res.json().await.map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
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
                            } else {
                                let err_status = res.status();
                                let err_text = res.text().await.unwrap_or_default();
                                eprintln!("ERROR: Inworld TTS failed ({}): {}", err_status, err_text);
                            }
                        }
                    }
                }
            }
            
            Err(ApiError::response(StatusCode::NOT_FOUND, "Audio not found"))
        },
    }
}
