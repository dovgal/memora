// Классы, лидерборд, диагностики, назначения и аналитика ошибок (курс A2).
// Используется runtime-форма sqlx::query(...).bind(...) (без compile-time .sqlx кэша).

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

fn uid(sub: &str) -> Result<Uuid, (StatusCode, Json<ApiError>)> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn gen_code() -> String {
    // 6-символьный код A-Z0-9
    use rand::Rng;
    const CHARS: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::rng();
    (0..6).map(|_| CHARS[rng.random_range(0..CHARS.len())] as char).collect()
}

// ───────── Классы ─────────
#[derive(Deserialize)]
pub struct CreateClassRequest { pub name: String }

#[derive(Serialize)]
pub struct ClassResponse { pub id: String, pub name: String, pub join_code: String }

pub async fn create_class(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreateClassRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let teacher_id = uid(&user.sub)?;
    let code = gen_code();
    let row = sqlx::query(
        "INSERT INTO classes (teacher_id, name, join_code) VALUES ($1, $2, $3) RETURNING id"
    )
    .bind(teacher_id).bind(&payload.name).bind(&code)
    .fetch_one(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let id: Uuid = row.get("id");
    Ok(Json(ClassResponse { id: id.to_string(), name: payload.name, join_code: code }))
}

#[derive(Deserialize)]
pub struct JoinClassRequest { pub join_code: String, pub display_name: Option<String> }

pub async fn join_class(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<JoinClassRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let student_id = uid(&user.sub)?;
    let row = sqlx::query("SELECT id, name FROM classes WHERE join_code = $1")
        .bind(payload.join_code.to_uppercase())
        .fetch_optional(&pool).await
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let row = row.ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Класс с таким кодом не найден"))?;
    let class_id: Uuid = row.get("id");
    let name: String = row.get("name");
    sqlx::query(
        "INSERT INTO class_members (class_id, user_id, display_name) VALUES ($1, $2, $3)
         ON CONFLICT (class_id, user_id) DO UPDATE SET display_name = EXCLUDED.display_name"
    )
    .bind(class_id).bind(student_id).bind(&payload.display_name)
    .execute(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(Json(ClassResponse { id: class_id.to_string(), name, join_code: payload.join_code }))
}

// ───────── XP / лидерборд ─────────
#[derive(Deserialize)]
pub struct XpRequest { pub xp: i32, pub streak: Option<i32> }

pub async fn submit_xp(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<XpRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = uid(&user.sub)?;
    let streak = payload.streak.unwrap_or(0);
    sqlx::query(
        "INSERT INTO a2_xp (user_id, xp, streak, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET xp = GREATEST(a2_xp.xp, EXCLUDED.xp), streak = EXCLUDED.streak, updated_at = NOW()"
    )
    .bind(user_id).bind(payload.xp).bind(streak)
    .execute(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct LeaderRow { pub name: String, pub xp: i32, pub streak: i32, pub me: bool }

/// Лидерборд класса (по join_code). Сортировка по XP.
pub async fn class_leaderboard(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(join_code): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let me_id = uid(&user.sub)?;
    let class = sqlx::query("SELECT id FROM classes WHERE join_code = $1")
        .bind(join_code.to_uppercase())
        .fetch_optional(&pool).await
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let class = class.ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Класс не найден"))?;
    let class_id: Uuid = class.get("id");

    let rows = sqlx::query(
        "SELECT cm.user_id, COALESCE(cm.display_name, u.email) AS name, COALESCE(x.xp,0) AS xp, COALESCE(x.streak,0) AS streak
         FROM class_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN a2_xp x ON x.user_id = cm.user_id
         WHERE cm.class_id = $1
         ORDER BY xp DESC
         LIMIT 100"
    )
    .bind(class_id)
    .fetch_all(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let board: Vec<LeaderRow> = rows.iter().map(|r| {
        let id: Uuid = r.get("user_id");
        LeaderRow { name: r.get("name"), xp: r.get("xp"), streak: r.get("streak"), me: id == me_id }
    }).collect();
    Ok(Json(board))
}

// ───────── Диагностика ─────────
#[derive(Deserialize)]
pub struct DiagnosticRequest {
    pub score_pct: i32,
    pub right_count: i32,
    pub total: i32,
    pub weak_units: Value,
    pub by_skill: Value,
}

pub async fn submit_diagnostic(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<DiagnosticRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let user_id = uid(&user.sub)?;
    sqlx::query(
        "INSERT INTO a2_diagnostics (user_id, score_pct, right_count, total, weak_units, by_skill)
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(user_id).bind(payload.score_pct).bind(payload.right_count).bind(payload.total)
    .bind(&payload.weak_units).bind(&payload.by_skill)
    .execute(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

// ───────── Аналитика ошибок ─────────
#[derive(Deserialize)]
pub struct ErrorStatRequest { pub grammar_point: String, pub correct: bool }

pub async fn report_error_stat(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
    Json(payload): Json<ErrorStatRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let err = if payload.correct { 0 } else { 1 };
    sqlx::query(
        "INSERT INTO a2_error_stats (grammar_point, attempts, errors, updated_at)
         VALUES ($1, 1, $2, NOW())
         ON CONFLICT (grammar_point) DO UPDATE SET attempts = a2_error_stats.attempts + 1, errors = a2_error_stats.errors + $2, updated_at = NOW()"
    )
    .bind(&payload.grammar_point).bind(err)
    .execute(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct ErrorStatRow { pub grammar_point: String, pub attempts: i32, pub errors: i32, pub error_rate: i32 }

/// Топ самых проваливаемых грам.точек (для преподавателя / корректировки курса).
pub async fn error_analytics(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let rows = sqlx::query(
        "SELECT grammar_point, attempts, errors FROM a2_error_stats WHERE attempts >= 3
         ORDER BY (errors::float / NULLIF(attempts,0)) DESC LIMIT 30"
    )
    .fetch_all(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let out: Vec<ErrorStatRow> = rows.iter().map(|r| {
        let attempts: i32 = r.get("attempts");
        let errors: i32 = r.get("errors");
        let rate = if attempts > 0 { (errors * 100) / attempts } else { 0 };
        ErrorStatRow { grammar_point: r.get("grammar_point"), attempts, errors, error_rate: rate }
    }).collect();
    Ok(Json(out))
}

// ───────── Кабинет преподавателя ─────────
#[derive(Serialize)]
pub struct StudentOverview {
    pub user_id: String,
    pub name: String,
    pub xp: i32,
    pub last_score: Option<i32>,
    pub weak_units: Value,
}

/// Обзор учеников класса для преподавателя (последняя диагностика + XP).
pub async fn teacher_overview(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(class_id_str): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let teacher_id = uid(&user.sub)?;
    let class_id = Uuid::parse_str(&class_id_str)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid class id"))?;

    // Проверка владения классом
    let owns = sqlx::query("SELECT 1 AS ok FROM classes WHERE id = $1 AND teacher_id = $2")
        .bind(class_id).bind(teacher_id)
        .fetch_optional(&pool).await
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if owns.is_none() {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Это не ваш класс"));
    }

    let rows = sqlx::query(
        "SELECT cm.user_id, COALESCE(cm.display_name, u.email) AS name, COALESCE(x.xp,0) AS xp,
                d.score_pct, d.weak_units
         FROM class_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN a2_xp x ON x.user_id = cm.user_id
         LEFT JOIN LATERAL (
            SELECT score_pct, weak_units FROM a2_diagnostics
            WHERE user_id = cm.user_id ORDER BY created_at DESC LIMIT 1
         ) d ON true
         WHERE cm.class_id = $1
         ORDER BY xp DESC"
    )
    .bind(class_id)
    .fetch_all(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let out: Vec<StudentOverview> = rows.iter().map(|r| {
        let id: Uuid = r.get("user_id");
        StudentOverview {
            user_id: id.to_string(),
            name: r.get("name"),
            xp: r.get("xp"),
            last_score: r.try_get("score_pct").ok(),
            weak_units: r.try_get("weak_units").unwrap_or(Value::Array(vec![])),
        }
    }).collect();
    Ok(Json(out))
}

/// Список классов преподавателя.
pub async fn my_classes(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let teacher_id = uid(&user.sub)?;
    let rows = sqlx::query(
        "SELECT c.id, c.name, c.join_code, COUNT(cm.user_id) AS members
         FROM classes c LEFT JOIN class_members cm ON cm.class_id = c.id
         WHERE c.teacher_id = $1 GROUP BY c.id ORDER BY c.created_at DESC"
    )
    .bind(teacher_id)
    .fetch_all(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    #[derive(Serialize)]
    struct ClassRow { id: String, name: String, join_code: String, members: i64 }
    let out: Vec<ClassRow> = rows.iter().map(|r| {
        let id: Uuid = r.get("id");
        ClassRow { id: id.to_string(), name: r.get("name"), join_code: r.get("join_code"), members: r.get("members") }
    }).collect();
    Ok(Json(out))
}

// ───────── Назначения ─────────
#[derive(Deserialize)]
pub struct AssignRequest { pub class_id: String, pub student_id: String, pub topics: Value, pub note: Option<String> }

pub async fn create_assignment(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<AssignRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let teacher_id = uid(&user.sub)?;
    let class_id = Uuid::parse_str(&payload.class_id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid class id"))?;
    let student_id = Uuid::parse_str(&payload.student_id)
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid student id"))?;

    let owns = sqlx::query("SELECT 1 AS ok FROM classes WHERE id = $1 AND teacher_id = $2")
        .bind(class_id).bind(teacher_id)
        .fetch_optional(&pool).await
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    if owns.is_none() {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Это не ваш класс"));
    }

    sqlx::query(
        "INSERT INTO a2_assignments (class_id, student_id, topics, note) VALUES ($1, $2, $3, $4)"
    )
    .bind(class_id).bind(student_id).bind(&payload.topics).bind(&payload.note)
    .execute(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
pub struct AssignmentRow { pub id: String, pub topics: Value, pub note: Option<String>, pub done: bool, pub created_at: String }

/// Назначения для текущего ученика.
pub async fn my_assignments(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let student_id = uid(&user.sub)?;
    let rows = sqlx::query(
        "SELECT id, topics, note, done, created_at FROM a2_assignments
         WHERE student_id = $1 ORDER BY done ASC, created_at DESC LIMIT 50"
    )
    .bind(student_id)
    .fetch_all(&pool).await
    .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let out: Vec<AssignmentRow> = rows.iter().map(|r| {
        let id: Uuid = r.get("id");
        let created: chrono::DateTime<chrono::Utc> = r.get("created_at");
        AssignmentRow { id: id.to_string(), topics: r.get("topics"), note: r.try_get("note").ok(), done: r.get("done"), created_at: created.to_rfc3339() }
    }).collect();
    Ok(Json(out))
}
