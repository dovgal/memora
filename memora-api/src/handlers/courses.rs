// Пользовательские курсы: создание, редактирование и публикация курсов
// по образцу встроенных (Édito A1). Юниты хранят vocabulary/exercises как JSONB
// в формате EditoUnit — фронтенд рендерит их существующим ExerciseRenderer.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::collections::{HashMap, HashSet};
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
    Uuid::parse_str(s).map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid ID format"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// Лёгкая валидация формата упражнений: массив объектов с id/type/title,
/// type — из списка, разрешённого предметным паком курса.
///
/// `allowed_types` приходит из реестра паков (`crate::subjects`). Для языковых
/// курсов это тот же набор, что был захардкожен раньше, — поведение 1:1.
fn validate_exercises(exercises: &serde_json::Value, allowed_types: &[&str]) -> ApiResult<()> {
    let arr = exercises.as_array()
        .ok_or_else(|| ApiError::response(StatusCode::BAD_REQUEST, "exercises must be a JSON array"))?;
    if arr.len() > 200 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Too many exercises in one unit (max 200)"));
    }
    for (i, ex) in arr.iter().enumerate() {
        let obj = ex.as_object()
            .ok_or_else(|| ApiError::response(StatusCode::BAD_REQUEST, format!("exercises[{i}] must be an object")))?;
        let id = obj.get("id").and_then(|v| v.as_str()).unwrap_or("");
        let ex_type = obj.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if id.is_empty() {
            return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("exercises[{i}] is missing 'id'")));
        }
        if !allowed_types.contains(&ex_type) {
            return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("exercises[{i}] has unsupported type '{ex_type}'")));
        }
    }
    Ok(())
}

fn validate_vocabulary(vocabulary: &serde_json::Value) -> ApiResult<()> {
    let arr = vocabulary.as_array()
        .ok_or_else(|| ApiError::response(StatusCode::BAD_REQUEST, "vocabulary must be a JSON array"))?;
    if arr.len() > 1000 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Too many vocabulary items (max 1000)"));
    }
    Ok(())
}

/// Резолвит предметный пак курса по его `subject`/`language` (см. `crate::subjects`).
/// Для языковых курсов набор разрешённых типов упражнений тот же, что был раньше,
/// поэтому валидация остаётся 1:1 совместимой.
async fn course_pack(pool: &PgPool, course_id: Uuid) -> ApiResult<&'static crate::subjects::SubjectPack> {
    let row = sqlx::query("SELECT subject, language FROM custom_courses WHERE id = $1")
        .bind(course_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Course not found"))?;
    let subject: String = row.get("subject");
    let language: String = row.get("language");
    Ok(crate::subjects::pack_for(&subject, Some(language.as_str())))
}

/// Проверяет, что курс существует и принадлежит пользователю.
async fn ensure_owner(pool: &PgPool, course_id: Uuid, user_id: Uuid) -> ApiResult<()> {
    let row = sqlx::query("SELECT owner_id FROM custom_courses WHERE id = $1")
        .bind(course_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?;
    match row {
        Some(r) => {
            let owner: Uuid = r.get("owner_id");
            if owner == user_id { Ok(()) } else {
                Err(ApiError::response(StatusCode::FORBIDDEN, "You are not the owner of this course"))
            }
        }
        None => Err(ApiError::response(StatusCode::NOT_FOUND, "Course not found")),
    }
}

// ---------- DTOs ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertCourseRequest {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default)]
    pub level: String,
    #[serde(default)]
    pub is_published: bool,
    /// Предметный домен курса: 'language' (по умолчанию) | 'math' | 'physics' | 'history' | …
    /// Для языковых курсов конкретный язык по-прежнему в `language`.
    #[serde(default = "default_subject")]
    pub subject: String,
}

