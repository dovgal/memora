// Читалка: книги владельца, главы, словарь читателя и карточки из книги.
//
// Текст извлекается на клиенте (pdf.js / mammoth / JSZip / DOMParser) — как и у
// источников: парсеры EPUB и PDF в Rust-образе не нужны. Главы приходят пачками:
// целая книга одним запросом не пролезает через 30-секундный прокси Railway,
// а построчная вставка тонет на первой же сотне глав — поэтому UNNEST.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;
use super::translate;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

const MAX_CHAPTERS: usize = 3_000;
const MAX_CHAPTER_CHARS: usize = 400_000;
const MAX_BATCH: usize = 60;

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// Книга и тот, кто её загрузил. Полка общая: читать может любой вошедший,
/// поэтому проверка на владельца отделена от простого чтения.
async fn readable_book(pool: &PgPool, book_id: Uuid) -> ApiResult<(String, Uuid)> {
    let row = sqlx::query("SELECT owner_id, language FROM books WHERE id = $1")
        .bind(book_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Book not found"))?;
    Ok((row.get::<String, _>("language"), row.get::<Uuid, _>("owner_id")))
}

/// Для изменения самой книги: название, автора, тему правит только загрузивший.
async fn owned_book(pool: &PgPool, book_id: Uuid, user_id: Uuid) -> ApiResult<String> {
    let (language, owner) = readable_book(pool, book_id).await?;
    if owner != user_id {
        return Err(ApiError::response(
            StatusCode::FORBIDDEN,
            "Книгу может изменить только тот, кто её загрузил",
        ));
    }
    Ok(language)
}

// ---------- DTO ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBookRequest {
    pub title: String,
    #[serde(default)]
    pub author: String,
    /// Рубрика полки. Пусто — определит модель вместе с языком.
    #[serde(default)]
    pub topic: String,
    /// Пусто — язык определит ИИ после загрузки глав.
    #[serde(default)]
    pub language: String,
    #[serde(default)]
    pub target_language: String,
    #[serde(default)]
    pub source_format: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterIn {
    pub position: i32,
    #[serde(default)]
    pub title: String,
    pub content: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChaptersRequest {
    pub chapters: Vec<ChapterIn>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBookRequest {
    pub title: Option<String>,
    /// Уровень адаптации при чтении: пусто — оригинал.
    pub level: Option<String>,
    pub author: Option<String>,
    pub topic: Option<String>,
    pub language: Option<String>,
    pub target_language: Option<String>,
    pub last_chapter: Option<i32>,
    pub last_offset: Option<f32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookSummary {
    pub id: String,
    pub title: String,
    pub author: String,
    /// Рубрика для полки: «Классика», «История», «Наука»…
    pub topic: String,
    pub language: String,
    pub target_language: String,
    /// Уровень адаптации, выбранный этим читателем.
    pub level: String,
    pub source_format: String,
    pub chapter_count: i32,
    pub word_count: i32,
    pub set_id: Option<String>,
    pub last_chapter: i32,
    pub last_offset: f32,
    pub status: String,
    /// Загрузил ли книгу тот, кто её сейчас смотрит: от этого зависит право
    /// править описание и удалять.
    pub is_owner: bool,
    pub created_at: String,
    pub updated_at: String,
}

fn book_from_row(r: &sqlx::postgres::PgRow, viewer: Uuid) -> BookSummary {
    let created: chrono::DateTime<chrono::Utc> = r.get("created_at");
    let updated: chrono::DateTime<chrono::Utc> = r.get("updated_at");
    BookSummary {
        id: r.get::<Uuid, _>("id").to_string(),
        title: r.get("title"),
        author: r.get("author"),
        topic: r.get("topic"),
        is_owner: r.get::<Uuid, _>("owner_id") == viewer,
        language: r.get("language"),
        target_language: r.get("target_language"),
        level: r.get("level"),
        source_format: r.get("source_format"),
        chapter_count: r.get("chapter_count"),
        word_count: r.get("word_count"),
        set_id: r.get::<Option<Uuid>, _>("set_id").map(|v| v.to_string()),
        last_chapter: r.get("last_chapter"),
        last_offset: r.get("last_offset"),
        status: r.get("status"),
        created_at: created.to_rfc3339(),
        updated_at: updated.to_rfc3339(),
    }
}

/// Книга плюс личное состояние читателя. Позиция, язык перевода и набор
/// карточек живут в user_book_state, поэтому подтягиваются LEFT JOIN-ом:
/// у того, кто книгу ещё не открывал, строки нет — отсюда COALESCE.
const BOOK_SELECT: &str = "SELECT b.id, b.title, b.author, b.topic, b.language, b.source_format, \
     b.chapter_count, b.word_count, b.status, b.owner_id, b.created_at, \
     COALESCE(s.target_language, 'ru') AS target_language, \
     COALESCE(s.level, '') AS level, \
     COALESCE(s.last_chapter, 0) AS last_chapter, \
     COALESCE(s.last_offset, 0::real) AS last_offset, \
     s.set_id AS set_id, \
     COALESCE(s.updated_at, b.updated_at) AS updated_at \
     FROM books b LEFT JOIN user_book_state s ON s.book_id = b.id AND s.user_id = $1";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChapterSummary {
    pub position: i32,
    pub title: String,
    pub word_count: i32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BookDetail {
    pub book: BookSummary,
    pub chapters: Vec<ChapterSummary>,
}

// ---------- Книги ----------

/// POST /api/books — завести книгу; главы приезжают следующими запросами.
pub async fn create_book(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreateBookRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let title = payload.title.trim();
    if title.is_empty() || title.chars().count() > 250 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Title: 1..250 chars"));
    }
    let target = if payload.target_language.trim().is_empty() { "ru" } else { payload.target_language.trim() };
    let format = if payload.source_format.trim().is_empty() { "txt" } else { payload.source_format.trim() };

    let row = sqlx::query(
        "INSERT INTO books (owner_id, title, author, topic, language, source_format)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
    )
    .bind(user_id)
    .bind(title)
    .bind(payload.author.trim())
    .bind(payload.topic.trim())
    .bind(payload.language.trim().to_lowercase())
    .bind(format)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;
    let book_id: Uuid = row.get("id");

    // Язык перевода — вещь личная, поэтому ложится не в книгу, а в состояние
    // читателя: следующий, кто откроет её, выберет свой.
    sqlx::query(
        "INSERT INTO user_book_state (user_id, book_id, target_language) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, book_id) DO UPDATE SET target_language = EXCLUDED.target_language",
    )
    .bind(user_id)
    .bind(book_id)
    .bind(target.to_lowercase())
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::CREATED, Json(json!({ "id": book_id.to_string() }))))
}

/// POST /api/books/{id}/chapters — пачка глав. Вставка одним UNNEST-запросом:
/// построчный INSERT на большой книге упирается в таймаут прокси.
pub async fn add_chapters(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<ChaptersRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    owned_book(&pool, id, user_id).await?;

    if payload.chapters.is_empty() || payload.chapters.len() > MAX_BATCH {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("chapters: 1..{MAX_BATCH} per request")));
    }

    let mut positions: Vec<i32> = Vec::with_capacity(payload.chapters.len());
    let mut titles: Vec<String> = Vec::with_capacity(payload.chapters.len());
    let mut contents: Vec<String> = Vec::with_capacity(payload.chapters.len());
    let mut counts: Vec<i32> = Vec::with_capacity(payload.chapters.len());

    for c in &payload.chapters {
        let content = c.content.trim();
        if content.is_empty() || content.chars().count() > MAX_CHAPTER_CHARS {
            return Err(ApiError::response(
                StatusCode::BAD_REQUEST,
                format!("chapter {}: content must be 1..{MAX_CHAPTER_CHARS} chars", c.position),
            ));
        }
        if c.position < 0 || c.position as usize >= MAX_CHAPTERS {
            return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("chapter position out of range: {}", c.position)));
        }
        positions.push(c.position);
        titles.push(c.title.trim().chars().take(250).collect());
        counts.push(content.split_whitespace().count() as i32);
        contents.push(content.to_string());
    }

    sqlx::query(
        "INSERT INTO book_chapters (book_id, position, title, content, word_count)
         SELECT $1, p, t, c, w FROM UNNEST($2::int[], $3::text[], $4::text[], $5::int[]) AS u(p, t, c, w)
         ON CONFLICT (book_id, position) DO UPDATE
            SET title = EXCLUDED.title, content = EXCLUDED.content, word_count = EXCLUDED.word_count",
    )
    .bind(id)
    .bind(&positions)
    .bind(&titles)
    .bind(&contents)
    .bind(&counts)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::OK, Json(json!({ "saved": positions.len() }))))
}

