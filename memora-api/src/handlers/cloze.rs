// Предложения с пропуском для тренажёра «слово в контексте».
//
// Отдельное слово запоминается хуже, чем слово в живой фразе: вместе с ним
// усваивается сочетаемость, предлог, род. Поэтому карточке нужен не перевод,
// а предложение, где она стоит на своём месте.
//
// Порядок источников важен: если у карточки уже есть пример — берём его. У
// слов, сохранённых из книги, это настоящая фраза из текста, и она лучше любой
// выдуманной: слово вспоминается вместе с тем, где вы его встретили.

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

use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};
use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;
use super::translate::lang_name;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

/// Сколько предложений сочиняем за один запрос. Ограничение не от жадности:
/// прокси рвёт связь на тридцати секундах, а каждое обращение к модели — это
/// секунда-две. Клиент просит следующую пачку заранее, пока человек отвечает.
const MAX_GENERATED: usize = 4;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClozeRequest {
    pub card_ids: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClozeItem {
    pub card_id: String,
    pub term: String,
    /// Предложение на изучаемом языке, содержащее слово целиком.
    pub sentence: String,
    /// Перевод предложения — подсказка, когда смысл ускользает.
    pub translation: String,
    /// Откуда взялось: «example» — готовый пример карточки, «llm» — сочинено.
    pub source: String,
}

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// Языки набора: на каком учим и на какой переводим. Берём из схемы полей —
/// там у каждого поля прописан свой язык, и лицевая сторона задаёт изучаемый.
fn set_languages(schema: &serde_json::Value) -> (String, String) {
    let mut study = "fr".to_string();
    let mut native = "ru".to_string();
    if let Some(fields) = schema.as_array() {
        for f in fields {
            let side = f.get("side").and_then(|v| v.as_str()).unwrap_or("");
            let lang = f.get("settings").and_then(|s| s.get("language")).and_then(|v| v.as_str());
            match (side, lang) {
                ("front", Some(l)) if !l.is_empty() && l != "default" => study = l.to_string(),
                ("back", Some(l)) if !l.is_empty() && l != "default" => native = l.to_string(),
                _ => {}
            }
        }
    }
    (study, native)
}

/// Содержит ли предложение это слово целиком (без учёта регистра).
/// Проверка нужна: пример из книги мог сохраниться от другой формы слова,
/// и тогда пропуск было бы некуда поставить.
fn contains_term(sentence: &str, term: &str) -> bool {
    let s = sentence.to_lowercase();
    let t = term.trim().to_lowercase();
    if t.is_empty() || !s.contains(&t) {
        return false;
    }
    // Слово должно быть отдельным, а не куском другого: «or» внутри «corps».
    let bytes = s.as_bytes();
    s.match_indices(&t).any(|(i, _)| {
        let before_ok = i == 0 || !bytes[i - 1].is_ascii_alphanumeric();
        let after = i + t.len();
        let after_ok = after >= bytes.len() || !bytes[after].is_ascii_alphanumeric();
        before_ok && after_ok
    })
}

async fn compose_sentence(term: &str, definition: &str, study: &str, native: &str) -> Result<(String, String), String> {
    let content = llm::chat_text(ChatRequest {
        task: Task::Generation,
        messages: vec![
            ChatMessage::system(format!(
                "You write example sentences for a language learner studying {}. \
                 Reply with ONE JSON object and nothing else, using exactly these keys:\n\
                 {{\"sentence\": string, \"translation\": string}}\n\
                 sentence — one natural, everyday sentence in {} of 6 to 12 words that contains \
                 the given word EXACTLY as spelled, unchanged; \
                 translation — that sentence in {}. \
                 Keep it simple enough for a beginner. Never use null.",
                lang_name(study), lang_name(study), lang_name(native),
            )),
            ChatMessage::user(format!("Word: \"{term}\"\nIts meaning: \"{definition}\"")),
        ],
        max_tokens: 300,
        format: ResponseFormat::JsonSchema(json!({
            "type": "object",
            "properties": {
                "sentence": { "type": "string" },
                "translation": { "type": "string" },
            },
            "required": ["sentence", "translation"],
        })),
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| e.to_string())?;

    let v: serde_json::Value = serde_json::from_str(super::ai::extract_json(&content))
        .map_err(|e| format!("неразборный ответ модели: {e}"))?;
    let sentence = v.get("sentence").and_then(|s| s.as_str()).unwrap_or("").trim().to_string();
    let translation = v.get("translation").and_then(|s| s.as_str()).unwrap_or("").trim().to_string();

    if sentence.is_empty() || !contains_term(&sentence, term) {
        return Err("модель не вставила слово в предложение".to_string());
    }
    Ok((sentence, translation))
}

/// POST /api/sets/{id}/cloze — предложения с пропуском для указанных карточек.
pub async fn build_cloze(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(set_id): Path<Uuid>,
    Json(payload): Json<ClozeRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;

    let set = sqlx::query("SELECT creator_id, is_public, fields_schema FROM sets WHERE id = $1")
        .bind(set_id)
        .fetch_optional(&pool)
        .await
        .map_err(db_err)?
        .ok_or_else(|| ApiError::response(StatusCode::NOT_FOUND, "Set not found"))?;
    let owner: Uuid = set.get("creator_id");
    let is_public: bool = set.get("is_public");
    if owner != user_id && !is_public {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Набор недоступен"));
    }
    let (study, native) = set_languages(&set.get::<serde_json::Value, _>("fields_schema"));

    let ids: Vec<Uuid> = payload.card_ids.iter().filter_map(|s| Uuid::parse_str(s).ok()).collect();
    if ids.is_empty() || ids.len() > 40 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "cardIds: 1..40"));
    }

    let rows = sqlx::query(
        "SELECT id, term, definition, fields_data FROM flashcards WHERE set_id = $1 AND id = ANY($2)",
    )
    .bind(set_id)
    .bind(&ids)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    let mut out: Vec<ClozeItem> = Vec::new();
    let mut generated = 0usize;

    for row in rows {
        let card_id: Uuid = row.get("id");
        let term: String = row.get("term");
        let definition: String = row.get("definition");
        let fields: serde_json::Value = row.get("fields_data");
        let field = |key: &str| fields.get(key).and_then(|v| v.as_str()).unwrap_or("").trim().to_string();

        // 1. Уже сочинённое в прошлый раз.
        let saved = field("clozeSentence");
        if !saved.is_empty() && contains_term(&saved, &term) {
            out.push(ClozeItem {
                card_id: card_id.to_string(), term, sentence: saved,
                translation: field("clozeTranslation"), source: "saved".to_string(),
            });
            continue;
        }

        // 2. Готовый пример карточки — для слов из книг это фраза из текста.
        let example = field("example");
        if !example.is_empty() && contains_term(&example, &term) {
            out.push(ClozeItem {
                card_id: card_id.to_string(), term, sentence: example,
                translation: field("exampleRu"), source: "example".to_string(),
            });
            continue;
        }

        // 3. Сочиняем — но не больше нескольких за запрос.
        if generated >= MAX_GENERATED {
            continue;
        }
        generated += 1;
        match compose_sentence(&term, &definition, &study, &native).await {
            Ok((sentence, translation)) => {
                let patch = json!({ "clozeSentence": sentence, "clozeTranslation": translation });
                let _ = sqlx::query("UPDATE flashcards SET fields_data = fields_data || $1 WHERE id = $2")
                    .bind(&patch)
                    .bind(card_id)
                    .execute(&pool)
                    .await;
                out.push(ClozeItem {
                    card_id: card_id.to_string(), term, sentence, translation,
                    source: "llm".to_string(),
                });
            }
            Err(e) => eprintln!("[cloze] {term}: {e}"),
        }
    }

    Ok((StatusCode::OK, Json(json!({
        "items": out,
        "studyLanguage": study,
        "nativeLanguage": native,
    }))))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn term_must_stand_alone() {
        assert!(contains_term("Je mange une pomme rouge.", "pomme"));
        // «or» внутри «corps» — не то слово, пропуск ставить некуда.
        assert!(!contains_term("Le corps humain.", "or"));
        assert!(contains_term("C'est de l'or pur.", "or"));
    }

    #[test]
    fn missing_word_is_rejected() {
        assert!(!contains_term("Je mange une poire.", "pomme"));
    }

    #[test]
    fn languages_come_from_the_field_schema() {
        let schema = json!([
            { "id": "term", "side": "front", "settings": { "language": "fr" } },
            { "id": "definition", "side": "back", "settings": { "language": "ru" } }
        ]);
        assert_eq!(set_languages(&schema), ("fr".to_string(), "ru".to_string()));
    }

    #[test]
    fn languages_fall_back_when_schema_is_silent() {
        assert_eq!(set_languages(&json!([])), ("fr".to_string(), "ru".to_string()));
    }
}