fn default_language() -> String { "fr".to_string() }
fn default_subject() -> String { "language".to_string() }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseSummary {
    pub id: String,
    pub title: String,
    pub description: String,
    pub language: String,
    pub level: String,
    pub subject: String,
    pub is_published: bool,
    pub is_owner: bool,
    pub unit_count: i64,
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitSummary {
    pub id: String,
    pub position: i32,
    pub title: String,
    pub description: String,
    pub exercise_count: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseDetail {
    pub id: String,
    pub title: String,
    pub description: String,
    pub language: String,
    pub level: String,
    pub subject: String,
    pub is_published: bool,
    pub is_owner: bool,
    pub units: Vec<UnitSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnitDetail {
    pub id: String,
    pub course_id: String,
    pub position: i32,
    pub title: String,
    pub description: String,
    pub vocabulary: serde_json::Value,
    pub exercises: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertUnitRequest {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub position: Option<i32>,
    #[serde(default = "empty_array")]
    pub vocabulary: serde_json::Value,
    #[serde(default = "empty_array")]
    pub exercises: serde_json::Value,
}

fn empty_array() -> serde_json::Value { serde_json::Value::Array(vec![]) }

// ---------- Словарь курса («в словарь» из чтения/историй) ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddToDictionaryRequest {
    /// Слово/фраза на изучаемом языке.
    pub term: String,
    /// Перевод.
    pub definition: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddToDictionaryResponse {
    pub set_id: String,
    /// true — карточка уже была в словаре, дубль не создан.
    pub already_exists: bool,
}

/// POST /api/courses/{course_id}/dictionary
/// Добавляет слово в личный словарь курса — набор карточек «Словарь · {курс}»
/// (создаётся при первом слове). Карточки живут в обычном FSRS-цикле наборов.
pub async fn add_to_dictionary(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
    Json(payload): Json<AddToDictionaryRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let term: String = payload.term.trim().chars().take(200).collect();
    let definition: String = payload.definition.trim().chars().take(500).collect();
    if term.is_empty() || definition.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "term and definition are required"));
    }

    // Название набора: по заголовку курса (пользовательские) или по id (встроенные).
    let course_title: String = match Uuid::parse_str(&course_id) {
        Ok(cid) => sqlx::query("SELECT title FROM custom_courses WHERE id = $1")
            .bind(cid)
            .fetch_optional(&pool)
            .await
            .map_err(db_err)?
            .map(|r| r.get("title"))
            .unwrap_or_else(|| course_id.clone()),
        Err(_) => course_id.clone(),
    };
    let set_title: String = format!("Словарь · {course_title}").chars().take(120).collect();

    let mut tx = pool.begin().await.map_err(db_err)?;

    let set_id: Uuid = match sqlx::query("SELECT id FROM sets WHERE creator_id = $1 AND title = $2")
        .bind(user_id)
        .bind(&set_title)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_err)?
    {
        Some(r) => r.get("id"),
        None => {
            let r = sqlx::query(
                "INSERT INTO sets (creator_id, title, description, is_public, fields_schema)
                 VALUES ($1, $2, $3, FALSE, '[]'::jsonb) RETURNING id"
            )
            .bind(user_id)
            .bind(&set_title)
            .bind("Слова, добавленные из историй и чтения курса")
            .fetch_one(&mut *tx)
            .await
            .map_err(db_err)?;
            r.get("id")
        }
    };

    // Дубликаты не плодим: то же слово (без учёта регистра) уже в словаре — выходим тихо.
    let exists = sqlx::query("SELECT 1 AS x FROM flashcards WHERE set_id = $1 AND LOWER(term) = LOWER($2)")
        .bind(set_id)
        .bind(&term)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_err)?
        .is_some();

    if !exists {
        sqlx::query(
            "INSERT INTO flashcards (set_id, term, definition, order_index, fields_data)
             VALUES ($1, $2, $3,
                     (SELECT COALESCE(MAX(order_index) + 1, 0) FROM flashcards WHERE set_id = $1),
                     '{}'::jsonb)"
        )
        .bind(set_id)
        .bind(&term)
        .bind(&definition)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    }

    tx.commit().await.map_err(db_err)?;

    Ok((StatusCode::OK, Json(AddToDictionaryResponse {
        set_id: set_id.to_string(),
        already_exists: exists,
    })))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VocabularySetResponse {
    pub set_id: String,
    /// Сколько карточек добавлено этим вызовом (дубликаты пропущены).
    pub added: i64,
    /// Всего карточек в наборе после экспорта.
    pub total: i64,
}

