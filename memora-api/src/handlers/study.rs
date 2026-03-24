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
use super::errors::ApiError;

pub async fn record_study_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<StudySessionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;

    // Transaction for atomic batch updates
    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    for update in payload.progress_updates {
        let flashcard_uuid = Uuid::parse_str(&update.flashcard_id)
            .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, format!("Invalid flashcard UUID: {}", update.flashcard_id)))?;

        // 1. Validate the flashcard actually belongs to the provided set to prevent tampering
        let card_exists = sqlx::query!(
            "SELECT id FROM flashcards WHERE id = $1 AND set_id = $2",
            flashcard_uuid,
            Uuid::parse_str(&payload.set_id).unwrap_or_default()
        )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if card_exists.is_none() {
            // Rollback if there's an unauthorized or invalid card ID
            return Err(ApiError::response(StatusCode::BAD_REQUEST, "Flashcard does not belong to the specified set"));
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
        .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    }

    // Commit the batch of updates
    tx.commit().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Technically returning 200 OK or 204 No Content is standard here. We'll return 200 OK with a success message.
    Ok((StatusCode::OK, Json(serde_json::json!({"status": "success"}))))
}

pub async fn get_set_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(set_id_str): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;
        
    let set_id = Uuid::parse_str(&set_id_str)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID"))?;

    // We do a single query to get all flashcards in the set and their FSRS state for this user.
    let rows = sqlx::query!(
        r#"
        SELECT 
            f.id as flashcard_id,
            COALESCE(fsrs.state, 0) as fsrs_state
        FROM flashcards f
        LEFT JOIN fsrs_records fsrs ON f.id = fsrs.flashcard_id AND fsrs.user_id = $1
        WHERE f.set_id = $2
        "#,
        user_id,
        set_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    use crate::domain::dtos::CardProgress;

    let total = rows.len() as i32;
    // We'll define "known" or "mastered" strictly as FSRS State == 2 (Review)
    let known = rows.iter().filter(|r| r.fsrs_state == Some(2)).count() as i32;
    
    let mastery_percentage = if total > 0 {
        ((known as f64 / total as f64) * 100.0).round() as i32
    } else {
        0
    };

    let cards = rows.into_iter().map(|r| CardProgress {
        flashcard_id: r.flashcard_id.to_string(),
        state: r.fsrs_state.unwrap_or(0) as u8,
    }).collect();

    let response = SetProgressResponse {
        total_cards: total,
        known_cards: known,
        mastery_percentage,
        cards,
    };

    Ok((StatusCode::OK, Json(response)))
}

use crate::domain::dtos::{FSRSRatingRequest, ReviewLogResponse, FlashcardResponse};

