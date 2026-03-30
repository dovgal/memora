use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;
use super::errors::ApiError;

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

    match row {
        Some(r) => {
            Ok((
                [(header::CONTENT_TYPE, "audio/mpeg"), (header::CACHE_CONTROL, "public, max-age=31536000")],
                r.audio_data,
            ))
        }
        None => Err(ApiError::response(StatusCode::NOT_FOUND, "Audio not found")),
    }
}