/// POST /api/courses/{course_id}/vocabulary-set
/// Собирает лексику ВСЕХ юнитов курса в личный набор «Лексика · {курс}»
/// для интервального повторения. Идемпотентен: повторный вызов доливает только
/// новые слова (сравнение term без учёта регистра), прогресс FSRS не трогает.
pub async fn export_vocabulary_set(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(course_id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let cid = parse_id(&course_id)?;

    let row = sqlx::query("SELECT owner_id, title, is_published FROM custom_courses WHERE id = $1")
        .bind(cid)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Course not found"))?;
    let owner: Uuid = row.get("owner_id");
    let is_published: bool = row.get("is_published");
    if owner != user_id && !is_published {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "This course is not published"));
    }
    let course_title: String = row.get("title");
    let set_title: String = format!("Лексика · {course_title}").chars().take(120).collect();

    let unit_rows = sqlx::query(
        "SELECT vocabulary FROM custom_course_units WHERE course_id = $1 ORDER BY position ASC, created_at ASC"
    )
    .bind(cid)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    // (term, definition) в порядке юнитов; дубли между юнитами схлопываем сразу.
    let mut seen = std::collections::HashSet::new();
    let mut cards: Vec<(String, String)> = Vec::new();
    for r in unit_rows {
        let vocab: serde_json::Value = r.get("vocabulary");
        let Some(items) = vocab.as_array() else { continue };
        for item in items {
            let term = item.get("fr").and_then(|v| v.as_str()).unwrap_or("").trim();
            let ru = item.get("ru").and_then(|v| v.as_str()).unwrap_or("").trim();
            if term.is_empty() || ru.is_empty() { continue }
            // IPA-транскрипция (если есть) едет в определение — на обороте карточки.
            let ipa = item.get("ipa").and_then(|v| v.as_str()).unwrap_or("").trim();
            let definition = if ipa.is_empty() { ru.to_string() } else { format!("[{ipa}] {ru}") };
            if seen.insert(term.to_lowercase()) {
                cards.push((term.chars().take(200).collect(), definition.chars().take(500).collect()));
            }
        }
    }
    if cards.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Course has no vocabulary to export"));
    }

    let mut tx = pool.begin().await.map_err(db_err)?;

    let set_id: Uuid = match sqlx::query("SELECT id FROM sets WHERE creator_id = $1 AND title = $2")
        .bind(user_id)
        .bind(&set_title)
        .fetch_optional(&mut *tx)
        .await
        .map_err(db_err)?
    {
        Some(r) => r.get("id"),
        None => {
            let r = sqlx::query(
                "INSERT INTO sets (creator_id, title, description, is_public, fields_schema)
                 VALUES ($1, $2, $3, FALSE, '[]'::jsonb) RETURNING id"
            )
            .bind(user_id)
            .bind(&set_title)
            .bind("Слова и фразы курса — для интервального повторения")
            .fetch_one(&mut *tx)
            .await
            .map_err(db_err)?;
            r.get("id")
        }
    };

    let mut added = 0i64;
    for (term, definition) in &cards {
        let inserted = sqlx::query(
            "INSERT INTO flashcards (set_id, term, definition, order_index, fields_data)
             SELECT $1, $2, $3,
                    (SELECT COALESCE(MAX(order_index) + 1, 0) FROM flashcards WHERE set_id = $1),
                    '{}'::jsonb
             WHERE NOT EXISTS (SELECT 1 FROM flashcards WHERE set_id = $1 AND LOWER(term) = LOWER($2))"
        )
        .bind(set_id)
        .bind(term)
        .bind(definition)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
        added += inserted.rows_affected() as i64;
    }

    let total: i64 = sqlx::query("SELECT COUNT(*) AS n FROM flashcards WHERE set_id = $1")
        .bind(set_id)
        .fetch_one(&mut *tx)
        .await
        .map_err(db_err)?
        .get("n");

    tx.commit().await.map_err(db_err)?;

    Ok((StatusCode::OK, Json(VocabularySetResponse {
        set_id: set_id.to_string(),
        added,
        total,
    })))
}

// ---------- Course CRUD ----------