/// POST /api/books/{id}/finalize — пересчитать объём, определить язык, открыть чтение.
pub async fn finalize_book(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let language = owned_book(&pool, id, user_id).await?;

    let agg = sqlx::query(
        "SELECT COUNT(*)::int AS n, COALESCE(SUM(word_count), 0)::int AS words FROM book_chapters WHERE book_id = $1",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;
    let chapter_count: i32 = agg.get("n");
    let word_count: i32 = agg.get("words");

    if chapter_count == 0 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Book has no chapters"));
    }

    let known = sqlx::query("SELECT title, topic FROM books WHERE id = $1")
        .bind(id).fetch_one(&pool).await.map_err(db_err)?;
    let title: String = known.get("title");
    let mut topic: String = known.get("topic");

    // Чего не хватает — спрашиваем у модели по началу книги. Провал определения
    // не должен ломать загрузку: и язык, и тему владелец может выставить руками.
    let mut detected = language.clone();
    if detected.is_empty() || topic.is_empty() {
        let sample = sqlx::query(
            "SELECT left(content, 1500) AS s FROM book_chapters WHERE book_id = $1 ORDER BY position LIMIT 1",
        )
        .bind(id)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?
        .map(|r| r.get::<String, _>("s"))
        .unwrap_or_default();

        match translate::detect_book_facts(&sample, &title).await {
            Ok((code, guessed)) => {
                if detected.is_empty() { detected = code; }
                if topic.is_empty() { topic = guessed; }
            }
            Err(e) => eprintln!("[books] detection failed for {id}: {e}"),
        }
    }

    sqlx::query(
        "UPDATE books SET chapter_count = $1, word_count = $2, language = $3, topic = $4,
                          status = 'ready', updated_at = NOW() WHERE id = $5",
    )
    .bind(chapter_count).bind(word_count).bind(&detected).bind(&topic).bind(id)
    .execute(&pool).await.map_err(db_err)?;

    let row = sqlx::query(&format!("{BOOK_SELECT} WHERE b.id = $2"))
        .bind(user_id).bind(id).fetch_one(&pool).await.map_err(db_err)?;
    Ok((StatusCode::OK, Json(book_from_row(&row, user_id))))
}

