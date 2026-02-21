use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::dtos::{
    CreateSetRequest, FlashcardResponse, SetResponse,
};
use crate::middleware::auth::AuthenticatedUser;

pub async fn get_public_set(
    State(pool): State<PgPool>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    
    let set_id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID format".to_string()))?;

    // 1. Fetch the set, strictly enforcing is_public = true
    let set_record = sqlx::query!(
        "SELECT id, title, description FROM sets WHERE id = $1 AND is_public = true",
        set_id
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let set_record = match set_record {
        Some(record) => record,
        None => return Err((StatusCode::NOT_FOUND, "Set not found or is private".to_string())),
    };

    // 2. Fetch the flashcards for this set, ordered appropriately
    let flashcards_records = sqlx::query!(
        "SELECT id, term, definition, order_index FROM flashcards WHERE set_id = $1 ORDER BY order_index ASC",
        set_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // 3. Map into DTOs
    let flashcards: Vec<FlashcardResponse> = flashcards_records
        .into_iter()
        .map(|fc| FlashcardResponse {
            id: fc.id.to_string(),
            term: fc.term,
            definition: fc.definition,
            order_index: fc.order_index,
        })
        .collect();

    let response = SetResponse {
        id: set_record.id.to_string(),
        title: set_record.title,
        description: set_record.description,
        flashcards,
    };

    Ok((StatusCode::OK, Json(response)))
}

pub async fn create_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreateSetRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    
    if payload.flashcards.len() < 2 {
        return Err((StatusCode::BAD_REQUEST, "A set must contain at least 2 flashcards.".to_string()));
    }

    let creator_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    // Begin the transaction
    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    // 1. Insert the parent Set
    let set_record = sqlx::query!(
        "INSERT INTO sets (creator_id, title, description, is_public) VALUES ($1, $2, $3, $4) RETURNING id",
        creator_id,
        payload.title,
        payload.description,
        payload.is_public
    )
    .fetch_one(&mut *tx)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let new_set_id = set_record.id;

    // 2. Insert the Flashcards iteratively
    let mut response_flashcards = Vec::new();
    
    for (index, card) in payload.flashcards.into_iter().enumerate() {
        let order_index = index as i32;
        let fc_record = sqlx::query!(
            "INSERT INTO flashcards (set_id, term, definition, order_index) VALUES ($1, $2, $3, $4) RETURNING id",
            new_set_id,
            card.term,
            card.definition,
            order_index
        )
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed adding flashcard: {}", e)))?;

        response_flashcards.push(FlashcardResponse {
            id: fc_record.id.to_string(),
            term: card.term,
            definition: card.definition,
            order_index
        });
    }

    // Commit transaction
    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = SetResponse {
        id: new_set_id.to_string(),
        title: payload.title,
        description: payload.description,
        flashcards: response_flashcards,
    };

    Ok((StatusCode::CREATED, Json(response)))
}
