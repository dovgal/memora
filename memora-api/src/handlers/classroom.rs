// Классы v2 — универсальный «класс» для любых курсов платформы:
// списки классов (преподаю / учусь), участники, задания (всему классу или ученику),
// отметки о выполнении, лента сообщений и подписки на курсы.

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
fn parse_id(s: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(s).map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid ID"))
}
fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// teacher | member | none
async fn class_role(pool: &PgPool, class_id: Uuid, user_id: Uuid) -> ApiResult<&'static str> {
    let t = sqlx::query("SELECT 1 AS ok FROM classes WHERE id = $1 AND teacher_id = $2")
        .bind(class_id).bind(user_id).fetch_optional(pool).await.map_err(db_err)?;
    if t.is_some() { return Ok("teacher"); }
    let m = sqlx::query("SELECT 1 AS ok FROM class_members WHERE class_id = $1 AND user_id = $2")
        .bind(class_id).bind(user_id).fetch_optional(pool).await.map_err(db_err)?;
    if m.is_some() { return Ok("member"); }
    Ok("none")
}

// ───────── Мои классы (обе роли) ─────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassSummary {
    pub id: String,
    pub name: String,
    pub join_code: Option<String>, // только для преподавателя
    pub members: i64,
    pub teacher_name: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MyClassesResponse {
    pub teaching: Vec<ClassSummary>,
    pub enrolled: Vec<ClassSummary>,
}

/// GET /api/classes/mine
pub async fn my_classes_all(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;

    let teach = sqlx::query(
        "SELECT c.id, c.name, c.join_code, COUNT(cm.user_id) AS members
         FROM classes c LEFT JOIN class_members cm ON cm.class_id = c.id
         WHERE c.teacher_id = $1 GROUP BY c.id ORDER BY c.created_at DESC"
    ).bind(user_id).fetch_all(&pool).await.map_err(db_err)?;

    let enr = sqlx::query(
        "SELECT c.id, c.name, u.email AS teacher_name,
                (SELECT COUNT(*) FROM class_members m2 WHERE m2.class_id = c.id) AS members
         FROM class_members cm
         JOIN classes c ON c.id = cm.class_id
         JOIN users u ON u.id = c.teacher_id
         WHERE cm.user_id = $1 ORDER BY cm.joined_at DESC NULLS LAST"
    ).bind(user_id).fetch_all(&pool).await.map_err(db_err)?;

    let teaching = teach.iter().map(|r| ClassSummary {
        id: r.get::<Uuid,_>("id").to_string(),
        name: r.get("name"),
        join_code: Some(r.get("join_code")),
        members: r.get("members"),
        teacher_name: None,
    }).collect();
    let enrolled = enr.iter().map(|r| ClassSummary {
        id: r.get::<Uuid,_>("id").to_string(),
        name: r.get("name"),
        join_code: None,
        members: r.get("members"),
        teacher_name: Some(r.get("teacher_name")),
    }).collect();

    Ok(Json(MyClassesResponse { teaching, enrolled }))
}

// ───────── Детали класса ─────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MemberRow { pub user_id: String, pub name: String, pub xp: i32 }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassDetail {
    pub id: String,
    pub name: String,
    pub my_role: String,
    pub join_code: Option<String>,
    pub members: Vec<MemberRow>,
}

/// GET /api/classes/{id}/detail
pub async fn class_detail(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let class_id = parse_id(&id)?;
    let role = class_role(&pool, class_id, user_id).await?;
    if role == "none" {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Вы не состоите в этом классе"));
    }

    let c = sqlx::query("SELECT name, join_code FROM classes WHERE id = $1")
        .bind(class_id).fetch_one(&pool).await.map_err(db_err)?;

    let rows = sqlx::query(
        "SELECT cm.user_id, COALESCE(cm.display_name, u.email) AS name, COALESCE(x.xp, 0) AS xp
         FROM class_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN a2_xp x ON x.user_id = cm.user_id
         WHERE cm.class_id = $1 ORDER BY name"
    ).bind(class_id).fetch_all(&pool).await.map_err(db_err)?;

    let members = rows.iter().map(|r| MemberRow {
        user_id: r.get::<Uuid,_>("user_id").to_string(),
        name: r.get("name"),
        xp: r.get("xp"),
    }).collect();

    Ok(Json(ClassDetail {
        id: class_id.to_string(),
        name: c.get("name"),
        my_role: role.to_string(),
        join_code: if role == "teacher" { Some(c.get("join_code")) } else { None },
        members,
    }))
}

