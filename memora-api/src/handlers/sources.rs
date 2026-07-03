// Источники («учебники»): загруженные владельцем тексты, порезанные на главы.
// Используются как грунт для генерации юнитов (generate_course_unit.source_text).
// Текст извлекается на клиенте (pdf.js); сервер хранит, ищет и отдаёт фрагменты.

use axum::{
    extract::{Path, Query, State},
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
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

async fn ensure_owner(pool: &PgPool, document_id: Uuid, user_id: Uuid) -> ApiResult<()> {
    let row = sqlx::query("SELECT owner_id FROM source_documents WHERE id = $1")
        .bind(document_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Source not found"))?;
    let owner: Uuid = row.get("owner_id");
    if owner != user_id {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "You are not the owner of this source"));
    }
    Ok(())
}

// ---------- DTOs ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkIn {
    #[serde(default)]
    pub title: String,
    pub content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSourceRequest {
    pub title: String,
    #[serde(default = "default_language")]
    pub language: String,
    pub chunks: Vec<ChunkIn>,
}

fn default_language() -> String { "fr".to_string() }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDocumentSummary {
    pub id: String,
    pub title: String,
    pub language: String,
    pub chunk_count: i32,
    pub created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceChunkSummary {
    pub id: String,
    pub position: i32,
    pub title: String,
    /// Размер фрагмента в символах — чтобы UI показывал масштаб без скачивания текста.
    pub chars: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDetail {
    pub document: SourceDocumentSummary,
    pub chunks: Vec<SourceChunkSummary>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub chunk_id: String,
    pub document_id: String,
    pub document_title: String,
    pub chunk_title: String,
    pub position: i32,
    /// Фрагменты с подсветкой совпадений (<b>…</b>).
    pub headline: String,
}

// ---------- Handlers ----------

const MAX_CHUNKS: usize = 300;
const MAX_CHUNK_CHARS: usize = 20_000;
const MAX_TOTAL_CHARS: usize = 3_000_000;

/// POST /api/sources — загрузить источник (текст уже порезан клиентом на главы).
pub async fn upload_source(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<UploadSourceRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let title = payload.title.trim();
    if title.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title is required"));
    }
    if payload.chunks.is_empty() || payload.chunks.len() > MAX_CHUNKS {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("Chunks: 1..{MAX_CHUNKS}")));
    }
    let mut total = 0usize;
    for (i, c) in payload.chunks.iter().enumerate() {
        let len = c.content.chars().count();
        if len == 0 || len > MAX_CHUNK_CHARS {
            return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("chunks[{i}]: content must be 1..{MAX_CHUNK_CHARS} chars")));
        }
        total += len;
    }
    if total > MAX_TOTAL_CHARS {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Source is too large"));
    }

    let mut tx = pool.begin().await.map_err(db_err)?;
    let row = sqlx::query(
        "INSERT INTO source_documents (owner_id, title, language, chunk_count)
         VALUES ($1, $2, $3, $4) RETURNING id"
    )
    .bind(user_id)
    .bind(title)
    .bind(&payload.language)
    .bind(payload.chunks.len() as i32)
    .fetch_one(&mut *tx)
    .await
    .map_err(db_err)?;
    let document_id: Uuid = row.get("id");

    for (i, c) in payload.chunks.iter().enumerate() {
        sqlx::query(
            "INSERT INTO source_chunks (document_id, position, title, content) VALUES ($1, $2, $3, $4)"
        )
        .bind(document_id)
        .bind(i as i32)
        .bind(c.title.trim())
        .bind(c.content.trim())
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    }
    tx.commit().await.map_err(db_err)?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({ "id": document_id.to_string() }))))
}

