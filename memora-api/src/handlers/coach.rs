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

    // Журнал повторений — для streak и аналитики.
    let _ = sqlx::query(
        "INSERT INTO course_review_logs (user_id, course_id, unit_id, exercise_id, rating)
         VALUES ($1, $2, $3, $4, $5)"
    )
    .bind(user_id)
    .bind(&course_id)
    .bind(&payload.unit_id)
    .bind(&payload.exercise_id)
    .bind(payload.rating as i16)
    .execute(&pool)
    .await;

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

#[derive(Deserialize)]
pub struct StatsQuery {
    /// Смещение часового пояса клиента в минутах (как Date.getTimezoneOffset(), но со знаком "+восток").
    pub tz_offset_min: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoachStats {
    pub streak_days: i64,
    pub today_reviews: i64,
    pub total_reviews: i64,
    pub learned_count: i64,
}

/// GET /api/courses/{course_id}/coach/stats?tz_offset_min=180
/// Серия дней занятий, повторения за сегодня, всего повторений, усвоено упражнений.
pub async fn get_coach_stats(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
    axum::extract::Query(q): axum::extract::Query<StatsQuery>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let offset_min = q.tz_offset_min.unwrap_or(0).clamp(-840, 840);

    // Уникальные дни занятий (в часовом поясе клиента), от новых к старым.
    let day_rows = sqlx::query(
        "SELECT DISTINCT (review_time + ($3 || ' minutes')::interval)::date AS day
         FROM course_review_logs
         WHERE user_id = $1 AND course_id = $2
         ORDER BY day DESC
         LIMIT 400"
    )
    .bind(user_id)
    .bind(&course_id)
    .bind(offset_min.to_string())
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let days: Vec<chrono::NaiveDate> = day_rows.iter().map(|r| r.get::<chrono::NaiveDate, _>("day")).collect();
    let today = (chrono::Utc::now() + chrono::Duration::minutes(offset_min as i64)).date_naive();

    // Streak: подряд идущие дни, заканчивающиеся сегодня или вчера.
    let mut streak: i64 = 0;
    let mut expected = today;
    for d in &days {
        if *d == expected {
            streak += 1;
            expected = expected - chrono::Duration::days(1);
        } else if streak == 0 && *d == today - chrono::Duration::days(1) {
            // Сегодня ещё не занимался — серия продолжается со вчерашнего дня.
            streak += 1;
            expected = *d - chrono::Duration::days(1);
        } else {
            break;
        }
    }

    let counts = sqlx::query(
        "SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE (review_time + ($3 || ' minutes')::interval)::date = (NOW() + ($3 || ' minutes')::interval)::date) AS today
         FROM course_review_logs
         WHERE user_id = $1 AND course_id = $2"
    )
    .bind(user_id)
    .bind(&course_id)
    .bind(offset_min.to_string())
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let learned = sqlx::query(
        "SELECT COUNT(*) AS learned FROM course_exercise_reviews
         WHERE user_id = $1 AND course_id = $2 AND state = 2"
    )
    .bind(user_id)
    .bind(&course_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::OK, Json(CoachStats {
        streak_days: streak,
        today_reviews: counts.get::<i64, _>("today"),
        total_reviews: counts.get::<i64, _>("total"),
        learned_count: learned.get::<i64, _>("learned"),
    })))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkKnownRequest {
    pub unit_id: String,
    pub exercise_ids: Vec<String>,
}

/// POST /api/courses/{course_id}/coach/mark-known
/// «Я уже знаю это»: помечает упражнения юнита усвоенными (длинный интервал FSRS),
/// чтобы коуч не тратил время учащегося на известный материал (быстрая диагностика).
pub async fn mark_known(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
    Json(payload): Json<MarkKnownRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if payload.exercise_ids.len() > 500 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Too many exercises"));
    }

    let now = chrono::Utc::now();
    let due = now + chrono::Duration::days(21);

    let mut tx = pool.begin().await.map_err(db_err)?;
    for ex_id in &payload.exercise_ids {
        sqlx::query(
            r#"
            INSERT INTO course_exercise_reviews (
                user_id, course_id, unit_id, exercise_id,
                state, due, stability, difficulty, reps, lapses, last_review
            )
            VALUES ($1, $2, $3, $4, 2, $5, 21.0, 5.0, 1, 0, $6)
            ON CONFLICT (user_id, course_id, unit_id, exercise_id)
            DO UPDATE SET state = 2, due = EXCLUDED.due, updated_at = NOW()
            "#
        )
        .bind(user_id)
        .bind(&course_id)
        .bind(&payload.unit_id)
        .bind(ex_id)
        .bind(due)
        .bind(now)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;

        // Отметить и как выполненное в прогрессе курса.
        let _ = sqlx::query(
            "INSERT INTO course_progress (user_id, course_id, unit_id, exercise_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, course_id, unit_id, exercise_id) DO NOTHING"
        )
        .bind(user_id)
        .bind(&course_id)
        .bind(&payload.unit_id)
        .bind(ex_id)
        .execute(&mut *tx)
        .await;
    }
    tx.commit().await.map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}
