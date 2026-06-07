// Универсальный прогресс прохождения курсов-тренажёров (например, Edito A1).
// Хранит факт выполнения упражнения пользователем: course_id/unit_id/exercise_id.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

fn uid(sub: &str) -> Result<Uuid, (StatusCode, Json<ApiError>)> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

#[derive(Deserialize)]
pub struct RecordProgressRequest {
    pub unit_id: String,
    pub exercise_id: String,
}

#[derive(Serialize)]
pub struct ProgressEntry {
    pub unit_id: String,
    pub exercise_id: String,
    pub completed_at: String,
}

#[derive(Serialize)]
pub struct CourseProgressResponse {
    pub exercises: Vec<ProgressEntry>,
}

pub async fn record_course_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
    Json(payload): Json<RecordProgressRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = uid(&user.sub)?;
    sqlx::query(
        "INSERT INTO course_progress (user_id, course_id, unit_id, exercise_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, course_id, unit_id, exercise_id) DO NOTHING"
    )
    .bind(user_id).bind(&course_id).bind(&payload.unit_id).bind(&payload.exercise_id)
    .execute(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_course_progress(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = uid(&user.sub)?;
    let rows = sqlx::query_as::<_, (String, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT unit_id, exercise_id, completed_at FROM course_progress
         WHERE user_id = $1 AND course_id = $2
         ORDER BY completed_at ASC"
    )
    .bind(user_id).bind(&course_id)
    .fetch_all(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let exercises = rows.into_iter().map(|(unit_id, exercise_id, completed_at)| ProgressEntry {
        unit_id,
        exercise_id,
        completed_at: completed_at.to_rfc3339(),
    }).collect();

    Ok((StatusCode::OK, Json(CourseProgressResponse { exercises })))
}
