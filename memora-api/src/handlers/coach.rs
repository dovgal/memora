// Коуч-режим: интервальное повторение упражнений курса (FSRS).
// Работает для любого курса: встроенных ('edito-a1') и пользовательских (UUID).
// Фронтенд строит очередь: сначала упражнения с due <= now, затем новые.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachReviewEntry {
    pub unit_id: String,
    pub exercise_id: String,
    pub state: u8,
    pub due: String,
    pub reps: i32,
    pub lapses: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachReviewsResponse {
    pub reviews: Vec<CoachReviewEntry>,
}

/// GET /api/courses/{course_id}/coach/reviews — все записи повторения по курсу.
pub async fn get_coach_reviews(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;

    let rows = sqlx::query(
        "SELECT unit_id, exercise_id, state, due, reps, lapses
         FROM course_exercise_reviews
         WHERE user_id = $1 AND course_id = $2
         ORDER BY due ASC"
    )
    .bind(user_id)
    .bind(&course_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let reviews = rows.into_iter().map(|r| {
        let due: chrono::DateTime<chrono::Utc> = r.get("due");
        CoachReviewEntry {
            unit_id: r.get("unit_id"),
            exercise_id: r.get("exercise_id"),
            state: r.get::<i16, _>("state") as u8,
            due: due.to_rfc3339(),
            reps: r.get("reps"),
            lapses: r.get("lapses"),
        }
    }).collect();

    Ok((StatusCode::OK, Json(CoachReviewsResponse { reviews })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachReviewRequest {
    pub unit_id: String,
    pub exercise_id: String,
    /// 1=Again, 2=Hard, 3=Good, 4=Easy
    pub rating: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachReviewResult {
    pub state: u8,
    pub due: String,
    pub scheduled_days: i32,
}

/// POST /api/courses/{course_id}/coach/review — оценить упражнение, FSRS планирует следующее повторение.
pub async fn record_coach_review(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
    Json(payload): Json<CoachReviewRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if !(1..=4).contains(&payload.rating) {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Rating must be 1-4"));
    }

    // Текущее состояние FSRS (если есть)
    let record = sqlx::query(
        "SELECT state, stability, difficulty, last_review
         FROM course_exercise_reviews
         WHERE user_id = $1 AND course_id = $2 AND unit_id = $3 AND exercise_id = $4"
    )
    .bind(user_id)
    .bind(&course_id)
    .bind(&payload.unit_id)
    .bind(&payload.exercise_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?;

    let now = chrono::Utc::now();
    let fsrs = fsrs::FSRS::new(None)
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut current_memory = None;
    let mut elapsed_days: u32 = 0;
    let current_state: u8 = if let Some(ref r) = record {
        let stability: f32 = r.get("stability");
        let difficulty: f32 = r.get("difficulty");
        if stability > 0.0 {
            current_memory = Some(fsrs::MemoryState { stability, difficulty });
        }
        if let Some(lr) = r.get::<Option<chrono::DateTime<chrono::Utc>>, _>("last_review") {
            elapsed_days = (now - lr).num_days().max(0) as u32;
        }
        r.get::<i16, _>("state") as u8
    } else {
        0
    };

    let next_states = fsrs.next_states(current_memory, 0.9, elapsed_days)
        .map_err(|e: fsrs::FSRSError| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let item_state = match payload.rating {
        1 => next_states.again,
        2 => next_states.hard,
        3 => next_states.good,
        _ => next_states.easy,
    };

    let scheduled_days = item_state.interval.round() as i32;
    let next_due = now + chrono::Duration::days(scheduled_days.max(0) as i64);

    let new_state: i16 = if scheduled_days == 0 {
        if current_state == 2 { 3 } else { 1 }
    } else {
        2
    };
    let inc_lapse: i32 = if new_state == 3 && current_state == 2 { 1 } else { 0 };

    sqlx::query(
        r#"
        INSERT INTO course_exercise_reviews (
            user_id, course_id, unit_id, exercise_id,
            state, due, stability, difficulty, reps, lapses, last_review
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10)
        ON CONFLICT (user_id, course_id, unit_id, exercise_id)
        DO UPDATE SET
            state = EXCLUDED.state,
            due = EXCLUDED.due,
            stability = EXCLUDED.stability,
            difficulty = EXCLUDED.difficulty,
            reps = course_exercise_reviews.reps + 1,
            lapses = course_exercise_reviews.lapses + EXCLUDED.lapses,
            last_review = EXCLUDED.last_review,
            updated_at = NOW()
        "#
    )
    .bind(user_id)
    .bind(&course_id)
    .bind(&payload.unit_id)
    .bind(&payload.exercise_id)
    .bind(new_state)
    .bind(next_due)
    .bind(item_state.memory.stability)
    .bind(item_state.memory.difficulty)
    .bind(inc_lapse)
    .bind(now)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    // Успешная оценка (Good/Easy) также отмечает упражнение как выполненное в course_progress.
    if payload.rating >= 3 {
        let _ = sqlx::query(
            "INSERT INTO course_progress (user_id, course_id, unit_id, exercise_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, course_id, unit_id, exercise_id) DO NOTHING"
        )
        .bind(user_id)
        .bind(&course_id)
        .bind(&payload.unit_id)
        .bind(&payload.exercise_id)
        .execute(&pool)
        .await;
    }

    Ok((StatusCode::OK, Json(CoachReviewResult {
        state: new_state as u8,
        due: next_due.to_rfc3339(),
        scheduled_days,
    })))
}
