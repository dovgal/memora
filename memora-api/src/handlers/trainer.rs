//! HTTP-слой тренажёра карточек.
//!
//! POST /api/sets/{id}/trainer/prepare — собирает `PreparedSet` (см.
//! `memora-web/src/lib/contracts/trainer.ts`): профили карточек + провалидированные
//! упражнения. Детерминированная часть (recall/listen/speak/gender/recognize)
//! строится и сохраняется мгновенно для всех запрошенных карточек. LLM-часть
//! (cloze/build/conjugate) — не больше `limit` карточек за вызов, последовательно
//! (Ollama Free обслуживает один запрос за раз) — остальное уходит в `pending`,
//! клиент дозапрашивает следующим вызовом. Идемпотентно: карточки, чьё содержимое
//! не менялось (`card_hash`), отдают уже сохранённые строки без повторной генерации.
//!
//! POST /api/cards/{id}/mnemonic — мнемоника для одной карточки, тоже кэшируется
//! в `card_profiles.mnemonic` по `card_hash`.
//!
//! Логика классификации/сборки упражнений — в `crate::trainer`, вызовы судьи —
//! в `crate::judge`. Здесь — только доступ, rate limit, БД и склейка ответа.
//!
//! `ensure_set_access`/`check_rate_limit` ниже намеренно дублируют одноимённые
//! приватные функции `handlers::ai` (не `pub`, так что их нельзя переиспользовать
//! без правки ai.rs, а её параллельно правит другой агент) — копии маленькие и
//! однострочно проверяются на совпадение семантики.

use std::collections::HashMap;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};
use crate::middleware::{auth::AuthenticatedUser, rate_limiter::AppRateLimiter};
use crate::trainer;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::Arc;

#[derive(Serialize)]
pub struct TrainerError {
    pub error: String,
}

type ApiErr = (StatusCode, Json<TrainerError>);

fn err(status: StatusCode, message: impl Into<String>) -> ApiErr {
    (status, Json(TrainerError { error: message.into() }))
}