/// GET /api/courses — мои курсы + опубликованные курсы других пользователей.
pub async fn list_courses(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let rows = sqlx::query(
        r#"
        SELECT c.id, c.title, c.description, c.language, c.level, c.subject, c.is_published,
               c.owner_id, c.updated_at, COUNT(u.id) AS unit_count
        FROM custom_courses c
        LEFT JOIN custom_course_units u ON u.course_id = c.id
        WHERE c.owner_id = $1 OR c.is_published
        GROUP BY c.id
        ORDER BY (c.owner_id = $1) DESC, c.updated_at DESC
        "#
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let courses: Vec<CourseSummary> = rows.into_iter().map(|r| {
        let owner: Uuid = r.get("owner_id");
        let updated_at: chrono::DateTime<chrono::Utc> = r.get("updated_at");
        CourseSummary {
            id: r.get::<Uuid, _>("id").to_string(),
            title: r.get("title"),
            description: r.get("description"),
            language: r.get("language"),
            level: r.get("level"),
            subject: r.get("subject"),
            is_published: r.get("is_published"),
            is_owner: owner == user_id,
            unit_count: r.get("unit_count"),
            updated_at: updated_at.to_rfc3339(),
        }
    }).collect();

    Ok((StatusCode::OK, Json(courses)))
}

/// POST /api/courses — создать курс (любой авторизованный пользователь).
pub async fn create_course(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<UpsertCourseRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title is required"));
    }

    let row = sqlx::query(
        "INSERT INTO custom_courses (owner_id, title, description, language, level, is_published, subject)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id"
    )
    .bind(user_id)
    .bind(title)
    .bind(&payload.description)
    .bind(&payload.language)
    .bind(&payload.level)
    .bind(payload.is_published)
    .bind(&payload.subject)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    let id: Uuid = row.get("id");
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "id": id.to_string() }))))
}

/// GET /api/courses/{id} — курс с юнитами (владелец или опубликованный).
pub async fn get_course(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;

    let row = sqlx::query(
        "SELECT id, owner_id, title, description, language, level, subject, is_published
         FROM custom_courses WHERE id = $1"
    )
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Course not found"))?;

    let owner: Uuid = row.get("owner_id");
    let is_published: bool = row.get("is_published");
    let is_owner = owner == user_id;
    if !is_owner && !is_published {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "This course is not published"));
    }

    let unit_rows = sqlx::query(
        r#"
        SELECT id, position, title, description, jsonb_array_length(exercises) AS exercise_count
        FROM custom_course_units WHERE course_id = $1 ORDER BY position ASC, created_at ASC
        "#
    )
    .bind(course_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let units = unit_rows.into_iter().map(|r| UnitSummary {
        id: r.get::<Uuid, _>("id").to_string(),
        position: r.get("position"),
        title: r.get("title"),
        description: r.get("description"),
        exercise_count: r.get::<i32, _>("exercise_count") as i64,
    }).collect();

    let detail = CourseDetail {
        id: course_id.to_string(),
        title: row.get("title"),
        description: row.get("description"),
        language: row.get("language"),
        level: row.get("level"),
        subject: row.get("subject"),
        is_published,
        is_owner,
        units,
    };

    Ok((StatusCode::OK, Json(detail)))
}

