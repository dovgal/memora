use sqlx::postgres::PgPoolOptions;
use std::env;
use serde_json::Value;
use reqwest::Client;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    println!("--- Recovery Script (Dynamic Voices) ---");

    // Fetch card, its custom data, and the parent set's schema
    let rows: Vec<(uuid::Uuid, String, String, String, String)> = sqlx::query_as(
        "SELECT f.id, f.term, f.definition, f.fields_data::text, s.fields_schema::text 
         FROM flashcards f 
         JOIN sets s ON f.set_id = s.id"
    )
    .fetch_all(&pool)
    .await?;

    let client = Client::new();
    // SECURITY: ключ только из окружения, никаких fallback в коде.
    let auth_header = env::var("INWORLD_AUTH")
        .expect("INWORLD_AUTH must be set");

    for (id, term, definition, data_str, schema_str) in rows {
        let fields_data: Value = serde_json::from_str(&data_str)?;
        let schema: Value = serde_json::from_str(&schema_str)?;
        
        if let Some(obj_map) = fields_data.as_object() {
            let keys: Vec<String> = obj_map.keys().cloned().collect();
            for key in keys {
                // We only care about keys that are markers but missing from binary storage, 
                // OR keys that should have been TTS (ending in _audio) but are missing.
                if obj_map.get(&key).and_then(|v| v.as_str()) == Some("__AUDIO_ON_SERVER__") || key.ends_with("_audio") {
                    let field_to_check = if key.ends_with("_audio") { &key } else { &key }; // Actually always 'key'
                    
                    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM flashcard_audio WHERE flashcard_id = $1 AND field_id = $2)")
                        .bind(id)
                        .bind(field_to_check)
                        .fetch_one(&pool)
                        .await?;

                    if !exists {
                        let clean_field_id = key.trim_end_matches("_audio");
                        println!("Card {} field {} is BROKEN. Attempting recovery...", id, key);
                        
                        // 1. Text to speak
                        let text = if key == "term_audio" {
                            Some(term.clone())
                        } else if key == "definition_audio" {
                            Some(definition.clone())
                        } else {
                            fields_data.get(clean_field_id).and_then(|v| v.as_str()).map(|s| s.to_string())
                        };

                        let text_to_speak = match text {
                            Some(t) => t,
                            None => continue,
                        };

                        // 2. Voice ID from schema
                        let mut voice_id = "Clive".to_string();
                        if let Some(schema_array) = schema.as_array() {
                            if let Some(field_schema) = schema_array.iter().find(|f| f.get("id").and_then(|v| v.as_str()) == Some(clean_field_id)) {
                                if let Some(settings) = field_schema.get("settings").and_then(|v| v.as_object()) {
                                    if let Some(v_id) = settings.get("ttsVoice").and_then(|v| v.as_str()) {
                                        voice_id = v_id.to_string();
                                    } else {
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

                        println!("  Generating TTS: Voice={}, Text='{}'", voice_id, text_to_speak);
                        
                        let res = client.post("https://api.inworld.ai/tts/v1/voice")
                            .header("Authorization", &auth_header)
                            .json(&serde_json::json!({
                                "text": text_to_speak,
                                "voiceId": voice_id,
                                "modelId": "inworld-tts-1.5-max"
                            }))
                            .send()
                            .await?;

                        if res.status().is_success() {
                            let json: Value = res.json().await?;
                            if let Some(base64) = json.get("audioContent").and_then(|v| v.as_str()) {
                                use base64::{Engine as _, engine::general_purpose};
                                if let Ok(bytes) = general_purpose::STANDARD.decode(base64) {
                                    sqlx::query("INSERT INTO flashcard_audio (flashcard_id, field_id, audio_data) VALUES ($1, $2, $3) ON CONFLICT (flashcard_id, field_id) DO UPDATE SET audio_data = $3")
                                        .bind(id)
                                        .bind(&key)
                                        .bind(bytes)
                                        .execute(&pool)
                                        .await?;
                                    println!("  RECOVERED card {} field {}", id, key);
                                }
                            }
                        } else {
                            println!("  FAILED to generate TTS: status={}, body={}", res.status(), res.text().await.unwrap_or_default());
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