fn db_err(e: sqlx::Error) -> ApiErr {
    err(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

fn llm_err(e: llm::LlmError) -> ApiErr {
    let status = match e {
        llm::LlmError::Upstream(_) => StatusCode::BAD_GATEWAY,
        llm::LlmError::Config(_) | llm::LlmError::Protocol(_) => StatusCode::INTERNAL_SERVER_ERROR,
    };
    err(status, e.to_string())
}

/// Копия `handlers::ai::check_rate_limit` — тот же лимит (5/мин на пользователя),
/// тот же `AppRateLimiter` из состояния приложения.
fn check_rate_limit(rate_limiter: &AppRateLimiter, user_sub: &str) -> Result<Uuid, ApiErr> {
    let user_uuid = Uuid::parse_str(user_sub).map_err(|_| err(StatusCode::UNAUTHORIZED, "Invalid User UUID"))?;
    let limiter = rate_limiter
        .entry(user_uuid)
        .or_insert_with(|| Arc::new(RateLimiter::direct(Quota::per_minute(NonZeroU32::new(5).unwrap()))));
    if limiter.check().is_err() {
        return Err(err(StatusCode::TOO_MANY_REQUESTS, "Rate limit exceeded. Try again in a minute."));
    }
    Ok(user_uuid)
}

/// Копия `handlers::ai::ensure_set_access`: владелец или публичный набор.
async fn ensure_set_access(pool: &PgPool, set_id: Uuid, user_uuid: Uuid) -> Result<(), ApiErr> {
    let row: Option<(bool, Uuid)> = sqlx::query_as("SELECT is_public, creator_id FROM sets WHERE id = $1")
        .bind(set_id)
        .fetch_optional(pool)
        .await
        .map_err(db_err)?;

    match row {
        Some((is_public, creator_id)) if is_public || creator_id == user_uuid => Ok(()),
        Some(_) => Err(err(StatusCode::FORBIDDEN, "You do not have access to this set")),
        None => Err(err(StatusCode::NOT_FOUND, "Set not found")),
    }
}

// ---------- Запросы/ответы ----------

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct PrepareRequest {
    pub card_ids: Option<Vec<String>>,
    pub limit: Option<u32>,
}

#[derive(Serialize)]
pub struct MnemonicResponse {
    pub mnemonic: String,
}

// ---------- Чтение/запись строк БД ----------

fn profile_from_row(card_id: Uuid, row: &sqlx::postgres::PgRow) -> trainer::CardProfile {
    let example: Option<serde_json::Value> = row.get("example");
    trainer::CardProfile {
        card_id: card_id.to_string(),
        kind: row.get("kind"),
        lang_front: row.get("lang_front"),
        lang_back: row.get("lang_back"),
        lemma: row.get("lemma"),
        gender: row.get("gender"),
        example: example.and_then(|v| serde_json::from_value(v).ok()),
        mnemonic: row.get("mnemonic"),
    }
}

fn exercise_from_row(row: sqlx::postgres::PgRow) -> trainer::TrainerExercise {
    let id: Uuid = row.get("id");
    let card_id: Uuid = row.get("flashcard_id");
    let accepted: serde_json::Value = row.get("accepted_answers");
    let accepted_answers: Vec<String> = serde_json::from_value(accepted).unwrap_or_default();
    let options: Option<serde_json::Value> = row.get("options");
    let options: Option<Vec<String>> = options.and_then(|v| serde_json::from_value(v).ok());
    trainer::TrainerExercise {
        id: id.to_string(),
        card_id: card_id.to_string(),
        kind: row.get("kind"),
        prompt: row.get("prompt"),
        prompt_lang: row.get("prompt_lang"),
        answer: row.get("answer"),
        accepted_answers,
        answer_lang: row.get("answer_lang"),
        options,
        hint: row.get("hint"),
        explanation: row.get("explanation"),
        confidence: row.get("confidence"),
    }
}

async fn store_exercise(pool: &PgPool, card_id: Uuid, hash: &str, draft: trainer::ExerciseDraft) -> Result<trainer::TrainerExercise, sqlx::Error> {
    let accepted = serde_json::to_value(&draft.accepted_answers).unwrap_or(serde_json::json!([]));
    let options = draft.options.as_ref().map(|o| serde_json::to_value(o).unwrap_or(serde_json::Value::Null));
    let row = sqlx::query(
        "INSERT INTO card_exercises
            (flashcard_id, kind, prompt, prompt_lang, answer, accepted_answers, answer_lang, options, hint, explanation, confidence, card_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",
    )
    .bind(card_id)
    .bind(&draft.kind)
    .bind(&draft.prompt)
    .bind(&draft.prompt_lang)
    .bind(&draft.answer)
    .bind(&accepted)
    .bind(&draft.answer_lang)
    .bind(&options)
    .bind(&draft.hint)
    .bind(&draft.explanation)
    .bind(draft.confidence)
    .bind(hash)
    .fetch_one(pool)
    .await?;
    let id: Uuid = row.get("id");
    Ok(draft.into_exercise(id, card_id))
}

const DETERMINISTIC_KINDS: [&str; 5] = ["recall", "listen", "speak", "gender", "recognize"];

async fn load_stored_exercises(pool: &PgPool, card_id: Uuid, hash: &str, kinds: &[&str]) -> Vec<trainer::TrainerExercise> {
    let kinds_owned: Vec<String> = kinds.iter().map(|s| s.to_string()).collect();
    sqlx::query(
        "SELECT id, flashcard_id, kind, prompt, prompt_lang, answer, accepted_answers, answer_lang, options, hint, explanation, confidence
         FROM card_exercises WHERE flashcard_id = $1 AND card_hash = $2 AND kind = ANY($3)",
    )
    .bind(card_id)
    .bind(hash)
    .bind(&kinds_owned)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .into_iter()
    .map(exercise_from_row)
    .collect()
}

/// Профиль под текущий `card_hash` — если есть, отдаём как есть; иначе строим
/// заново (эвристики + судья) и сохраняем. При смене хэша прежние упражнения
/// карточки больше не соответствуют содержимому — удаляем.
async fn load_or_build_profile(pool: &PgPool, card: &trainer::RawCard, hash: &str) -> trainer::CardProfile {
    if let Ok(Some(row)) = sqlx::query("SELECT kind, lang_front, lang_back, lemma, gender, example, mnemonic FROM card_profiles WHERE flashcard_id = $1 AND card_hash = $2")
        .bind(card.id)
        .bind(hash)
        .fetch_optional(pool)
        .await
    {
        return profile_from_row(card.id, &row);
    }

    let profile = trainer::build_profile(card).await;

    let _ = sqlx::query("DELETE FROM card_exercises WHERE flashcard_id = $1 AND card_hash <> $2")
        .bind(card.id)
        .bind(hash)
        .execute(pool)
        .await;

    let example_json = profile.example.as_ref().and_then(|e| serde_json::to_value(e).ok());
    let _ = sqlx::query(
        "INSERT INTO card_profiles (flashcard_id, kind, lang_front, lang_back, lemma, gender, example, mnemonic, card_hash, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
         ON CONFLICT (flashcard_id) DO UPDATE SET
            kind = EXCLUDED.kind, lang_front = EXCLUDED.lang_front, lang_back = EXCLUDED.lang_back,
            lemma = EXCLUDED.lemma, gender = EXCLUDED.gender, example = EXCLUDED.example,
            mnemonic = EXCLUDED.mnemonic, card_hash = EXCLUDED.card_hash, updated_at = NOW()",
    )
    .bind(card.id)
    .bind(&profile.kind)
    .bind(&profile.lang_front)
    .bind(&profile.lang_back)
    .bind(&profile.lemma)
    .bind(&profile.gender)
    .bind(&example_json)
    .bind(&profile.mnemonic)
    .bind(hash)
    .execute(pool)
    .await;

    profile
}

async fn update_profile_example(pool: &PgPool, card_id: Uuid, hash: &str, example: &trainer::CardExample) {
    let v = serde_json::to_value(example).unwrap_or(serde_json::Value::Null);
    let _ = sqlx::query("UPDATE card_profiles SET example = $1, updated_at = NOW() WHERE flashcard_id = $2 AND card_hash = $3")
        .bind(v)
        .bind(card_id)
        .bind(hash)
        .execute(pool)
        .await;
}

/// Соседние карточки того же набора — материал для дистракторов `recognize`.
/// Берём только карточки с профилем, актуальным под их же `card_hash` (иначе
/// определение/вид могли устареть) — self-healing вместо отдельной миграции.
async fn load_sibling_profiles(pool: &PgPool, set_id: Uuid) -> Vec<trainer::SiblingCard> {
    let rows = sqlx::query(
        "SELECT f.id, f.term, f.definition, f.fields_data, p.kind, p.lang_back, p.card_hash
         FROM flashcards f JOIN card_profiles p ON p.flashcard_id = f.id
         WHERE f.set_id = $1",
    )
    .bind(set_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .filter_map(|row| {
            let id: Uuid = row.get("id");
            let term: String = row.get("term");
            let definition: String = trainer::strip_ipa(&row.get::<String, _>("definition"));
            let fields_data: serde_json::Value = row.get("fields_data");
            let stored_hash: String = row.get("card_hash");
            let current = trainer::RawCard { id, term, definition: definition.clone(), fields_data };
            if trainer::card_hash(&current) != stored_hash {
                return None;
            }
            Some(trainer::SiblingCard { id, kind: row.get("kind"), lang_back: row.get("lang_back"), definition })
        })
        .collect()
}

async fn load_or_build_deterministic(
    pool: &PgPool,
    card: &trainer::RawCard,
    profile: &trainer::CardProfile,
    hash: &str,
    siblings: &[trainer::SiblingCard],
) -> Vec<trainer::TrainerExercise> {
    let existing = load_stored_exercises(pool, card.id, hash, &DETERMINISTIC_KINDS).await;
    if !existing.is_empty() {
        return existing;
    }

    let mut drafts = vec![trainer::build_recall(card, profile), trainer::build_listen(card, profile), trainer::build_speak(card, profile)];
    if let Some(g) = trainer::build_gender(card, profile) {
        drafts.push(g);
    }
    if let Some(r) = trainer::build_recognize(card, profile, siblings).await {
        drafts.push(r);
    }

    let mut stored = Vec::with_capacity(drafts.len());
    for draft in drafts {
        if let Ok(ex) = store_exercise(pool, card.id, hash, draft).await {
            stored.push(ex);
        }
    }
    stored
}

async fn load_cards(pool: &PgPool, set_id: Uuid, card_ids: Option<&[String]>) -> Result<Vec<trainer::RawCard>, ApiErr> {
    let rows = match card_ids {
        Some(ids) => {
            let ids: Vec<Uuid> = ids.iter().filter_map(|s| Uuid::parse_str(s).ok()).collect();
            if ids.is_empty() {
                return Ok(Vec::new());
            }
            sqlx::query("SELECT id, term, definition, fields_data FROM flashcards WHERE set_id = $1 AND id = ANY($2) ORDER BY order_index ASC")
                .bind(set_id)
                .bind(&ids)
                .fetch_all(pool)
                .await
        }
        None => {
            sqlx::query("SELECT id, term, definition, fields_data FROM flashcards WHERE set_id = $1 ORDER BY order_index ASC")
                .bind(set_id)
                .fetch_all(pool)
                .await
        }
    }
    .map_err(db_err)?;

    Ok(rows
        .into_iter()
        .map(|row| trainer::RawCard { id: row.get("id"), term: row.get("term"), definition: trainer::strip_ipa(&row.get::<String, _>("definition")), fields_data: row.get("fields_data") })
        .collect())
}

async fn load_card_with_access(pool: &PgPool, card_id: Uuid, user_uuid: Uuid) -> Result<trainer::RawCard, ApiErr> {
    let row = sqlx::query(
        "SELECT f.id, f.term, f.definition, f.fields_data, s.is_public, s.creator_id
         FROM flashcards f JOIN sets s ON s.id = f.set_id WHERE f.id = $1",
    )
    .bind(card_id)
    .fetch_optional(pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| err(StatusCode::NOT_FOUND, "Card not found"))?;

    let is_public: bool = row.get("is_public");
    let creator_id: Uuid = row.get("creator_id");
    if !(is_public || creator_id == user_uuid) {
        return Err(err(StatusCode::FORBIDDEN, "You do not have access to this card"));
    }

    Ok(trainer::RawCard { id: row.get("id"), term: row.get("term"), definition: trainer::strip_ipa(&row.get::<String, _>("definition")), fields_data: row.get("fields_data") })
}

// ---------- Обработчики ----------

/// POST /api/sets/{id}/trainer/prepare
pub async fn prepare_set(
    State(pool): State<PgPool>,
    State(rate_limiter): State<AppRateLimiter>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(set_id_str): Path<String>,
    Json(payload): Json<PrepareRequest>,
) -> Result<Json<trainer::PreparedSet>, ApiErr> {
    let user_uuid = check_rate_limit(&rate_limiter, &user.sub)?;
    let set_id = Uuid::parse_str(&set_id_str).map_err(|_| err(StatusCode::BAD_REQUEST, "Invalid set ID format"))?;
    ensure_set_access(&pool, set_id, user_uuid).await?;

    let limit = payload.limit.unwrap_or(8).clamp(1, 30) as usize;
    // Прокси сайта обрывает запрос на 30-й секунде, а одна карточка через LLM —
    // это несколько вызовов подряд. Укладываемся в запас: что не успели,
    // уходит в pending и достраивается следующим вызовом.
    let started = std::time::Instant::now();
    let llm_time_budget = std::time::Duration::from_secs(
        std::env::var("TRAINER_LLM_BUDGET_SECS").ok().and_then(|v| v.parse().ok()).unwrap_or(18),
    );

    let cards = load_cards(&pool, set_id, payload.card_ids.as_deref()).await?;
    if cards.is_empty() {
        return Ok(Json(trainer::PreparedSet { profiles: Vec::new(), exercises: Vec::new(), pending: 0 }));
    }

    // Профили всех запрошенных карточек — нужны и в ответе, и как контекст для
    // дистракторов recognize друг друга в этом же вызове.
    let mut profiles = Vec::with_capacity(cards.len());
    let mut hashes = HashMap::with_capacity(cards.len());
    for card in &cards {
        let hash = trainer::card_hash(card);
        let profile = load_or_build_profile(&pool, card, &hash).await;
        profiles.push(profile);
        hashes.insert(card.id, hash);
    }

    // Соседи для recognize: уже сохранённые профили набора + только что
    // посчитанные для этого вызова (иначе на самый первый prepare набора
    // дистракторов взять неоткуда).
    let mut siblings: HashMap<Uuid, trainer::SiblingCard> = load_sibling_profiles(&pool, set_id)
        .await
        .into_iter()
        .map(|s| (s.id, s))
        .collect();
    for (card, profile) in cards.iter().zip(profiles.iter()) {
        siblings.insert(card.id, trainer::SiblingCard { id: card.id, kind: profile.kind.clone(), lang_back: profile.lang_back.clone(), definition: card.definition.clone() });
    }
    let siblings: Vec<trainer::SiblingCard> = siblings.into_values().collect();

    let mut exercises: Vec<trainer::TrainerExercise> = Vec::new();
    let mut pending: u32 = 0;
    let mut llm_budget = limit;

    for (card, profile) in cards.iter().zip(profiles.iter()) {
        let hash = &hashes[&card.id];

        let det = load_or_build_deterministic(&pool, card, profile, hash, &siblings).await;
        exercises.extend(det);

        let needed_kinds = trainer::llm_kinds_for(&profile.kind);
        if needed_kinds.is_empty() {
            continue;
        }

        let stored_llm = load_stored_exercises(&pool, card.id, hash, &needed_kinds).await;
        let have: std::collections::HashSet<&str> = stored_llm.iter().map(|e| e.kind.as_str()).collect();
        let missing: Vec<&'static str> = needed_kinds.iter().copied().filter(|k| !have.contains(k)).collect();

        if missing.is_empty() {
            exercises.extend(stored_llm);
            continue;
        }

        if llm_budget == 0 || started.elapsed() >= llm_time_budget {
            pending += 1;
            exercises.extend(stored_llm);
            continue;
        }
        llm_budget -= 1;

        // Последовательно (не concurrently!) — общий LLM-бэкенд обслуживает один
        // запрос за раз, и generate_llm_exercises сама делает несколько вызовов подряд.
        let (drafts, example) = trainer::generate_llm_exercises(card, profile, &missing).await;
        let mut stored_new = Vec::with_capacity(drafts.len());
        for draft in drafts {
            if let Ok(saved) = store_exercise(&pool, card.id, hash, draft).await {
                stored_new.push(saved);
            }
        }
        if let Some(example) = example {
            update_profile_example(&pool, card.id, hash, &example).await;
        }

        exercises.extend(stored_llm);
        exercises.extend(stored_new);
    }

    Ok(Json(trainer::PreparedSet { profiles, exercises, pending }))
}

/// POST /api/cards/{id}/mnemonic
pub async fn generate_mnemonic(
    State(pool): State<PgPool>,
    State(rate_limiter): State<AppRateLimiter>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(card_id_str): Path<String>,
) -> Result<Json<MnemonicResponse>, ApiErr> {
    let user_uuid = check_rate_limit(&rate_limiter, &user.sub)?;
    let card_id = Uuid::parse_str(&card_id_str).map_err(|_| err(StatusCode::BAD_REQUEST, "Invalid card ID format"))?;

    let card = load_card_with_access(&pool, card_id, user_uuid).await?;
    let hash = trainer::card_hash(&card);

    if let Ok(Some(row)) = sqlx::query("SELECT mnemonic FROM card_profiles WHERE flashcard_id = $1 AND card_hash = $2 AND mnemonic IS NOT NULL")
        .bind(card_id)
        .bind(&hash)
        .fetch_optional(&pool)
        .await
    {
        let mnemonic: String = row.get("mnemonic");
        return Ok(Json(MnemonicResponse { mnemonic }));
    }

    // Обеспечиваем строку профиля под текущий хэш перед тем, как класть в неё мнемонику.
    let profile = load_or_build_profile(&pool, &card, &hash).await;

    let system = "Ты помогаешь человеку запомнить иностранное слово методом ключевых слов/ярких ассоциаций. \
        Придумай ОДНУ короткую, живую ассоциацию по-русски (1-2 предложения). Без списков, без заголовков, \
        без markdown — просто фраза.";
    let user_prompt = format!("Слово: «{}» ({}). Перевод: «{}».", card.term, profile.lang_front, card.definition);

    let content = llm::chat_text(ChatRequest {
        task: Task::Chat,
        messages: vec![ChatMessage::system(system), ChatMessage::user(user_prompt)],
        max_tokens: 200,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    .map_err(llm_err)?;
    let mnemonic = content.trim().to_string();

    let _ = sqlx::query("UPDATE card_profiles SET mnemonic = $1, updated_at = NOW() WHERE flashcard_id = $2 AND card_hash = $3")
        .bind(&mnemonic)
        .bind(card_id)
        .bind(&hash)
        .execute(&pool)
        .await;

    Ok(Json(MnemonicResponse { mnemonic }))
}