/// PUT /api/courses/{id} — обновить метаданные курса (только владелец).
pub async fn update_course(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
    Json(payload): Json<UpsertCourseRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    ensure_owner(&pool, course_id, user_id).await?;

    let title = payload.title.trim();
    if title.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title is required"));
    }

    sqlx::query(
        "UPDATE custom_courses SET title = $1, description = $2, language = $3, level = $4,
         is_published = $5, subject = $6, updated_at = NOW() WHERE id = $7"
    )
    .bind(title)
    .bind(&payload.description)
    .bind(&payload.language)
    .bind(&payload.level)
    .bind(payload.is_published)
    .bind(&payload.subject)
    .bind(course_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/courses/{id} — удалить курс (только владелец).
pub async fn delete_course(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    ensure_owner(&pool, course_id, user_id).await?;

    sqlx::query("DELETE FROM custom_courses WHERE id = $1")
        .bind(course_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------- Unit CRUD ----------

/// POST /api/courses/{id}/units — добавить юнит.
pub async fn create_unit(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<String>,
    Json(payload): Json<UpsertUnitRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    ensure_owner(&pool, course_id, user_id).await?;
    let pack = course_pack(&pool, course_id).await?;
    validate_vocabulary(&payload.vocabulary)?;
    validate_exercises(&payload.exercises, pack.allowed_types)?;

    let title = payload.title.trim();
    if title.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title is required"));
    }

    // position: либо переданная, либо в конец
    let position = match payload.position {
        Some(p) => p,
        None => {
            let row = sqlx::query("SELECT COALESCE(MAX(position) + 1, 0) AS next FROM custom_course_units WHERE course_id = $1")
                .bind(course_id)
                .fetch_one(&pool)
                .await
                .map_err(db_err)?;
            row.get::<i32, _>("next")
        }
    };

    let row = sqlx::query(
        "INSERT INTO custom_course_units (course_id, position, title, description, vocabulary, exercises)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id"
    )
    .bind(course_id)
    .bind(position)
    .bind(title)
    .bind(&payload.description)
    .bind(&payload.vocabulary)
    .bind(&payload.exercises)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;

    sqlx::query("UPDATE custom_courses SET updated_at = NOW() WHERE id = $1")
        .bind(course_id).execute(&pool).await.map_err(db_err)?;

    let unit_id: Uuid = row.get("id");
    Ok((StatusCode::CREATED, Json(serde_json::json!({ "id": unit_id.to_string() }))))
}

/// GET /api/courses/{id}/units/{unit_id} — юнит целиком (контент).
pub async fn get_unit(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, unit_id)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    let unit_uuid = parse_id(&unit_id)?;

    // Доступ: владелец или опубликованный курс
    let course = sqlx::query("SELECT owner_id, is_published FROM custom_courses WHERE id = $1")
        .bind(course_id)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Course not found"))?;
    let owner: Uuid = course.get("owner_id");
    let is_published: bool = course.get("is_published");
    if owner != user_id && !is_published {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "This course is not published"));
    }

    let row = sqlx::query(
        "SELECT id, course_id, position, title, description, vocabulary, exercises
         FROM custom_course_units WHERE id = $1 AND course_id = $2"
    )
    .bind(unit_uuid)
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Unit not found"))?;

    let detail = UnitDetail {
        id: row.get::<Uuid, _>("id").to_string(),
        course_id: row.get::<Uuid, _>("course_id").to_string(),
        position: row.get("position"),
        title: row.get("title"),
        description: row.get("description"),
        vocabulary: row.get("vocabulary"),
        exercises: row.get("exercises"),
    };

    Ok((StatusCode::OK, Json(detail)))
}

// ---------- Перевод юнита на язык интерфейса ----------

/// Ключи, значения которых — человекочитаемый текст, подлежащий переводу.
/// Намеренно НЕ переводим: id/type/skill/level; `sentence`/`correction`
/// (error-hunt/dictée зависят от индекса слова — перевод сломал бы `errorIndex`);
/// `fr`/`ipa`/`article`/`emoji`/`french`/`words` (изучаемый язык, не подписи).
const TRANSLATABLE_KEYS: &[&str] = &[
    "title", "description", "content", "question", "correctAnswer",
    "explanation", "text", "context", "prompt", "hint", "ru", "speaker",
];

/// Собирает уникальные переводимые строки в порядке первого появления.
/// Дедупликация гарантирует консистентность ответа: `correctAnswer` и
/// совпадающий с ним вариант `options` получают ОДИН перевод.
fn collect_translatable(v: &serde_json::Value, key: Option<&str>, seen: &mut HashSet<String>, out: &mut Vec<String>) {
    match v {
        serde_json::Value::String(s) => {
            if let Some(k) = key
                && TRANSLATABLE_KEYS.contains(&k)
                && !s.trim().is_empty()
                && seen.insert(s.clone())
            {
                out.push(s.clone());
            }
        }
        serde_json::Value::Array(arr) => {
            if key == Some("options") {
                for e in arr {
                    if let serde_json::Value::String(s) = e
                        && !s.trim().is_empty()
                        && seen.insert(s.clone())
                    {
                        out.push(s.clone());
                    }
                }
            } else {
                for e in arr {
                    collect_translatable(e, None, seen, out);
                }
            }
        }
        serde_json::Value::Object(map) => {
            for (k, val) in map {
                collect_translatable(val, Some(k.as_str()), seen, out);
            }
        }
        _ => {}
    }
}

