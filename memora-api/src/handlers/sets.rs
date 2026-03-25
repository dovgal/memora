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
use super::errors::ApiError;

pub async fn get_public_set(
    State(pool): State<PgPool>,
    optional_user: crate::middleware::auth::OptionalAuthenticatedUser,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID format"))?;

    // 1. Fetch the set, allowing either public or private sets to be fetched initially
    let set_record = sqlx::query!(
        "SELECT id, title, description, is_public, creator_id, fields_schema FROM sets WHERE id = $1",
        set_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let set_record = match set_record {
        Some(record) => record,
        None => return Err(ApiError::response(StatusCode::NOT_FOUND, "Set not found")),
    };

    // 1.5 Check if the user is authorized to view this set
    let requesting_user_id = optional_user.0.and_then(|claims| Uuid::parse_str(&claims.sub).ok());
    let is_owner = requesting_user_id.is_some() && Some(set_record.creator_id) == requesting_user_id;

    if !set_record.is_public && !is_owner {
        return Err(ApiError::response(StatusCode::NOT_FOUND, "Set not found or is private"));
    }

    // 2. Fetch the flashcards for this set, ordered appropriately
    let flashcards_records = sqlx::query!(
        "SELECT id, term, definition, image_url, order_index, fields_data FROM flashcards WHERE set_id = $1 ORDER BY order_index ASC",
        set_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        creator_id: set_record.creator_id.to_string(),
        fields_schema: set_record.fields_schema,
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
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed adding flashcard: {}", e)))?;

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
    let sets_records = sqlx::query!(
        r#"
        SELECT s.id, s.title, s.description, s.created_at, s.fields_schema, COUNT(f.id) as flashcard_count
        FROM sets s
        LEFT JOIN flashcards f ON s.id = f.set_id
        WHERE s.creator_id = $1
        GROUP BY s.id
        ORDER BY s.created_at DESC
        "#,
        creator_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response: Vec<SetSummaryResponse> = sets_records
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
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID format"))?;

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;

    let result = sqlx::query!(
        "DELETE FROM sets WHERE id = $1 AND creator_id = $2",
        set_id,
        creator_id
    )
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
    let existing_set = sqlx::query!(
        "SELECT id FROM sets WHERE id = $1 AND creator_id = $2",
        set_id,
        creator_id,
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing_set.is_none() {
        return Err(ApiError::response(StatusCode::NOT_FOUND, "Set not found or unauthorized"));
    }

    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 2. We'll simply delete all existing flashcards and insert the new ones
    sqlx::query!("DELETE FROM flashcards WHERE set_id = $1", set_id)
        .execute(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Insert the Flashcards iteratively
    let mut response_flashcards = Vec::new();
    
    for (index, card) in payload.flashcards.into_iter().enumerate() {
        let order_index = index as i32;
        let image_url_clone = card.image_url.clone();
        let fields_data_clone = card.fields_data.clone();
        
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
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed adding flashcard: {}", e)))?;

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