/// GET /api/books — общая полка: книги всех читателей.
/// Недособранные книги видит только тот, кто их загружает: чужая полка не
/// должна мигать наполовину залитыми томами.
pub async fn list_books(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let rows = sqlx::query(&format!(
        "{BOOK_SELECT} WHERE b.status = 'ready' OR b.owner_id = $1
         ORDER BY (s.updated_at IS NULL), COALESCE(s.updated_at, b.created_at) DESC"
    ))
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;
    let books: Vec<BookSummary> = rows.iter().map(|r| book_from_row(r, user_id)).collect();
    Ok((StatusCode::OK, Json(books)))
}

/// GET /api/books/{id} — книга и оглавление (без текста глав).
pub async fn get_book(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    readable_book(&pool, id).await?;

    let row = sqlx::query(&format!("{BOOK_SELECT} WHERE b.id = $2"))
        .bind(user_id)
        .bind(id)
        .fetch_one(&pool)
        .await
        .map_err(db_err)?;

    let chapters = sqlx::query(
        "SELECT position, title, word_count FROM book_chapters WHERE book_id = $1 ORDER BY position",
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?
    .into_iter()
    .map(|r| ChapterSummary {
        position: r.get("position"),
        title: r.get("title"),
        word_count: r.get("word_count"),
    })
    .collect();

    Ok((StatusCode::OK, Json(BookDetail { book: book_from_row(&row, user_id), chapters })))
}

/// GET /api/books/{id}/chapters/{position} — текст главы.
pub async fn get_chapter(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, position)): Path<(Uuid, i32)>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let _ = user_id;
    readable_book(&pool, id).await?;

    let row = sqlx::query(
        "SELECT position, title, content, word_count FROM book_chapters WHERE book_id = $1 AND position = $2",
    )
    .bind(id)
    .bind(position)
    .fetch_optional(&pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Chapter not found"))?;

    Ok((StatusCode::OK, Json(json!({
        "position": row.get::<i32, _>("position"),
        "title": row.get::<String, _>("title"),
        "content": row.get::<String, _>("content"),
        "wordCount": row.get::<i32, _>("word_count"),
    }))))
}