/// Заменяет переводимые строки по словарю (тот же обход, что и сбор).
fn replace_translatable(v: &mut serde_json::Value, key: Option<&str>, dict: &HashMap<String, String>) {
    match v {
        serde_json::Value::String(s) => {
            if let Some(k) = key
                && TRANSLATABLE_KEYS.contains(&k)
                && let Some(t) = dict.get(s)
            {
                *s = t.clone();
            }
        }
        serde_json::Value::Array(arr) => {
            if key == Some("options") {
                for e in arr.iter_mut() {
                    if let serde_json::Value::String(s) = e
                        && let Some(t) = dict.get(s)
                    {
                        *s = t.clone();
                    }
                }
            } else {
                for e in arr.iter_mut() {
                    replace_translatable(e, None, dict);
                }
            }
        }
        serde_json::Value::Object(map) => {
            for (_k, val) in map.iter_mut() {
                let k = _k.clone();
                replace_translatable(val, Some(k.as_str()), dict);
            }
        }
        _ => {}
    }
}

fn short_hash(s: &str) -> String {
    use sha2::{Digest, Sha256};
    let digest = Sha256::digest(s.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Deserialize)]
pub struct TranslateQuery {
    #[serde(default = "default_lang")]
    pub lang: String,
}
fn default_lang() -> String { "fr".to_string() }

/// GET /api/courses/{id}/units/{unit_id}/translated?lang=fr
/// Возвращает юнит, где все подписи/объяснения/вопросы переведены на `lang`
/// силами LLM. Результат кэшируется в `unit_translations` (инвалидация по
/// хешу исходного контента). Изучаемый язык (fr-термины, error-hunt) не трогаем.
pub async fn get_unit_translated(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, unit_id)): Path<(String, String)>,
    Query(q): Query<TranslateQuery>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    let unit_uuid = parse_id(&unit_id)?;
    let lang: String = q.lang.trim().to_lowercase().chars().take(8).collect();
    if lang.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "lang is required"));
    }

    let course = sqlx::query("SELECT owner_id, is_published FROM custom_courses WHERE id = $1")
        .bind(course_id)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Course not found"))?;
    let owner: Uuid = course.get("owner_id");
    let is_published: bool = course.get("is_published");
    if owner != user_id && !is_published {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "This course is not published"));
    }

    let row = sqlx::query(
        "SELECT id, course_id, position, title, description, vocabulary, exercises
         FROM custom_course_units WHERE id = $1 AND course_id = $2"
    )
    .bind(unit_uuid)
    .bind(course_id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Unit not found"))?;

    let position: i32 = row.get("position");
    let course_id_str = row.get::<Uuid, _>("course_id").to_string();
    let id_str = row.get::<Uuid, _>("id").to_string();

    // Исходный переводимый payload (без служебных id/position).
    let source = serde_json::json!({
        "title": row.get::<String, _>("title"),
        "description": row.get::<String, _>("description"),
        "vocabulary": row.get::<serde_json::Value, _>("vocabulary"),
        "exercises": row.get::<serde_json::Value, _>("exercises"),
    });
    let src_hash = short_hash(&format!("{lang}:{source}"));

    // Кэш?
    let cached = sqlx::query("SELECT src_hash, payload FROM unit_translations WHERE unit_id = $1 AND lang = $2")
        .bind(unit_uuid)
        .bind(&lang)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?;

    let translated: serde_json::Value = if let Some(c) = cached.filter(|c| c.get::<String, _>("src_hash") == src_hash) {
        c.get("payload")
    } else {
        let mut seen = HashSet::new();
        let mut strings = Vec::new();
        collect_translatable(&source, None, &mut seen, &mut strings);

        let payload = if strings.is_empty() {
            source.clone()
        } else {
            let dict = translate_strings(&strings, &lang).await?;
            let mut out = source.clone();
            replace_translatable(&mut out, None, &dict);
            out
        };

        sqlx::query(
            "INSERT INTO unit_translations (unit_id, lang, src_hash, payload) VALUES ($1,$2,$3,$4)
             ON CONFLICT (unit_id, lang) DO UPDATE SET src_hash = $3, payload = $4, created_at = NOW()"
        )
        .bind(unit_uuid)
        .bind(&lang)
        .bind(&src_hash)
        .bind(&payload)
        .execute(&pool)
        .await
        .map_err(db_err)?;
        payload
    };

    let detail = UnitDetail {
        id: id_str,
        course_id: course_id_str,
        position,
        title: translated.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        description: translated.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        vocabulary: translated.get("vocabulary").cloned().unwrap_or_else(|| serde_json::json!([])),
        exercises: translated.get("exercises").cloned().unwrap_or_else(|| serde_json::json!([])),
    };
    Ok((StatusCode::OK, Json(detail)))
}

