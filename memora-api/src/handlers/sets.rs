use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose, Engine};
use sqlx::{PgPool, Row};

use uuid::Uuid;

use crate::domain::dtos::{
    CreateSetRequest, FlashcardResponse, SetResponse, SetSummaryResponse, UpdateSetRequest
};
use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

pub async fn get_public_set(
    State(pool): State<PgPool>,
    optional_user: crate::middleware::auth::OptionalAuthenticatedUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID format"))?;

    // 1. Fetch the set, allowing either public or private sets to be fetched initially
    let set_record = sqlx::query(
        "SELECT id, title, description, is_public, creator_id, fields_schema FROM sets WHERE id = $1"
    )
    .bind(set_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let set_record = match set_record {
        Some(row) => {
            let id: Uuid = row.get("id");
            let title: String = row.get("title");
            let description: Option<String> = row.get("description");
            let is_public: bool = row.get("is_public");
            let creator_id: Uuid = row.get("creator_id");
            let fields_schema: serde_json::Value = row.get("fields_schema");
            
            // Re-wrap into a struct-like object for compatibility with downstream logic
            serde_json::json!({
                "id": id,
                "title": title,
                "description": description,
                "is_public": is_public,
                "creator_id": creator_id,
                "fields_schema": fields_schema
            })
        },
        None => return Err(ApiError::response(StatusCode::NOT_FOUND, "Set not found")),
    };

    // 1.5 UUIDs act as secure capabilities for viewing. If a user shares the direct link 
    // to their set, it can be viewed without registration regardless of the is_public flag.
    let _requesting_user_id = optional_user.0.and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let _creator_id_uuid: Uuid = Uuid::parse_str(set_record.get("creator_id").and_then(|v| v.as_str()).unwrap_or_default()).unwrap_or_default();
    let _is_owner = _requesting_user_id.is_some() && Some(_creator_id_uuid) == _requesting_user_id;
    // We intentionally skip throwing a 404 here to allow unauthenticated sharing via link.

    // 2. Fetch the flashcards for this set, ordered appropriately
    let flashcards_records = sqlx::query(
        "SELECT id, term, definition, image_url, order_index, fields_data FROM flashcards WHERE set_id = $1 ORDER BY order_index ASC"
    )
    .bind(set_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut flashcards = Vec::new();

    // Identify all fields that should have audio based on the schema
    let mut audio_field_ids = Vec::new();
    let fields_schema = set_record.get("fields_schema");
    if let Some(schema_array) = fields_schema.and_then(|v| v.as_array()) {
        for field in schema_array {
            if let Some(field_obj) = field.as_object() {
                let is_audio_type = field_obj.get("type").and_then(|v| v.as_str()) == Some("audio");
                let is_tts_enabled = field_obj.get("settings").and_then(|v| v.as_object()).and_then(|s| s.get("ttsEnabled")).and_then(|v| v.as_bool()) == Some(true);
                
                if let Some(id) = field_obj.get("id").and_then(|v| v.as_str()) {
                    if is_audio_type {
                        audio_field_ids.push(id.to_string());
                    }
                    if is_tts_enabled {
                        audio_field_ids.push(format!("{}_audio", id));
                    }
                }
            }
        }
    }

    for record in flashcards_records {
        let record_id: Uuid = record.get("id");
        let mut fields_data: serde_json::Value = record.get("fields_data");
        let mut modified_in_db = false;

        if let Some(obj) = fields_data.as_object_mut() {
            // Collect keys first to avoid concurrent borrow issues
            let keys: Vec<String> = obj.keys().cloned().collect();
            
            for field_id in keys {
                if let Some(value) = obj.get(&field_id) {
                    if let Some(val_str) = value.as_str() {
                        // SELF-HEALING: If it's a base64 string, migrate it to binary storage
                        if val_str.starts_with("data:audio/") {
                            let clean_base64 = if let Some(pos) = val_str.find("base64,") {
                                &val_str[pos + 7..]
                            } else {
                                val_str
                            };

                            if let Ok(audio_bytes) = general_purpose::STANDARD.decode(clean_base64) {
                                // Save to binary table
                                if let Err(e) = sqlx::query(
                                    "INSERT INTO flashcard_audio (flashcard_id, field_id, audio_data) 
                                     VALUES ($1, $2, $3) 
                                     ON CONFLICT (flashcard_id, field_id) DO UPDATE SET audio_data = $3"
                                )
                                .bind(record_id)
                                .bind(&field_id)
                                .bind(audio_bytes)
                                .execute(&pool)
                                .await {
                                    eprintln!("Failed to migrate audio for card {} field {}: {}", record_id, field_id, e);
                                } else {
                                    modified_in_db = true;
                                }
                            }
                        }
                        
                        // If it's a base64 string OR already a marker, ensure we return the marker to the client
                        if val_str.starts_with("data:audio/") || val_str == "__AUDIO_ON_SERVER__" {
                             obj.insert(field_id.clone(), serde_json::json!("__AUDIO_ON_SERVER__"));
                        }
                    }
                }
            }
        }

        if modified_in_db {
            // Update the record in background to remove heavy base64 from JSON
            let _ = sqlx::query("UPDATE flashcards SET fields_data = $1 WHERE id = $2")
                .bind(&fields_data)
                .bind(record_id)
                .execute(&pool)
                .await;
        }

        flashcards.push(FlashcardResponse {
            id: record_id.to_string(),
            term: record.get("term"),
            definition: record.get("definition"),
            image_url: record.get("image_url"),
            order_index: record.get("order_index"),
            fields_data,
        });
    }


    let response = SetResponse {
        id: set_record.get("id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        title: set_record.get("title").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        description: set_record.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
        creator_id: set_record.get("creator_id").and_then(|v| v.as_str()).unwrap_or_default().to_string(),
        fields_schema: set_record.get("fields_schema").cloned().unwrap_or(serde_json::Value::Null),
        flashcards,
    };

    Ok((StatusCode::OK, Json(response)))
}

pub async fn create_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreateSetRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    if payload.flashcards.len() < 2 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "A set must contain at least 2 flashcards."));
    }

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;

    // Begin the transaction
    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // 1. Insert the parent Set
    let set_record = sqlx::query(
        "INSERT INTO sets (creator_id, title, description, is_public, fields_schema) VALUES ($1, $2, $3, $4, $5) RETURNING id"
    )
    .bind(creator_id)
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.is_public)
    .bind(&payload.fields_schema)
    .fetch_one(&mut *tx)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let new_set_id: Uuid = set_record.get("id");

    // 2. Insert the Flashcards iteratively
    let mut response_flashcards = Vec::new();
    
    for (index, card) in payload.flashcards.into_iter().enumerate() {
        let order_index = index as i32;
        let image_url_clone = card.image_url.clone();
        let mut fields_data = card.fields_data.clone();
        
        // Extract and decode audio if present (any field starting with data:audio/)
        let mut extracted_audio = Vec::new();
        if let Some(obj) = fields_data.as_object_mut() {
            let audio_keys: Vec<String> = obj.iter()
                .filter(|(_, v)| v.as_str().map(|s| s.starts_with("data:audio/")).unwrap_or(false))
                .map(|(k, _)| k.clone())
                .collect();

            for key in audio_keys {
                if let Some(base64_str) = obj.remove(&key).and_then(|v| v.as_str().map(|s| s.to_string())) {
                    let clean_base64 = if let Some(pos) = base64_str.find("base64,") {
                        &base64_str[pos + 7..]
                    } else {
                        &base64_str
                    };

                    if let Ok(audio_bytes) = general_purpose::STANDARD.decode(clean_base64) {
                        extracted_audio.push((key.clone(), audio_bytes));
                    }
                }
            }
        }


        let fc_record = sqlx::query(
            "INSERT INTO flashcards (set_id, term, definition, image_url, order_index, fields_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"
        )
        .bind(new_set_id)
        .bind(&card.term)
        .bind(&card.definition)
        .bind(&card.image_url)
        .bind(order_index)
        .bind(&fields_data) // Saved WITHOUT audio
        .fetch_one(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed adding flashcard: {}", e)))?;

        let fc_id: Uuid = fc_record.get("id");

        // 2.5 Save extracted audio to separate table
        for (field_id, audio_bytes) in extracted_audio {
            sqlx::query(
                "INSERT INTO flashcard_audio (flashcard_id, field_id, audio_data) VALUES ($1, $2, $3) ON CONFLICT (flashcard_id, field_id) DO UPDATE SET audio_data = $3"
            )
            .bind(fc_id)
            .bind(&field_id)
            .bind(audio_bytes)
            .execute(&mut *tx)
            .await
            .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed saving audio: {}", e)))?;
        }

        response_flashcards.push(FlashcardResponse {
            id: fc_id.to_string(),
            term: card.term.clone(),
            definition: card.definition.clone(),
            image_url: image_url_clone,
            order_index,
            fields_data: card.fields_data // Return with audio for direct UI response if needed, OR strip it here too
        });
    }


    // Commit transaction
    tx.commit().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = SetResponse {
        id: new_set_id.to_string(),
        title: payload.title,
        description: payload.description,
        creator_id: creator_id.to_string(),
        fields_schema: payload.fields_schema,
        flashcards: response_flashcards,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_user_sets(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;

    // Updated Query to count cards
    let sets_records = sqlx::query(
        r#"
        SELECT s.id, s.title, s.description, s.created_at, s.fields_schema, COUNT(f.id) as flashcard_count
        FROM sets s
        LEFT JOIN flashcards f ON s.id = f.set_id
        WHERE s.creator_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
        "#
    )
    .bind(creator_id)
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response: Vec<SetSummaryResponse> = sets_records
        .into_iter()
        .map(|record| {
            let flashcard_count: i64 = record.get("flashcard_count");
            let created_at: chrono::DateTime<chrono::Utc> = record.get("created_at");
            SetSummaryResponse {
                id: record.get::<Uuid, _>("id").to_string(),
                title: record.get("title"),
                description: record.get("description"),
                fields_schema: record.get("fields_schema"),
                flashcard_count: flashcard_count as i32,
                created_at: created_at.to_string(),
            }
        })
        .collect();

    Ok((StatusCode::OK, Json(response)))
}

pub async fn delete_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID format"))?;

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;

    let result = sqlx::query(
        "DELETE FROM sets WHERE id = $1 AND creator_id = $2"
    )
    .bind(set_id)
    .bind(creator_id)
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::response(StatusCode::NOT_FOUND, "Set not found or unauthorized"));
    }

    Ok(StatusCode::OK)
}