/// GET /api/sources — источники владельца.
pub async fn list_sources(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let rows = sqlx::query(
        "SELECT id, title, language, chunk_count, created_at
         FROM source_documents WHERE owner_id = $1
         ORDER BY created_at DESC"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let docs: Vec<SourceDocumentSummary> = rows.into_iter().map(|r| {
        let created_at: chrono::DateTime<chrono::Utc> = r.get("created_at");
        SourceDocumentSummary {
            id: r.get::<Uuid, _>("id").to_string(),
            title: r.get("title"),
            language: r.get("language"),
            chunk_count: r.get("chunk_count"),
            created_at: created_at.to_rfc3339(),
        }
    }).collect();

    Ok((StatusCode::OK, Json(docs)))
}

/// GET /api/sources/{id} — документ со списком глав (без полного текста).
pub async fn get_source(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    ensure_owner(&pool, id, user_id).await?;

    let doc_row = sqlx::query(
        "SELECT id, title, language, chunk_count, created_at FROM source_documents WHERE id = $1"
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;
    let created_at: chrono::DateTime<chrono::Utc> = doc_row.get("created_at");

    let chunk_rows = sqlx::query(
        "SELECT id, position, title, LENGTH(content) AS chars
         FROM source_chunks WHERE document_id = $1 ORDER BY position ASC"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let detail = SourceDetail {
        document: SourceDocumentSummary {
            id: id.to_string(),
            title: doc_row.get("title"),
            language: doc_row.get("language"),
            chunk_count: doc_row.get("chunk_count"),
            created_at: created_at.to_rfc3339(),
        },
        chunks: chunk_rows.into_iter().map(|r| SourceChunkSummary {
            id: r.get::<Uuid, _>("id").to_string(),
            position: r.get("position"),
            title: r.get("title"),
            chars: r.get("chars"),
        }).collect(),
    };

    Ok((StatusCode::OK, Json(detail)))
}

/// GET /api/sources/{id}/chunks/{chunk_id} — полный текст главы.
pub async fn get_chunk(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, chunk_id)): Path<(Uuid, Uuid)>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    ensure_owner(&pool, id, user_id).await?;

    let row = sqlx::query(
        "SELECT title, content FROM source_chunks WHERE id = $1 AND document_id = $2"
    )
    .bind(chunk_id)
    .bind(id)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Chunk not found"))?;

    Ok((StatusCode::OK, Json(serde_json::json!({
        "title": row.get::<String, _>("title"),
        "content": row.get::<String, _>("content"),
    }))))
}

/// DELETE /api/sources/{id}.
pub async fn delete_source(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    ensure_owner(&pool, id, user_id).await?;
    sqlx::query("DELETE FROM source_documents WHERE id = $1")
        .bind(id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

/// GET /api/sources/search?q=… — полнотекстовый поиск по главам всех источников
/// владельца (конфиг 'french'). Возвращает топ-8 с подсветкой совпадений.
pub async fn search_sources(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<SearchQuery>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let needle = q.q.trim();
    if needle.is_empty() || needle.chars().count() > 200 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "q must be 1..200 chars"));
    }

    let rows = sqlx::query(
        "SELECT c.id AS chunk_id, c.title AS chunk_title, c.position,
                d.id AS document_id, d.title AS document_title,
                ts_headline('french', LEFT(c.content, 4000), plainto_tsquery('french', $2),
                            'MaxFragments=2, MaxWords=18, MinWords=6') AS headline
         FROM source_chunks c
         JOIN source_documents d ON d.id = c.document_id
         WHERE d.owner_id = $1 AND c.tsv @@ plainto_tsquery('french', $2)
         ORDER BY ts_rank(c.tsv, plainto_tsquery('french', $2)) DESC
         LIMIT 8"
    )
    .bind(user_id)
    .bind(needle)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let hits: Vec<SearchHit> = rows.into_iter().map(|r| SearchHit {
        chunk_id: r.get::<Uuid, _>("chunk_id").to_string(),
        document_id: r.get::<Uuid, _>("document_id").to_string(),
        document_title: r.get("document_title"),
        chunk_title: r.get("chunk_title"),
        position: r.get("position"),
        headline: r.get("headline"),
    }).collect();

    Ok((StatusCode::OK, Json(hits)))
}