/// Переводит список уникальных строк на `lang` через LLM, возвращает словарь
/// исходная → перевод. HTML-теги и плейсхолдеры `___` сохраняются.
async fn translate_strings(strings: &[String], lang: &str) -> ApiResult<HashMap<String, String>> {
    let lang_name = match lang {
        "fr" => "French", "en" => "English", "de" => "German",
        "es" => "Spanish", "ru" => "Russian", other => other,
    };
    let input = serde_json::to_string(strings)
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("serialize: {e}")))?;

    let system = format!(
        "You are a professional translator for an educational app. You receive a JSON array of strings and translate each into {lang_name}. \
         Rules: (1) Return ONLY a JSON object of the form {{\"t\": [...]}} whose array has EXACTLY the same length and order as the input array. \
         (2) Preserve all HTML tags, attributes and inline styles untouched — translate only the visible text between tags. \
         (3) Preserve every '___' placeholder exactly (same count and position). \
         (4) Keep proper nouns, dates, numbers, phonetic transcriptions in [brackets], and text already in {lang_name} unchanged. \
         (5) Natural, correct {lang_name}. Do not add or remove array elements."
    );
    let user = format!("Input array to translate into {lang_name}:\n{input}");

    let content = crate::handlers::ai::llm_translate(
        vec![crate::llm::ChatMessage::system(system), crate::llm::ChatMessage::user(user)],
    ).await.map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Translation failed: {e}")))?;

    let parsed: serde_json::Value = serde_json::from_str(crate::handlers::ai::extract_json(&content))
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Translation parse error: {e}")))?;
    let arr = parsed.get("t").and_then(|v| v.as_array())
        .ok_or_else(|| ApiError::response(StatusCode::BAD_GATEWAY, "Translation: missing 't' array"))?;

    // Сопоставляем по индексу; при расхождении длины оставляем оригинал.
    let mut dict = HashMap::new();
    for (i, orig) in strings.iter().enumerate() {
        if let Some(t) = arr.get(i).and_then(|v| v.as_str()) {
            dict.insert(orig.clone(), t.to_string());
        }
    }
    Ok(dict)
}

/// PUT /api/courses/{id}/units/{unit_id} — обновить юнит (только владелец).
pub async fn update_unit(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, unit_id)): Path<(String, String)>,
    Json(payload): Json<UpsertUnitRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    let unit_uuid = parse_id(&unit_id)?;
    ensure_owner(&pool, course_id, user_id).await?;
    let pack = course_pack(&pool, course_id).await?;
    validate_vocabulary(&payload.vocabulary)?;
    validate_exercises(&payload.exercises, pack.allowed_types)?;

    let title = payload.title.trim();
    if title.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title is required"));
    }

    let result = sqlx::query(
        "UPDATE custom_course_units SET title = $1, description = $2,
         position = COALESCE($3, position), vocabulary = $4, exercises = $5, updated_at = NOW()
         WHERE id = $6 AND course_id = $7"
    )
    .bind(title)
    .bind(&payload.description)
    .bind(payload.position)
    .bind(&payload.vocabulary)
    .bind(&payload.exercises)
    .bind(unit_uuid)
    .bind(course_id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    if result.rows_affected() == 0 {
        return Err(ApiError::response(StatusCode::NOT_FOUND, "Unit not found"));
    }

    sqlx::query("UPDATE custom_courses SET updated_at = NOW() WHERE id = $1")
        .bind(course_id).execute(&pool).await.map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}

/// DELETE /api/courses/{id}/units/{unit_id} — удалить юнит (только владелец).
pub async fn delete_unit(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, unit_id)): Path<(String, String)>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let course_id = parse_id(&id)?;
    let unit_uuid = parse_id(&unit_id)?;
    ensure_owner(&pool, course_id, user_id).await?;

    sqlx::query("DELETE FROM custom_course_units WHERE id = $1 AND course_id = $2")
        .bind(unit_uuid)
        .bind(course_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}