// ───────── Задания ─────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAssignmentRequest {
    pub title: String,
    #[serde(default)]
    pub description: String,
    pub student_id: Option<String>, // None = всему классу
    pub course_href: Option<String>,
    pub due_date: Option<String>,   // YYYY-MM-DD
}

/// POST /api/classes/{id}/assignments (только преподаватель)
pub async fn create_class_assignment(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
    Json(payload): Json<CreateAssignmentRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let class_id = parse_id(&id)?;
    if class_role(&pool, class_id, user_id).await? != "teacher" {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Только преподаватель класса может выдавать задания"));
    }
    if payload.title.trim().is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title is required"));
    }
    let student_id: Option<Uuid> = match &payload.student_id {
        Some(s) => Some(parse_id(s)?),
        None => None,
    };
    let due: Option<chrono::NaiveDate> = match &payload.due_date {
        Some(d) if !d.is_empty() => Some(chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d")
            .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "due_date must be YYYY-MM-DD"))?),
        _ => None,
    };

    sqlx::query(
        "INSERT INTO class_assignments (class_id, student_id, title, description, course_href, due_date)
         VALUES ($1, $2, $3, $4, $5, $6)"
    )
    .bind(class_id).bind(student_id).bind(payload.title.trim())
    .bind(&payload.description).bind(&payload.course_href).bind(due)
    .execute(&pool).await.map_err(db_err)?;

    Ok(StatusCode::CREATED)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssignmentItem {
    pub id: String,
    pub title: String,
    pub description: String,
    pub course_href: Option<String>,
    pub due_date: Option<String>,
    pub for_whole_class: bool,
    pub student_name: Option<String>,
    pub done: bool,           // для ученика — моя отметка
    pub done_count: i64,      // для преподавателя — сколько выполнили
    pub created_at: String,
}

/// GET /api/classes/{id}/assignments
pub async fn list_class_assignments(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let class_id = parse_id(&id)?;
    let role = class_role(&pool, class_id, user_id).await?;
    if role == "none" {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Вы не состоите в этом классе"));
    }

    let rows = if role == "teacher" {
        sqlx::query(
            "SELECT a.id, a.title, a.description, a.course_href, a.due_date, a.student_id, a.created_at,
                    u.email AS student_name,
                    (SELECT COUNT(*) FROM class_assignment_done d WHERE d.assignment_id = a.id) AS done_count
             FROM class_assignments a
             LEFT JOIN users u ON u.id = a.student_id
             WHERE a.class_id = $1
             ORDER BY a.created_at DESC LIMIT 100"
        ).bind(class_id).fetch_all(&pool).await.map_err(db_err)?
    } else {
        sqlx::query(
            "SELECT a.id, a.title, a.description, a.course_href, a.due_date, a.student_id, a.created_at,
                    NULL AS student_name,
                    (SELECT COUNT(*) FROM class_assignment_done d WHERE d.assignment_id = a.id AND d.user_id = $2) AS done_count
             FROM class_assignments a
             WHERE a.class_id = $1 AND (a.student_id IS NULL OR a.student_id = $2)
             ORDER BY a.created_at DESC LIMIT 100"
        ).bind(class_id).bind(user_id).fetch_all(&pool).await.map_err(db_err)?
    };

    let out: Vec<AssignmentItem> = rows.iter().map(|r| {
        let student_id: Option<Uuid> = r.try_get("student_id").ok();
        let due: Option<chrono::NaiveDate> = r.try_get("due_date").ok();
        let created: chrono::DateTime<chrono::Utc> = r.get("created_at");
        let done_count: i64 = r.get("done_count");
        AssignmentItem {
            id: r.get::<Uuid,_>("id").to_string(),
            title: r.get("title"),
            description: r.get("description"),
            course_href: r.try_get("course_href").ok(),
            due_date: due.map(|d| d.to_string()),
            for_whole_class: student_id.is_none(),
            student_name: r.try_get("student_name").ok(),
            done: role != "teacher" && done_count > 0,
            done_count,
            created_at: created.to_rfc3339(),
        }
    }).collect();

    Ok(Json(out))
}

