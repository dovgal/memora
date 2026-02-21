use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::dtos::{FlashcardResponse, SetResponse};

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