pub async fn fsrs_review(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<FSRSRatingRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid token"))?;
    let flashcard_uuid = Uuid::parse_str(&payload.flashcard_id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid flashcard ID"))?;

    // Load existing fsrs record
    let record = sqlx::query!(
        "SELECT state, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, last_review FROM fsrs_records WHERE user_id = $1 AND flashcard_id = $2",
        user_id, flashcard_uuid
    ).fetch_optional(&pool).await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let now = chrono::Utc::now();
    let fsrs = fsrs::FSRS::new(None).map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let mut current_memory = None;
    let mut elapsed_days = 0;
    let current_state = if let Some(ref r) = record {
        current_memory = Some(fsrs::MemoryState {
            stability: r.stability,
            difficulty: r.difficulty
        });
        if let Some(lr) = r.last_review {
            elapsed_days = (now - lr).num_days().max(0) as u32;
        }
        r.state as u8
    } else {
        0u8 // New
    };

    let next_states = fsrs.next_states(current_memory, 0.9, elapsed_days)
        .map_err(|e: fsrs::FSRSError| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    let item_state = match payload.rating {
        1 => next_states.again,
        2 => next_states.hard,
        3 => next_states.good,
        4 => next_states.easy,
        _ => return Err(ApiError::response(StatusCode::BAD_REQUEST, "Invalid rating"))
    };

    let scheduled_days = item_state.interval.round() as i32;
    // ensure due date isn't negative days (past)
    let next_due = now + chrono::Duration::days(scheduled_days.max(0) as i64);

    let new_state = if scheduled_days == 0 {
        if current_state == 2 { 3 } else { 1 }
    } else {
        2
    };

    let inc_lapse = if new_state == 3 && current_state == 2 { 1 } else { 0 };

    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    sqlx::query!(
        r#"
        INSERT INTO fsrs_records (
            user_id, flashcard_id, state, due, stability, difficulty,
            elapsed_days, scheduled_days, reps, lapses, last_review
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10)
        ON CONFLICT (user_id, flashcard_id)
        DO UPDATE SET
            state = EXCLUDED.state,
            due = EXCLUDED.due,
            stability = EXCLUDED.stability,
            difficulty = EXCLUDED.difficulty,
            elapsed_days = EXCLUDED.elapsed_days,
            scheduled_days = EXCLUDED.scheduled_days,
            reps = fsrs_records.reps + 1,
            lapses = fsrs_records.lapses + EXCLUDED.lapses,
            last_review = EXCLUDED.last_review,
            updated_at = NOW()
        "#,
        user_id,
        flashcard_uuid,
        new_state as i16,
        next_due,
        item_state.memory.stability,
        item_state.memory.difficulty,
        elapsed_days as i32,
        scheduled_days,
        inc_lapse as i32,
        now
    ).execute(&mut *tx).await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Log the review
    sqlx::query!(
        r#"
        INSERT INTO review_logs (
            user_id, flashcard_id, rating, review_time, elapsed_days, scheduled_days
        ) VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        user_id,
        flashcard_uuid,
        payload.rating as i16,
        now,
        elapsed_days as i32,
        scheduled_days
    ).execute(&mut *tx).await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    tx.commit().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = ReviewLogResponse {
        state: new_state,
        due: next_due.to_rfc3339(),
        scheduled_days,
        elapsed_days: elapsed_days as i32,
    };

    Ok((StatusCode::OK, Json(response)))
}

pub async fn get_fsrs_due(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(set_id_str): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;
        
    let set_id = Uuid::parse_str(&set_id_str)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID"))?;

    // Fetch cards that either have no FSRS record (due IS NULL - meaning New) 
    // or their due date is <= NOW() (due < NOW())
    let rows = sqlx::query!(
        r#"
        SELECT f.id, f.term, f.definition, f.image_url, f.order_index, f.fields_data 
        FROM flashcards f
        LEFT JOIN fsrs_records fr ON f.id = fr.flashcard_id AND fr.user_id = $1
        WHERE f.set_id = $2 AND (fr.due IS NULL OR fr.due <= NOW())
        ORDER BY fr.due ASC NULLS FIRST
        LIMIT 50
        "#,
        user_id,
        set_id
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let cards: Vec<FlashcardResponse> = rows.into_iter().map(|row| {
        FlashcardResponse {
            id: row.id.to_string(),
            term: row.term,
            definition: row.definition,
            image_url: row.image_url,
            order_index: row.order_index,
            fields_data: row.fields_data,
        }
    }).collect();

    Ok((StatusCode::OK, Json(cards)))
}

pub async fn reset_fsrs_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(set_id_str): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))?;
        
    let set_id = Uuid::parse_str(&set_id_str)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid set ID"))?;

    // Delete FSRS records related to this set and user
    sqlx::query!(
        "DELETE FROM fsrs_records WHERE user_id = $1 AND flashcard_id IN (SELECT id FROM flashcards WHERE set_id = $2)",
        user_id,
        set_id
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Also delete review logs 
    sqlx::query!(
        "DELETE FROM review_logs WHERE user_id = $1 AND flashcard_id IN (SELECT id FROM flashcards WHERE set_id = $2)",
        user_id,
        set_id
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Also reset any legacy progress
    sqlx::query!(
        "DELETE FROM flashcard_progress WHERE user_id = $1 AND flashcard_id IN (SELECT id FROM flashcards WHERE set_id = $2)",
        user_id,
        set_id
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({"status": "progress reset"}))))
}