/// PATCH /api/books/{id} — правка делится надвое.
///
/// Описание книги (название, автор, тема, язык оригинала) общее для всех, и
/// менять его вправе только тот, кто книгу загрузил. Позиция чтения и язык
/// перевода принадлежат читателю: полка общая, но место в тексте у каждого своё.
pub async fn update_book(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateBookRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    readable_book(&pool, id).await?;

    let touches_book = payload.title.is_some() || payload.author.is_some()
        || payload.topic.is_some() || payload.language.is_some();
    if touches_book {
        owned_book(&pool, id, user_id).await?;
        sqlx::query(
            "UPDATE books SET
                title = COALESCE($2, title),
                author = COALESCE($3, author),
                topic = COALESCE($4, topic),
                language = COALESCE($5, language),
                updated_at = NOW()
             WHERE id = $1",
        )
        .bind(id)
        .bind(payload.title.as_ref().map(|s| s.trim().chars().take(250).collect::<String>()))
        .bind(payload.author.as_ref().map(|s| s.trim().chars().take(250).collect::<String>()))
        .bind(payload.topic.as_ref().map(|s| s.trim().chars().take(80).collect::<String>()))
        .bind(payload.language.as_ref().map(|s| s.trim().to_lowercase()))
        .execute(&pool)
        .await
        .map_err(db_err)?;
    }

    let touches_state = payload.target_language.is_some() || payload.level.is_some()
        || payload.last_chapter.is_some() || payload.last_offset.is_some();
    if touches_state {
        // Приведение типов у COALESCE обязательно: параметр приходит пустым
        // (NULL), и без него Postgres не знает, какого типа значение.
        sqlx::query(
            "INSERT INTO user_book_state (user_id, book_id, target_language, last_chapter, last_offset, level)
             VALUES ($1, $2, COALESCE($3::text, 'ru'), COALESCE($4::int, 0), COALESCE($5::real, 0), COALESCE($6::text, ''))
             ON CONFLICT (user_id, book_id) DO UPDATE SET
                target_language = COALESCE($3::text, user_book_state.target_language),
                last_chapter    = COALESCE($4::int, user_book_state.last_chapter),
                last_offset     = COALESCE($5::real, user_book_state.last_offset),
                level           = COALESCE($6::text, user_book_state.level),
                updated_at      = NOW()",
        )
        .bind(user_id)
        .bind(id)
        .bind(payload.target_language.as_ref().map(|s| s.trim().to_lowercase()))
        .bind(payload.last_chapter)
        .bind(payload.last_offset)
        .bind(payload.level.as_ref().map(|s| s.trim().to_string()))
        .execute(&pool)
        .await
        .map_err(db_err)?;
    }

    let row = sqlx::query(&format!("{BOOK_SELECT} WHERE b.id = $2"))
        .bind(user_id).bind(id).fetch_one(&pool).await.map_err(db_err)?;
    Ok((StatusCode::OK, Json(book_from_row(&row, user_id))))
}

/// DELETE /api/books/{id} — книга и её главы; набор карточек остаётся.
pub async fn delete_book(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    owned_book(&pool, id, user_id).await?;
    sqlx::query("DELETE FROM books WHERE id = $1").bind(id).execute(&pool).await.map_err(db_err)?;
    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/books/{id}/search?q= — где в книге встречается слово или фраза.
pub async fn search_book(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    axum::extract::Query(params): axum::extract::Query<SearchParams>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let _ = user_id;
    readable_book(&pool, id).await?;

    let q = params.q.trim();
    if q.is_empty() || q.chars().count() > 120 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "q: 1..120 chars"));
    }

    let rows = sqlx::query(
        "SELECT position, title,
                ts_headline('simple', content, plainto_tsquery('simple', $2),
                            'MaxFragments=2,MinWords=4,MaxWords=12,StartSel=<b>,StopSel=</b>') AS headline
         FROM book_chapters
         WHERE book_id = $1 AND tsv @@ plainto_tsquery('simple', $2)
         ORDER BY position LIMIT 40",
    )
    .bind(id)
    .bind(q)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let hits: Vec<serde_json::Value> = rows.into_iter().map(|r| json!({
        "position": r.get::<i32, _>("position"),
        "title": r.get::<String, _>("title"),
        "headline": r.get::<String, _>("headline"),
    })).collect();

    Ok((StatusCode::OK, Json(json!({ "hits": hits }))))
}