/// POST /api/assignments/{id}/done — ученик отмечает выполнение.
pub async fn mark_assignment_done(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let assignment_id = parse_id(&id)?;

    // Доступ: задание адресовано мне или моему классу.
    let row = sqlx::query(
        "SELECT a.class_id, a.student_id FROM class_assignments a WHERE a.id = $1"
    ).bind(assignment_id).fetch_optional(&pool).await.map_err(db_err)?
     .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Задание не найдено"))?;
    let class_id: Uuid = row.get("class_id");
    let target: Option<Uuid> = row.try_get("student_id").ok().flatten();
    let role = class_role(&pool, class_id, user_id).await?;
    let allowed = match target {
        Some(sid) => sid == user_id,
        None => role == "member",
    };
    if !allowed {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Это задание не для вас"));
    }

    sqlx::query(
        "INSERT INTO class_assignment_done (assignment_id, user_id) VALUES ($1, $2)
         ON CONFLICT (assignment_id, user_id) DO NOTHING"
    ).bind(assignment_id).bind(user_id).execute(&pool).await.map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}

// ───────── Сообщения класса ─────────

#[derive(Deserialize)]
pub struct PostMessageRequest { pub body: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageItem {
    pub id: String,
    pub author: String,
    pub is_teacher: bool,
    pub mine: bool,
    pub body: String,
    pub created_at: String,
}

/// GET /api/classes/{id}/messages
pub async fn list_class_messages(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let class_id = parse_id(&id)?;
    if class_role(&pool, class_id, user_id).await? == "none" {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Вы не состоите в этом классе"));
    }

    let rows = sqlx::query(
        "SELECT m.id, m.user_id, m.body, m.created_at,
                COALESCE(cm.display_name, u.email) AS author,
                (c.teacher_id = m.user_id) AS is_teacher
         FROM class_messages m
         JOIN classes c ON c.id = m.class_id
         JOIN users u ON u.id = m.user_id
         LEFT JOIN class_members cm ON cm.class_id = m.class_id AND cm.user_id = m.user_id
         WHERE m.class_id = $1
         ORDER BY m.created_at DESC LIMIT 100"
    ).bind(class_id).fetch_all(&pool).await.map_err(db_err)?;

    let out: Vec<MessageItem> = rows.iter().map(|r| {
        let author_id: Uuid = r.get("user_id");
        let created: chrono::DateTime<chrono::Utc> = r.get("created_at");
        MessageItem {
            id: r.get::<Uuid,_>("id").to_string(),
            author: r.get("author"),
            is_teacher: r.get("is_teacher"),
            mine: author_id == user_id,
            body: r.get("body"),
            created_at: created.to_rfc3339(),
        }
    }).collect();

    Ok(Json(out))
}

/// POST /api/classes/{id}/messages
pub async fn post_class_message(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
    Json(payload): Json<PostMessageRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let class_id = parse_id(&id)?;
    if class_role(&pool, class_id, user_id).await? == "none" {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Вы не состоите в этом классе"));
    }
    let body = payload.body.trim();
    if body.is_empty() || body.chars().count() > 2000 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Сообщение пустое или слишком длинное"));
    }

    sqlx::query("INSERT INTO class_messages (class_id, user_id, body) VALUES ($1, $2, $3)")
        .bind(class_id).bind(user_id).bind(body)
        .execute(&pool).await.map_err(db_err)?;

    Ok(StatusCode::CREATED)
}

// ───────── Подписки на курсы ─────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeRequest { pub course_id: String, pub title: String, pub href: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionItem { pub course_id: String, pub title: String, pub href: String }

/// GET /api/subscriptions
pub async fn list_subscriptions(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let rows = sqlx::query(
        "SELECT course_id, title, href FROM user_course_subscriptions
         WHERE user_id = $1 ORDER BY added_at DESC"
    ).bind(user_id).fetch_all(&pool).await.map_err(db_err)?;
    let out: Vec<SubscriptionItem> = rows.iter().map(|r| SubscriptionItem {
        course_id: r.get("course_id"), title: r.get("title"), href: r.get("href"),
    }).collect();
    Ok(Json(out))
}

/// POST /api/subscriptions
pub async fn add_subscription(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<SubscribeRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if payload.course_id.is_empty() || payload.title.is_empty() || !payload.href.starts_with('/') {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Invalid subscription"));
    }
    sqlx::query(
        "INSERT INTO user_course_subscriptions (user_id, course_id, title, href)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, course_id) DO UPDATE SET title = EXCLUDED.title, href = EXCLUDED.href"
    )
    .bind(user_id).bind(&payload.course_id).bind(&payload.title).bind(&payload.href)
    .execute(&pool).await.map_err(db_err)?;
    Ok(StatusCode::CREATED)
}

/// DELETE /api/subscriptions/{course_id}
pub async fn remove_subscription(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    sqlx::query("DELETE FROM user_course_subscriptions WHERE user_id = $1 AND course_id = $2")
        .bind(user_id).bind(&course_id)
        .execute(&pool).await.map_err(db_err)?;
    Ok(StatusCode::NO_CONTENT)
}
