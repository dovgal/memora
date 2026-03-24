use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::dtos::{
    CreateSetRequest, FlashcardResponse, SetResponse, SetSummaryResponse, UpdateSetRequest
};
use crate::middleware::auth::AuthenticatedUser;

pub async fn get_public_set(
    State(pool): State<PgPool>,
    optional_user: crate::middleware::auth::OptionalAuthenticatedUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID format".to_string()))?;

    // 1. Fetch the set, allowing either public or private sets to be fetched initially
    let set_record = sqlx::query!(
        "SELECT id, title, description, is_public, creator_id, fields_schema FROM sets WHERE id = $1",
        set_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let set_record = match set_record {
        Some(record) => record,
        None => return Err((StatusCode::NOT_FOUND, "Set not found".to_string())),
    };

    // 1.5 Check if the user is authorized to view this set
    let requesting_user_id = optional_user.0.and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let is_owner = requesting_user_id.is_some() && Some(set_record.creator_id) == requesting_user_id;

    if !set_record.is_public && !is_owner {
        return Err((StatusCode::NOT_FOUND, "Set not found or is private".to_string()));
    }

    // 2. Fetch the flashcards for this set, ordered appropriately
    let flashcards_records = sqlx::query!(
        "SELECT id, term, definition, image_url, order_index, fields_data FROM flashcards WHERE set_id = $1 ORDER BY order_index ASC",
        set_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Map into DTOs
    let flashcards: Vec<FlashcardResponse> = flashcards_records
        .into_iter()
        .map(|fc| FlashcardResponse {
            id: fc.id.to_string(),
            term: fc.term,
            definition: fc.definition,
            image_url: fc.image_url,
            order_index: fc.order_index,
            fields_data: fc.fields_data,
        })
        .collect();

    let response = SetResponse {
        id: set_record.id.to_string(),
        title: set_record.title,
        description: set_record.description,
        fields_schema: set_record.fields_schema,
        flashcards,
    };

    Ok((StatusCode::OK, Json(response)))
}

pub async fn create_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreateSetRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    println!("DEBUG: Received CreateSetRequest. title: {}, fields_schema: {:?}", payload.title, payload.fields_schema);
    
    if payload.flashcards.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, "A set must contain at least 2 flashcards.".to_string()));
    }

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    // Begin the transaction
    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // 1. Insert the parent Set
    let set_record = sqlx::query!(
        "INSERT INTO sets (creator_id, title, description, is_public, fields_schema) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        creator_id,
        payload.title,
        payload.description,
        payload.is_public,
        payload.fields_schema
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let new_set_id = set_record.id;

    // 2. Insert the Flashcards iteratively
    let mut response_flashcards = Vec::new();
    
    for (index, card) in payload.flashcards.into_iter().enumerate() {
        let order_index = index as i32;
        let image_url_clone = card.image_url.clone();
        let fields_data_clone = card.fields_data.clone();
        let fc_record = sqlx::query!(
            "INSERT INTO flashcards (set_id, term, definition, image_url, order_index, fields_data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
            new_set_id,
            card.term,
            card.definition,
            card.image_url,
            order_index,
            card.fields_data
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed adding flashcard: {}", e)))?;

        response_flashcards.push(FlashcardResponse {
            id: fc_record.id.to_string(),
            term: card.term,
            definition: card.definition,
            image_url: image_url_clone,
            order_index,
            fields_data: fields_data_clone
        });
    }

    // Commit transaction
    tx.commit().await.map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = SetResponse {
        id: new_set_id.to_string(),
        title: payload.title,
        description: payload.description,
        fields_schema: payload.fields_schema,
        flashcards: response_flashcards,
    };

    Ok((StatusCode::CREATED, Json(response)))
}

pub async fn get_user_sets(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    let sets = sqlx::query!(
        r#"
        SELECT s.id, s.title, s.description, s.created_at, s.fields_schema, COUNT(f.id) as flashcard_count
        FROM sets s
        LEFT JOIN flashcards f ON s.id = f.set_id
        WHERE s.creator_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
        "#,
        user_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response: Vec<SetSummaryResponse> = sets
        .into_iter()
        .map(|record| SetSummaryResponse {
            id: record.id.to_string(),
            title: record.title,
            description: record.description,
            fields_schema: record.fields_schema,
            flashcard_count: record.flashcard_count.unwrap_or(0) as i32,
            created_at: record.created_at.to_string(),
        })
        .collect();

    Ok((StatusCode::OK, Json(response)))
}

pub async fn delete_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID format".to_string()))?;

    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    // Check ownership first
    let result = sqlx::query!(
        "SELECT id FROM sets WHERE id = $1 AND creator_id = $2",
        set_id,
        user_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.is_none() {
        return Err((StatusCode::NOT_FOUND, "Set not found or unauthorized".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Delete related records manually to avoid any ON DELETE CASCADE issues with later migrations
    sqlx::query!("DELETE FROM folder_sets WHERE set_id = $1", set_id)
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!("DELETE FROM group_sets WHERE set_id = $1", set_id)
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Delete the set itself (which should cascade to flashcards and flashcard_progress if migrations are right)
    let result = sqlx::query!(
        "DELETE FROM sets WHERE id = $1 AND creator_id = $2",
        set_id,
        user_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit().await.map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if result.rows_affected() == 0 {
        return Err((StatusCode::NOT_FOUND, "Set not found or unauthorized".to_string()));
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn update_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSetRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID format".to_string()))?;

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    if payload.flashcards.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, "A set must contain at least 2 flashcards.".to_string()));
    }

    // Verify ownership
    let existing_set = sqlx::query!(
        "SELECT id FROM sets WHERE id = $1 AND creator_id = $2",
        set_id,
        creator_id,
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing_set.is_none() {
        return Err((StatusCode::NOT_FOUND, "Set not found or unauthorized".to_string()));
    }

    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 1. Update the parent Set
    sqlx::query!(
        "UPDATE sets SET title = $1, description = $2, is_public = $3, fields_schema = $4 WHERE id = $5",
        payload.title,
        payload.description,
        payload.is_public,
        payload.fields_schema,
        set_id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. We'll simply delete all existing flashcards and insert the new ones
    // Or we could try to diff and update. Since order matters and cards can be deleted/added,
    // the easiest robust way is deleting and creating new. Let's delete all and insert new.
    
    sqlx::query!("DELETE FROM flashcards WHERE set_id = $1", set_id)
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Insert the Flashcards iteratively
    let mut response_flashcards = Vec::new();
    
    for (index, card) in payload.flashcards.into_iter().enumerate() {
        let order_index = index as i32;
        let image_url_clone = card.image_url.clone();
        let fields_data_clone = card.fields_data.clone();
        
        // Use provided id if exists? Or generate new ones?
        // Since we delete and recreate, they will get new UUIDs. Actually, keeping IDs might be useful for progress tracking.
        // Wait, progress tracking relies on flashcard ID.
        // We MUST preserve IDs if they exist.
        
        let fc_id = if let Some(id_str) = &card.id {
            if let Ok(parsed_id) = Uuid::parse_str(id_str) {
                Some(parsed_id)
            } else {
                None
            }
        } else {
            None
        };

        let new_id = if let Some(id) = fc_id { id } else { Uuid::new_v4() };

        sqlx::query!(
            "INSERT INTO flashcards (id, set_id, term, definition, image_url, order_index, fields_data) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            new_id,
            set_id,
            card.term,
            card.definition,
            card.image_url,
            order_index,
            card.fields_data
        )
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed adding flashcard: {}", e)))?;

        response_flashcards.push(FlashcardResponse {
            id: new_id.to_string(),
            term: card.term,
            definition: card.definition,
            image_url: image_url_clone,
            order_index,
            fields_data: fields_data_clone
        });
    }

    // Commit transaction
    tx.commit().await.map_err(|e: sqlx::Error| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = SetResponse {
        id: set_id.to_string(),
        title: payload.title,
        description: payload.description,
        fields_schema: payload.fields_schema,
        flashcards: response_flashcards,
    };

    Ok((StatusCode::OK, Json(response)))
}