/// POST /api/pdf/text — вытащить текстовый слой PDF на сервере.
///
/// В браузере это делает pdf.js, но на iOS шестая версия падает внутри себя:
/// один и тот же файл на компьютере разбирается, на телефоне нет. Клиент
/// пробует локально и при неудаче отправляет файл сюда.
pub async fn pdf_text(
    AuthenticatedUser(_user): AuthenticatedUser,
    body: axum::body::Bytes,
) -> ApiResult<impl IntoResponse> {
    let base = std::env::var("WHISPER_URL")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| ApiError::response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Разбор PDF на сервере не настроен",
        ))?;

    if body.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Empty file"));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("client: {e}")))?;

    let mut req = client
        .post(format!("{}/pdf-text", base.trim_end_matches('/')))
        .header("Content-Type", "application/octet-stream")
        .body(body.to_vec());
    if let Ok(token) = std::env::var("WHISPER_TOKEN") {
        if !token.trim().is_empty() {
            req = req.header("Authorization", format!("Bearer {}", token.trim()));
        }
    }

    let res = req.send().await.map_err(|e| {
        ApiError::response(StatusCode::BAD_GATEWAY, format!("Сервис разбора недоступен: {e}"))
    })?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(ApiError::response(
            StatusCode::BAD_GATEWAY,
            format!("Разбор PDF не удался ({status}): {}", text.chars().take(200).collect::<String>()),
        ));
    }
    let value: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Неразборный ответ: {e}")))?;
    Ok((StatusCode::OK, Json(value)))
}

// ---------- Адаптация под уровень ----------

/// Уровни владения языком и что на каждом допустимо.
/// Правила заданы явно: без них модель сползает к привычному B1 на любом уровне.
fn level_rules(level: &str) -> Option<&'static str> {
    Some(match level {
        "A1.1" => "Only the présent tense. Sentences of 4 to 8 words. No subordinate clauses. \
                   Only the most frequent words. Repeat words instead of using synonyms.",
        "A1.2" => "Présent and passé composé. Sentences up to 12 words. Simple connectors only. \
                   Everyday vocabulary.",
        "A2"   => "Présent, passé composé, imparfait, futur proche. Simple relative clauses with \
                   qui and que. Concrete vocabulary.",
        "B1"   => "All common past tenses, futur simple, conditionnel présent. Relative and \
                   subordinate clauses. Some abstract vocabulary, explained in context.",
        "B2"   => "Subjonctif présent, passive voice, contrast and concession. Abstract vocabulary.",
        "C1"   => "Complex syntax, varied registers, idiomatic expressions, dense argumentation.",
        "C2"   => "Full stylistic range, nuance and irony, rare and precise vocabulary.",
        _ => return None,
    })
}

/// Длина куска. Меньше — чаще обращения к модели, больше — риск обрезанного
/// ответа и разрыва связи на прокси.
const SLICE_CHARS: usize = 1400;
/// Сколько кусков переписываем за один запрос: прокси рвёт связь на тридцати
/// секундах, а каждый кусок — это секунды.
const SLICES_PER_CALL: usize = 4;