pub async fn update_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSetRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID format"))?;

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;

    if payload.flashcards.len() < 2 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "A set must contain at least 2 flashcards."));
    }

    // Verify ownership
    let existing_set = sqlx::query(
        "SELECT id FROM sets WHERE id = $1 AND creator_id = $2"
    )
    .bind(set_id)
    .bind(creator_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing_set.is_none() {
        return Err(ApiError::response(StatusCode::NOT_FOUND, "Set not found or unauthorized"));
    }

    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 1. Update the parent Set
    sqlx::query(
        "UPDATE sets SET title = $1, description = $2, is_public = $3, fields_schema = $4 WHERE id = $5"
    )
    .bind(&payload.title)
    .bind(&payload.description)
    .bind(payload.is_public)
    .bind(&payload.fields_schema)
    .bind(set_id)
    .execute(&mut *tx)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. Identify flashcards to keep and to delete
    let incoming_ids: Vec<Uuid> = payload.flashcards.iter()
        .filter_map(|fc| fc.id.as_ref().and_then(|id| Uuid::parse_str(id).ok()))
        .collect();

    if incoming_ids.is_empty() {
        sqlx::query("DELETE FROM flashcards WHERE set_id = $1")
            .bind(set_id)
            .execute(&mut *tx)
            .await
            .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    } else {
        sqlx::query(
            "DELETE FROM flashcards WHERE set_id = $1 AND id != ALL($2)"
        )
        .bind(set_id)
        .bind(&incoming_ids)
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // 3. Update existing or insert new flashcards iteratively
    let mut response_flashcards = Vec::new();
    for (index, card) in payload.flashcards.into_iter().enumerate() {
        let order_index = index as i32;
        let mut fields_data = card.fields_data.clone();
        
        // Extract and decode audio
        let mut extracted_audio = Vec::new();
        if let Some(obj) = fields_data.as_object_mut() {
            let audio_keys: Vec<String> = obj.iter()
                .filter(|(_, v)| v.as_str().map(|s| s.starts_with("data:audio/")).unwrap_or(false))
                .map(|(k, _)| k.clone())
                .collect();

            for key in audio_keys {
                if let Some(base64_str) = obj.remove(&key).and_then(|v| v.as_str().map(|s| s.to_string())) {
                    let clean_base64 = if let Some(pos) = base64_str.find("base64,") {
                        &base64_str[pos + 7..]
                    } else {
                        &base64_str
                    };

                    if let Ok(audio_bytes) = general_purpose::STANDARD.decode(clean_base64) {
                        extracted_audio.push((key.clone(), audio_bytes));
                    }
                }
            }
        }

        let fc_id = card.id.as_ref().and_then(|id_str| Uuid::parse_str(id_str).ok()).unwrap_or_else(Uuid::new_v4);

        sqlx::query(
            "INSERT INTO flashcards (id, set_id, term, definition, image_url, order_index, fields_data) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO UPDATE SET 
                term = EXCLUDED.term, 
                definition = EXCLUDED.definition, 
                image_url = EXCLUDED.image_url, 
                order_index = EXCLUDED.order_index, 
                fields_data = EXCLUDED.fields_data"
        )
        .bind(fc_id)
        .bind(set_id)
        .bind(&card.term)
        .bind(&card.definition)
        .bind(&card.image_url)
        .bind(order_index)
        .bind(&fields_data)
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        // Save audio blobs
        for (field_id, audio_bytes) in extracted_audio {
            sqlx::query(
                "INSERT INTO flashcard_audio (flashcard_id, field_id, audio_data) 
                 VALUES ($1, $2, $3)
                 ON CONFLICT (flashcard_id, field_id) DO UPDATE SET audio_data = $3"
            )
            .bind(fc_id)
            .bind(field_id)
            .bind(audio_bytes)
            .execute(&mut *tx)
            .await
            .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }

        response_flashcards.push(FlashcardResponse {
            id: fc_id.to_string(),
            term: card.term,
            definition: card.definition,
            image_url: card.image_url,
            order_index,
            fields_data,
        });
    }

    tx.commit().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = SetResponse {
        id: set_id.to_string(),
        title: payload.title,
        description: payload.description,
        creator_id: creator_id.to_string(),
        fields_schema: payload.fields_schema,
        flashcards: response_flashcards,
    };

    Ok((StatusCode::OK, Json(response)))
}
