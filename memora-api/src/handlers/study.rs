use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::dtos::{SetProgressResponse, StudySessionRequest};
use crate::middleware::auth::AuthenticatedUser;

pub async fn record_study_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<StudySessionRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;

    // Transaction for atomic batch updates
    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for update in payload.progress_updates {
        let flashcard_uuid = Uuid::parse_str(&update.flashcard_id)
            .map_err(|_| (StatusCode::BAD_REQUEST, format!("Invalid flashcard UUID: {}", update.flashcard_id)))?;

        // 1. Validate the flashcard actually belongs to the provided set to prevent tampering
        let card_exists = sqlx::query!(
            "SELECT id FROM flashcards WHERE id = $1 AND set_id = $2",
            flashcard_uuid,
            Uuid::parse_str(&payload.set_id).unwrap_or_default()
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if card_exists.is_none() {
            // Rollback if there's an unauthorized or invalid card ID
            return Err((StatusCode::BAD_REQUEST, "Flashcard does not belong to the specified set".to_string()));
        }

        // 2. Upsert the progress leveraging ON CONFLICT
        sqlx::query!(
            r#"
            INSERT INTO flashcard_progress (user_id, flashcard_id, is_known, reviewed_at, updated_at)
            VALUES ($1, $2, $3, NOW(), NOW())
            ON CONFLICT (user_id, flashcard_id)
            DO UPDATE SET 
                is_known = EXCLUDED.is_known,
                reviewed_at = NOW(),
                updated_at = NOW()
            "#,
            user_id,
            flashcard_uuid,
            update.is_known
        )
        .execute(&mut *tx)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Commit the batch of updates
    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Technically returning 200 OK or 204 No Content is standard here. We'll return 200 OK with a success message.
    Ok((StatusCode::OK, Json(serde_json::json!({"status": "success"}))))
}

pub async fn get_set_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(set_id_str): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid user token".to_string()))?;
        
    let set_id = Uuid::parse_str(&set_id_str)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid set ID".to_string()))?;

    // Retrieve aggregate statistics from the DB
    // Count all flashcards in the set, and how many are known by this specific user
    let row = sqlx::query!(
        r#"
        SELECT 
            COUNT(f.id) as total_cards,
            COALESCE(SUM(CASE WHEN fp.is_known = true THEN 1 ELSE 0 END), 0) as known_cards
        FROM flashcards f
        LEFT JOIN flashcard_progress fp ON f.id = fp.flashcard_id AND fp.user_id = $1
        WHERE f.set_id = $2
        "#,
        user_id,
        set_id
    )
    .fetch_one(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let total = row.total_cards.unwrap_or(0);
    let known = row.known_cards.unwrap_or(0);
    
    let mastery_percentage = if total > 0 {
        ((known as f64 / total as f64) * 100.0).round() as i32
    } else {
        0
    };

    let response = SetProgressResponse {
        total_cards: total,
        known_cards: known,
        mastery_percentage,
    };

    Ok((StatusCode::OK, Json(response)))
}