/// Режем главу на куски по границам абзацев.
///
/// Нарезка детерминированная: номер куска служит ключом кэша, и если границы
/// поедут, сохранённая адаптация перестанет находиться.
fn slice_chapter(content: &str) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut cur = String::new();
    for para in content.split("\n\n") {
        let para = para.trim();
        if para.is_empty() {
            continue;
        }
        if !cur.is_empty() && cur.chars().count() + para.chars().count() > SLICE_CHARS {
            out.push(std::mem::take(&mut cur));
        }
        if !cur.is_empty() {
            cur.push_str("\n\n");
        }
        cur.push_str(para);
        // Абзац сам длиннее куска — отдаём как есть, рвать предложение хуже.
        if cur.chars().count() >= SLICE_CHARS {
            out.push(std::mem::take(&mut cur));
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

async fn adapt_slice(text: &str, level: &str, rules: &str, language: &str) -> Result<String, String> {
    let lang = super::translate::lang_name(language);
    let content = crate::llm::chat_text(crate::llm::ChatRequest {
        task: crate::llm::Task::Generation,
        messages: vec![
            crate::llm::ChatMessage::system(format!(
                "You rewrite {lang} texts for learners at CEFR level {level}.\n\
                 CONSTRAINTS: {rules}\n\
                 Keep the meaning, the facts, the names and the order of events. Keep the same \
                 language ({lang}). Keep paragraph breaks. Do not summarise, do not add \
                 commentary, do not skip content: rewrite it simply.\n\
                 GRAMMAR OUTRANKS BREVITY: every noun keeps its article. Reply with the rewritten \
                 text only."
            )),
            crate::llm::ChatMessage::user(text.to_string()),
        ],
        max_tokens: 2400,
        format: crate::llm::ResponseFormat::Text,
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| e.to_string())?;

    let out = content.trim().to_string();
    if out.is_empty() {
        return Err("модель вернула пустой ответ".to_string());
    }
    Ok(out)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdaptRequest {
    pub level: String,
}

/// POST /api/books/{id}/chapters/{position}/adapt — глава на выбранном уровне.
///
/// За один заход переписывается несколько кусков, поэтому клиент зовёт метод
/// повторно, пока не придёт `done`. Так адаптация длинной главы не упирается в
/// таймаут прокси, а читатель видит, сколько осталось.
pub async fn adapt_chapter(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((id, position)): Path<(Uuid, i32)>,
    Json(payload): Json<AdaptRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let _ = user_id;
    let (language, _) = readable_book(&pool, id).await?;

    let level = payload.level.trim().to_string();
    let rules = level_rules(&level)
        .ok_or_else(|| ApiError::response(StatusCode::BAD_REQUEST, "Неизвестный уровень"))?;

    let row = sqlx::query("SELECT content FROM book_chapters WHERE book_id = $1 AND position = $2")
        .bind(id)
        .bind(position)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Chapter not found"))?;
    let original: String = row.get("content");

    let slices = slice_chapter(&original);
    let total = slices.len() as i32;

    let saved = sqlx::query(
        "SELECT slice, content FROM book_chapter_levels
         WHERE book_id = $1 AND position = $2 AND level = $3 ORDER BY slice",
    )
    .bind(id).bind(position).bind(&level)
    .fetch_all(&pool).await.map_err(db_err)?;
    let mut done: std::collections::HashMap<i32, String> =
        saved.into_iter().map(|r| (r.get::<i32, _>("slice"), r.get::<String, _>("content"))).collect();

    let mut made = 0usize;
    for (i, piece) in slices.iter().enumerate() {
        let idx = i as i32;
        if done.contains_key(&idx) {
            continue;
        }
        if made >= SLICES_PER_CALL {
            break;
        }
        made += 1;
        match adapt_slice(piece, &level, rules, &language).await {
            Ok(text) => {
                let _ = sqlx::query(
                    "INSERT INTO book_chapter_levels (book_id, position, level, slice, content)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (book_id, position, level, slice) DO UPDATE SET content = EXCLUDED.content",
                )
                .bind(id).bind(position).bind(&level).bind(idx).bind(&text)
                .execute(&pool).await;
                done.insert(idx, text);
            }
            Err(e) => eprintln!("[adapt] {id} гл.{position} кусок {idx}: {e}"),
        }
    }

    let ready = done.len() as i32;
    let complete = ready >= total;
    let content = if complete {
        (0..total).filter_map(|i| done.get(&i).cloned()).collect::<Vec<_>>().join("\n\n")
    } else {
        String::new()
    };

    Ok((StatusCode::OK, Json(json!({
        "level": level,
        "ready": ready,
        "total": total,
        "done": complete,
        "content": content,
    }))))
}

// ---------- Словарь читателя ----------

#[derive(Deserialize)]
pub struct SearchParams {
    pub q: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VocabIn {
    pub word: String,
    /// 0 — новое, 1 — учу, 2 — узнаю, 3 — знаю, 4 — игнорировать.
    pub status: i16,
    #[serde(default)]
    pub translation: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VocabRequest {
    pub words: Vec<VocabIn>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VocabEntry {
    pub word: String,
    pub status: i16,
    pub translation: String,
}

/// GET /api/books/{id}/vocab — все известные слова языка книги.
/// Словарь ведётся по языку, а не по книге: слово, выученное в одной книге,
/// должно быть уже знакомым в следующей — ради этого читалка и затевалась.
pub async fn get_vocab(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let (language, _) = readable_book(&pool, id).await?;

    let rows = sqlx::query(
        "SELECT word, status, translation FROM user_vocab WHERE user_id = $1 AND language = $2",
    )
    .bind(user_id)
    .bind(&language)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let words: Vec<VocabEntry> = rows.into_iter().map(|r| VocabEntry {
        word: r.get("word"),
        status: r.get("status"),
        translation: r.get("translation"),
    }).collect();

    Ok((StatusCode::OK, Json(json!({ "language": language, "words": words }))))
}

/// PUT /api/books/{id}/vocab — сохранить статусы слов (одно или пачкой).
pub async fn put_vocab(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<VocabRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let (language, _) = readable_book(&pool, id).await?;
    if payload.words.is_empty() || payload.words.len() > 500 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "words: 1..500"));
    }

    let mut words: Vec<String> = Vec::with_capacity(payload.words.len());
    let mut statuses: Vec<i16> = Vec::with_capacity(payload.words.len());
    let mut translations: Vec<String> = Vec::with_capacity(payload.words.len());
    for w in &payload.words {
        let word = w.word.trim().to_lowercase();
        if word.is_empty() || word.chars().count() > 80 { continue; }
        words.push(word);
        statuses.push(w.status.clamp(0, 4));
        translations.push(w.translation.trim().chars().take(300).collect());
    }
    if words.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "No valid words"));
    }

    sqlx::query(
        "INSERT INTO user_vocab (user_id, language, word, status, translation, book_id)
         SELECT $1, $2, w, s, t, $6 FROM UNNEST($3::text[], $4::int2[], $5::text[]) AS u(w, s, t)
         ON CONFLICT (user_id, language, word) DO UPDATE SET
            status = EXCLUDED.status,
            -- пустой перевод не затирает уже сохранённый
            translation = CASE WHEN EXCLUDED.translation = '' THEN user_vocab.translation ELSE EXCLUDED.translation END,
            seen_count = user_vocab.seen_count + 1,
            updated_at = NOW()",
    )
    .bind(user_id)
    .bind(&language)
    .bind(&words)
    .bind(&statuses)
    .bind(&translations)
    .bind(id)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok((StatusCode::OK, Json(json!({ "saved": words.len() }))))
}

// ---------- Карточки из книги ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddCardRequest {
    /// Слово или фраза на языке книги.
    pub term: String,
    pub definition: String,
    /// Предложение, в котором встретилось, — контекст запоминается вместе со словом.
    #[serde(default)]
    pub example: String,
}

/// Схема полей набора книги: термин на языке оригинала (по нему и озвучка),
/// перевод и предложение-контекст.
fn book_set_schema(language: &str, target: &str) -> serde_json::Value {
    json!([
        { "id": "term", "name": "СЛОВО", "type": "text", "side": "front", "order": 1,
          "settings": { "language": language } },
        { "id": "definition", "name": "ПЕРЕВОД", "type": "text", "side": "back", "order": 1,
          "settings": { "language": target } },
        { "id": "example", "name": "ИЗ КНИГИ", "type": "text", "side": "back", "order": 2,
          "settings": { "language": language } }
    ])
}

/// POST /api/books/{id}/cards — добавить слово/фразу в набор книги.
/// Набор создаётся при первом сохранении: пустые наборы на полке не нужны.
pub async fn add_card(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(payload): Json<AddCardRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    readable_book(&pool, id).await?;

    let term = payload.term.trim();
    let definition = payload.definition.trim();
    if term.is_empty() || definition.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "term and definition are required"));
    }

    // Набор личный: книгу читают несколько человек, и складывать их слова в
    // общую стопку нельзя — каждому нужен свой список на повторение.
    let row = sqlx::query(
        "SELECT b.title, b.language, COALESCE(s.target_language, 'ru') AS target_language, s.set_id
         FROM books b LEFT JOIN user_book_state s ON s.book_id = b.id AND s.user_id = $2
         WHERE b.id = $1",
    )
    .bind(id)
    .bind(user_id)
    .fetch_one(&pool)
    .await
    .map_err(db_err)?;
    let title: String = row.get("title");
    let language: String = row.get("language");
    let target: String = row.get("target_language");

    let set_id = match row.get::<Option<Uuid>, _>("set_id") {
        Some(sid) => sid,
        None => {
            let created = sqlx::query(
                "INSERT INTO sets (creator_id, title, description, is_public, fields_schema)
                 VALUES ($1, $2, $3, false, $4) RETURNING id",
            )
            .bind(user_id)
            .bind(format!("Слова из книги «{}»", title.chars().take(180).collect::<String>()))
            .bind("Слова и фразы, сохранённые во время чтения. Повторяются по интервальному алгоритму.")
            .bind(book_set_schema(&language, &target))
            .fetch_one(&pool)
            .await
            .map_err(db_err)?;
            let sid: Uuid = created.get("id");
            sqlx::query(
                "INSERT INTO user_book_state (user_id, book_id, set_id) VALUES ($1, $2, $3)
                 ON CONFLICT (user_id, book_id) DO UPDATE SET set_id = EXCLUDED.set_id, updated_at = NOW()",
            )
            .bind(user_id).bind(id).bind(sid)
            .execute(&pool).await.map_err(db_err)?;
            sid
        }
    };

    // Повторное сохранение того же слова обновляет карточку, а не плодит дубли.
    let existing = sqlx::query("SELECT id FROM flashcards WHERE set_id = $1 AND lower(term) = lower($2) LIMIT 1")
        .bind(set_id)
        .bind(term)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?;

    let fields = json!({ "term": term, "definition": definition, "example": payload.example.trim() });

    let card_id: Uuid = match existing {
        Some(r) => {
            let cid: Uuid = r.get("id");
            sqlx::query("UPDATE flashcards SET definition = $1, fields_data = $2, updated_at = NOW() WHERE id = $3")
                .bind(definition).bind(&fields).bind(cid)
                .execute(&pool).await.map_err(db_err)?;
            cid
        }
        None => {
            let next: i32 = sqlx::query("SELECT COALESCE(MAX(order_index), 0) + 1 AS n FROM flashcards WHERE set_id = $1")
                .bind(set_id).fetch_one(&pool).await.map_err(db_err)?.get("n");
            let row = sqlx::query(
                "INSERT INTO flashcards (set_id, term, definition, order_index, fields_data)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id",
            )
            .bind(set_id).bind(term).bind(definition).bind(next).bind(&fields)
            .fetch_one(&pool).await.map_err(db_err)?;
            row.get("id")
        }
    };

    let total: i64 = sqlx::query("SELECT COUNT(*) AS n FROM flashcards WHERE set_id = $1")
        .bind(set_id).fetch_one(&pool).await.map_err(db_err)?.get("n");

    Ok((StatusCode::OK, Json(json!({
        "setId": set_id.to_string(),
        "cardId": card_id.to_string(),
        "cardCount": total,
    }))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slicing_keeps_every_paragraph() {
        // Абзацы намеренно длинные: короткие уложились бы в один кусок, и
        // проверка деления ничего бы не проверяла.
        let text = (1..=40)
            .map(|i| format!("Абзац номер {i}. {}", "Текст для объёма. ".repeat(6)))
            .collect::<Vec<_>>()
            .join("\n\n");
        let slices = slice_chapter(&text);
        assert!(slices.len() > 1, "длинная глава должна делиться, а вышло кусков: {}", slices.len());
        let joined = slices.join("\n\n");
        for i in 1..=40 {
            assert!(joined.contains(&format!("Абзац номер {i}.")), "потерян абзац {i}");
        }
    }

    #[test]
    fn slicing_is_stable() {
        // Ключ кэша — номер куска: поедут границы, и сохранённое не найдётся.
        let text = "Первый абзац.\n\nВторой абзац.\n\nТретий абзац.";
        assert_eq!(slice_chapter(text), slice_chapter(text));
    }

    #[test]
    fn unknown_level_is_rejected() {
        assert!(level_rules("B1").is_some());
        assert!(level_rules("Z9").is_none());
    }
}
