//! AI Content Creator — извлечение карточек из произвольного текста (книга,
//! субтитры, конспект) с учётом языковых настроек и уровня ученика.
//!
//! Модель (gpt-oss:120b через crate::llm) не соблюдает JSON Schema, поэтому
//! ключи ответа диктуются прямо в тексте промпта, а разбор — null-толерантный
//! (см. `de_str` и `extract_json` в `handlers::ai`, тот же приём здесь).
//!
//! Файл нарочно самодостаточен и не трогает `handlers::ai` (кроме публичной
//! `extract_json`/`AiGatewayError`): над ai.rs параллельно работают другие
//! агенты, поэтому небольшая часть кода (rate-limit чек) здесь продублирована,
//! а не расшарена через приватные функции соседнего модуля.

use axum::{
    extract::State,
    http::StatusCode,
    response::{
        sse::{Event, Sse},
        IntoResponse,
    },
    Json,
};
use futures::{
    stream::{self, BoxStream, StreamExt},
};
use governor::{Quota, RateLimiter};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::{collections::HashSet, convert::Infallible, num::NonZeroU32, sync::Arc};
use uuid::Uuid;

use crate::handlers::ai::{extract_json, AiGatewayError};
use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};
use crate::middleware::auth::AuthenticatedUser;
use crate::middleware::rate_limiter::AppRateLimiter;

// ---------- Настройки генерации ----------

const MIN_COUNT: u32 = 10;
const MAX_COUNT: u32 = 40;
/// Текст режется до этого числа символов перед отправкой модели — контекстное
/// окно ограничено, а PDF/книги приходят целиком (страница читалки грузит
/// файл на клиенте и шлёт сырой текст без порезки).
const SOURCE_CHAR_LIMIT: usize = 12000;
const ALLOWED_LEVELS: [&str; 5] = ["A1", "A2", "B1", "B2", "C1"];

fn default_translation_language() -> String {
    "ru".to_string()
}
fn default_level() -> String {
    "A1".to_string()
}
fn default_extract() -> String {
    "both".to_string()
}
fn default_count() -> u32 {
    20
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreatorAnalyzeRequest {
    pub content: String,
    /// Пусто или "auto" — определить язык исходника самой моделью.
    #[serde(default)]
    pub source_language: String,
    #[serde(default = "default_translation_language")]
    pub translation_language: String,
    /// CEFR A1–C1; неизвестное значение откатывается на A1.
    #[serde(default = "default_level")]
    pub level: String,
    /// "words" | "phrases" | "both".
    #[serde(default = "default_extract")]
    pub extract: String,
    /// Сколько карточек извлечь; зажимается в [MIN_COUNT, MAX_COUNT].
    #[serde(default = "default_count")]
    pub count: u32,
    /// Необязательная цель обучения — влияет на промпт и на то, разрешены ли
    /// имена собственные (см. `wants_proper_nouns`).
    #[serde(default)]
    pub learning_goal: String,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RegenerateCardRequest {
    pub content: String,
    #[serde(default)]
    pub source_language: String,
    #[serde(default = "default_translation_language")]
    pub translation_language: String,
    #[serde(default = "default_level")]
    pub level: String,
    #[serde(default = "default_extract")]
    pub extract: String,
    #[serde(default)]
    pub learning_goal: String,
    /// Термин отклонённой карточки — модели прямо говорим не повторять его.
    #[serde(default)]
    pub term: String,
    /// Остальные термины уже в обзоре — тоже избегаем повтора и дублей.
    #[serde(default)]
    pub avoid_terms: Vec<String>,
}

/// Разрешённый уровень CEFR; неизвестное значение — тихий откат на A1, чтобы
/// не ронять запрос из-за опечатки в query-параметре с фронта.
fn resolve_level(level: &str) -> String {
    let up = level.trim().to_uppercase();
    if ALLOWED_LEVELS.contains(&up.as_str()) {
        up
    } else {
        "A1".to_string()
    }
}

fn resolve_extract(extract: &str) -> String {
    match extract.trim().to_lowercase().as_str() {
        "words" => "words".to_string(),
        "phrases" => "phrases".to_string(),
        _ => "both".to_string(),
    }
}

fn resolve_count(count: u32) -> u32 {
    count.clamp(MIN_COUNT, MAX_COUNT)
}

fn resolve_translation_language(lang: &str) -> String {
    let t = lang.trim();
    if t.is_empty() {
        "ru".to_string()
    } else {
        t.to_string()
    }
}

/// Эвристика: ученик явно просил имена/названия — тогда не отбраковываем
/// карточки, похожие на имена собственные. Без явной просьбы такие карточки
/// обычно мусор (вырванное из текста имя персонажа без учебной ценности).
fn wants_proper_nouns(learning_goal: &str) -> bool {
    let g = learning_goal.to_lowercase();
    ["имен", "названи", "proper noun", "proper name", "geographic", "имён"]
        .iter()
        .any(|k| g.contains(k))
}

struct Settings {
    source_language: String,
    translation_language: String,
    level: String,
    extract: String,
    count: u32,
    learning_goal: String,
    allow_proper_nouns: bool,
}

impl Settings {
    fn from_analyze(req: &CreatorAnalyzeRequest) -> Self {
        let learning_goal: String = req.learning_goal.chars().take(300).collect();
        Settings {
            source_language: req.source_language.trim().to_string(),
            translation_language: resolve_translation_language(&req.translation_language),
            level: resolve_level(&req.level),
            extract: resolve_extract(&req.extract),
            count: resolve_count(req.count),
            allow_proper_nouns: wants_proper_nouns(&learning_goal),
            learning_goal,
        }
    }

    fn from_regenerate(req: &RegenerateCardRequest) -> Self {
        let learning_goal: String = req.learning_goal.chars().take(300).collect();
        Settings {
            source_language: req.source_language.trim().to_string(),
            translation_language: resolve_translation_language(&req.translation_language),
            level: resolve_level(&req.level),
            extract: resolve_extract(&req.extract),
            count: 1,
            allow_proper_nouns: wants_proper_nouns(&learning_goal),
            learning_goal,
        }
    }
}

fn names_rule(allow: bool) -> &'static str {
    if allow {
        "Proper names (people, places, brands) may be included when relevant."
    } else {
        "Do NOT extract proper names (people, places, brands) — the learner did not ask for them."
    }
}

fn build_analyze_system_prompt(settings: &Settings) -> String {
    let source_desc = if settings.source_language.is_empty()
        || settings.source_language.eq_ignore_ascii_case("auto")
    {
        "Detect the source language automatically from the text below.".to_string()
    } else {
        format!("The source text is in {}.", settings.source_language)
    };
    let extract_desc = match settings.extract.as_str() {
        "words" => "single words only (no multi-word phrases)",
        "phrases" => "multi-word phrases and set expressions only (no single standalone words)",
        _ => "both single words and useful multi-word phrases",
    };
    let goal_block = if settings.learning_goal.is_empty() {
        String::new()
    } else {
        format!("\nLearner's stated goal: {}.", settings.learning_goal)
    };

    format!(
        "You are Memora's AI Content Creator for a language-learning flashcard app. Extract flashcards from the \
         user's text for a learner at CEFR level {level}. {source_desc} Translate into {translation_language}. \
         Extract {extract_desc}. Extract up to {count} cards — fewer is fine if the text is short, but NEVER invent \
         vocabulary that is not actually in the text.{goal_block}\n\
         Output ONLY a raw JSON object with EXACTLY these keys, no markdown, no commentary:\n\
         {{\"proposedTitle\": string, \"proposedDescription\": string, \"cards\": [{{\"term\": string, \
         \"translation\": string, \"partOfSpeech\": string, \"example\": string, \"exampleTranslation\": string, \
         \"ipa\": string}}]}}\n\
         Field rules:\n\
         - \"term\" is the BASE/DICTIONARY form: French verbs as the infinitive, nouns WITH their article and \
           gender (e.g. \"le chat\", \"la maison\"), adjectives in the masculine singular.\n\
         - \"example\" is a sentence taken from the source text (as close to verbatim as possible) that contains \
           this word or phrase in some form. \"exampleTranslation\" translates that sentence.\n\
         - \"ipa\" is the IPA transcription of the term.\n\
         - \"partOfSpeech\" is short (nom, verbe, adjectif, adverbe, expression...).\n\
         - Every term must actually occur, in some form, in the source text below. Do not repeat the same lemma twice.\n\
         - {names_rule}\n\
         - Do not use markdown code blocks.",
        level = settings.level,
        source_desc = source_desc,
        translation_language = settings.translation_language,
        extract_desc = extract_desc,
        count = settings.count,
        goal_block = goal_block,
        names_rule = names_rule(settings.allow_proper_nouns),
    )
}

fn build_regenerate_system_prompt(settings: &Settings, avoid: &[String]) -> String {
    let avoid_list = if avoid.is_empty() {
        "—".to_string()
    } else {
        avoid.join(", ")
    };
    let source_desc = if settings.source_language.is_empty()
        || settings.source_language.eq_ignore_ascii_case("auto")
    {
        "Detect the source language automatically from the text below.".to_string()
    } else {
        format!("The source text is in {}.", settings.source_language)
    };
    format!(
        "You are Memora's AI Content Creator. The learner rejected one flashcard from a batch and wants exactly ONE \
         replacement card, extracted from the SAME source text, for CEFR level {level}. {source_desc} Translate \
         into {translation_language}. Do NOT reuse any of these terms (already accepted or rejected): {avoid_list}.\n\
         Output ONLY a raw JSON object with EXACTLY these keys, no markdown:\n\
         {{\"term\": string, \"translation\": string, \"partOfSpeech\": string, \"example\": string, \
         \"exampleTranslation\": string, \"ipa\": string}}\n\
         \"term\" is the BASE/DICTIONARY form (French verbs as infinitive, nouns WITH article and gender, \
         adjectives masculine singular) and MUST actually occur, in some form, in the source text. {names_rule}",
        level = settings.level,
        source_desc = source_desc,
        translation_language = settings.translation_language,
        avoid_list = avoid_list,
        names_rule = names_rule(settings.allow_proper_nouns),
    )
}

// ---------- Null-толерантный разбор ответа модели ----------

fn de_str<'de, D: serde::Deserializer<'de>>(d: D) -> Result<String, D::Error> {
    use serde::Deserialize;
    Ok(Option::<String>::deserialize(d)?.unwrap_or_default())
}

#[derive(Deserialize, Debug, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct RawCard {
    #[serde(default, deserialize_with = "de_str")]
    term: String,
    #[serde(default, deserialize_with = "de_str")]
    translation: String,
    #[serde(default, deserialize_with = "de_str")]
    part_of_speech: String,
    #[serde(default, deserialize_with = "de_str")]
    example: String,
    #[serde(default, deserialize_with = "de_str")]
    example_translation: String,
    #[serde(default, deserialize_with = "de_str")]
    ipa: String,
}

#[derive(Deserialize, Debug, Default)]
#[serde(rename_all = "camelCase")]
struct RawAnalyzeResult {
    #[serde(default, deserialize_with = "de_str")]
    proposed_title: String,
    #[serde(default, deserialize_with = "de_str")]
    proposed_description: String,
    #[serde(default)]
    cards: Vec<RawCard>,
}

// ---------- Ответ ----------

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CreatorCard {
    pub term: String,
    pub definition: String,
    pub part_of_speech: String,
    pub example: String,
    pub example_translation: String,
    pub ipa: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CreatorAnalyzeResponse {
    pub proposed_title: String,
    pub proposed_description: String,
    pub cards: Vec<CreatorCard>,
    /// Сколько карточек отсеяно как дубликаты (внутри пачки или среди уже
    /// имеющихся карточек пользователя) — показываем в UI для прозрачности.
    pub skipped_duplicates: usize,
    /// Сколько отсеяно как явный мусор (пусто/цифры/не из текста/имя без запроса).
    pub skipped_invalid: usize,
}

// ---------- Нормализация и качество ----------

/// Сворачивает распространённые французские диакритики к ASCII-базе — для
/// сравнения (не для показа: в ответе термины остаются с акцентами).
fn fold_diacritics(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            'à' | 'á' | 'â' | 'ä' | 'ã' => 'a',
            'À' | 'Á' | 'Â' | 'Ä' | 'Ã' => 'A',
            'è' | 'é' | 'ê' | 'ë' => 'e',
            'È' | 'É' | 'Ê' | 'Ë' => 'E',
            'ì' | 'í' | 'î' | 'ï' => 'i',
            'Ì' | 'Í' | 'Î' | 'Ï' => 'I',
            'ò' | 'ó' | 'ô' | 'ö' | 'õ' => 'o',
            'Ò' | 'Ó' | 'Ô' | 'Ö' | 'Õ' => 'O',
            'ù' | 'ú' | 'û' | 'ü' => 'u',
            'Ù' | 'Ú' | 'Û' | 'Ü' => 'U',
            'ç' => 'c',
            'Ç' => 'C',
            'œ' => 'o',
            'Œ' => 'O',
            'æ' => 'a',
            'Æ' => 'A',
            'ñ' => 'n',
            'Ñ' => 'N',
            other => other,
        })
        .collect()
}

const FRENCH_ARTICLES: [&str; 8] = ["les ", "des ", "le ", "la ", "l'", "l\u{2019}", "un ", "une "];

fn strip_leading_article(s: &str) -> &str {
    for art in FRENCH_ARTICLES {
        if let Some(rest) = s.strip_prefix(art) {
            return rest;
        }
    }
    s
}

/// Ключ для сравнения терминов: без диакритики, без ведущего артикля, без
/// лишних пробелов, в нижнем регистре. НЕ предназначен для показа пользователю.
fn normalize_term(s: &str) -> String {
    let folded = fold_diacritics(&s.to_lowercase());
    let stripped = strip_leading_article(folded.trim());
    stripped.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn normalize_source(s: &str) -> String {
    fold_diacritics(&s.to_lowercase())
}

/// Термин выглядит как имя собственное: 1–3 слова, каждое с большой буквы и
/// без цифр/знаков внутри. Артикль перед французским существительным
/// («la maison») начинается со строчной — под это правило не попадает.
fn looks_like_proper_noun(term: &str) -> bool {
    let words: Vec<&str> = term.split_whitespace().collect();
    if words.is_empty() || words.len() > 3 {
        return false;
    }
    words.iter().all(|w| {
        let mut chars = w.chars();
        match chars.next() {
            Some(first) => first.is_uppercase() && chars.all(|c| !c.is_alphabetic() || c.is_lowercase()),
            None => false,
        }
    })
}

/// Явный мусор: пусто, термин совпадает с переводом, термин без единой буквы
/// (голые цифры/пунктуация), или похоже на имя собственное без явного запроса.
fn looks_like_junk(term: &str, definition: &str, allow_proper_nouns: bool) -> bool {
    let t = term.trim();
    let d = definition.trim();
    if t.is_empty() || d.is_empty() {
        return true;
    }
    if t.eq_ignore_ascii_case(d) {
        return true;
    }
    if !t.chars().any(|c| c.is_alphabetic()) {
        return true;
    }
    if !allow_proper_nouns && looks_like_proper_noun(t) {
        return true;
    }
    false
}

/// Слабая (loose), но лемма-осведомлённая проверка «термин взят из текста»:
/// точное вхождение нормализованного термина, а если нет — вхождение «стебля»
/// значимого слова (без последних 2 букв) — так инфинитив «parler» находит
/// в тексте «parle»/«parlons», а не только буквальный «parler».
fn term_in_source(term: &str, normalized_source: &str) -> bool {
    let norm_term = normalize_term(term);
    if norm_term.is_empty() {
        return false;
    }
    if normalized_source.contains(&norm_term) {
        return true;
    }
    norm_term
        .split_whitespace()
        .filter(|w| w.chars().count() >= 4)
        .any(|w| {
            let char_count = w.chars().count();
            let stem_len = char_count.saturating_sub(2).max(3);
            let stem: String = w.chars().take(stem_len).collect();
            normalized_source.contains(&stem)
        })
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
struct ValidationStats {
    duplicates: usize,
    invalid: usize,
}

/// Основная проверка качества: разбирает сырые карточки модели в финальные,
/// отбрасывая мусор и дубликаты (внутри пачки и среди `existing_terms`
/// пользователя), и считает сколько чего отсеяно.
fn validate_and_dedupe(
    raw_cards: Vec<RawCard>,
    source_text: &str,
    existing_terms: &HashSet<String>,
    allow_proper_nouns: bool,
    max_count: usize,
) -> (Vec<CreatorCard>, ValidationStats) {
    let normalized_source = normalize_source(source_text);
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::new();
    let mut stats = ValidationStats::default();

    for raw in raw_cards {
        if out.len() >= max_count {
            break;
        }
        let term = raw.term.trim().to_string();
        let translation = raw.translation.trim().to_string();

        if looks_like_junk(&term, &translation, allow_proper_nouns) {
            stats.invalid += 1;
            continue;
        }
        if !term_in_source(&term, &normalized_source) {
            stats.invalid += 1;
            continue;
        }
        let key = normalize_term(&term);
        if key.is_empty() {
            stats.invalid += 1;
            continue;
        }
        if seen.contains(&key) || existing_terms.contains(&key) {
            stats.duplicates += 1;
            continue;
        }
        seen.insert(key);
        out.push(CreatorCard {
            term,
            definition: translation,
            part_of_speech: raw.part_of_speech.trim().to_string(),
            example: raw.example.trim().to_string(),
            example_translation: raw.example_translation.trim().to_string(),
            ipa: raw.ipa.trim().to_string(),
        });
    }

    (out, stats)
}

// ---------- БД: термины уже существующих карточек пользователя ----------

/// Термины всех карточек во всех наборах, созданных этим пользователем —
/// нормализованные, для сравнения с новыми карточками (dedup против уже
/// сохранённого, а не только внутри текущей пачки).
async fn fetch_existing_terms(pool: &PgPool, user_uuid: Uuid) -> HashSet<String> {
    let rows = sqlx::query(
        "SELECT f.term FROM flashcards f JOIN sets s ON f.set_id = s.id WHERE s.creator_id = $1",
    )
    .bind(user_uuid)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .filter_map(|r| r.try_get::<String, _>("term").ok())
        .map(|t| normalize_term(&t))
        .filter(|t| !t.is_empty())
        .collect()
}

// ---------- Rate limit (продублировано из ai.rs — см. комментарий сверху файла) ----------

fn check_rate_limit(
    rate_limiter: &AppRateLimiter,
    user_sub: &str,
) -> Result<Uuid, (StatusCode, String)> {
    let user_uuid = Uuid::parse_str(user_sub)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid User UUID".to_string()))?;
    let limiter = rate_limiter.entry(user_uuid).or_insert_with(|| {
        Arc::new(RateLimiter::direct(Quota::per_minute(NonZeroU32::new(5).unwrap())))
    });
    if limiter.check().is_err() {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            "Rate limit exceeded. Try again in a minute.".to_string(),
        ));
    }
    Ok(user_uuid)
}

fn error_stream(msg: String) -> Sse<BoxStream<'static, Result<Event, Infallible>>> {
    Sse::new(stream::once(async move { Ok(Event::default().event("error").data(msg)) }).boxed())
}

/// Разбирает буфер стрима в финальный, провалидированный ответ. Ошибки здесь
/// — это "модель прислала не JSON" или "после фильтров карточек не осталось",
/// а не сетевые (те ловятся раньше, в самом стриме LLM).
async fn finalize_analysis(
    pool: &PgPool,
    user_uuid: Uuid,
    raw_content: &str,
    source_text: &str,
    settings: &Settings,
) -> Result<CreatorAnalyzeResponse, String> {
    let json_slice = extract_json(raw_content);
    let parsed: RawAnalyzeResult = serde_json::from_str(json_slice)
        .map_err(|e| format!("Не удалось разобрать ответ модели: {e}"))?;

    let existing_terms = fetch_existing_terms(pool, user_uuid).await;
    let (cards, stats) = validate_and_dedupe(
        parsed.cards,
        source_text,
        &existing_terms,
        settings.allow_proper_nouns,
        settings.count as usize,
    );

    if cards.is_empty() {
        return Err("Не удалось извлечь ни одной подходящей карточки из текста".to_string());
    }

    let title = if parsed.proposed_title.trim().is_empty() {
        "Новый модуль".to_string()
    } else {
        parsed.proposed_title.trim().to_string()
    };

    Ok(CreatorAnalyzeResponse {
        proposed_title: title,
        proposed_description: parsed.proposed_description.trim().to_string(),
        cards,
        skipped_duplicates: stats.duplicates,
        skipped_invalid: stats.invalid,
    })
}

// ---------- Хендлеры ----------

/// POST /api/ai/creator/analyze
///
/// Стримит прогресс (сырые чанки модели — как раньше, для «печатающегося»
/// индикатора в UI), а по завершении генерации шлёт ОТДЕЛЬНОЕ SSE-событие
/// `result` с уже провалидированным и дедуплицированным JSON — фронт больше
/// не парсит сырой текст модели напрямую. При ошибке — событие `error`.
pub async fn analyze_content(
    State(pool): State<PgPool>,
    State(rate_limiter): State<AppRateLimiter>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<CreatorAnalyzeRequest>,
) -> Sse<BoxStream<'static, Result<Event, Infallible>>> {
    let user_uuid = match check_rate_limit(&rate_limiter, &user.sub) {
        Ok(u) => u,
        Err((_, msg)) => return error_stream(msg),
    };

    let settings = Settings::from_analyze(&payload);
    let source_text: String = payload.content.chars().take(SOURCE_CHAR_LIMIT).collect();
    if source_text.trim().is_empty() {
        return error_stream("Пустой текст для анализа".to_string());
    }

    let system_prompt = build_analyze_system_prompt(&settings);
    let llm_stream = match llm::chat_stream(ChatRequest {
        task: Task::Generation,
        messages: vec![ChatMessage::system(system_prompt), ChatMessage::user(source_text.clone())],
        max_tokens: 8192,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    {
        Ok(s) => s,
        Err(e) => return error_stream(e.to_string()),
    };

    let stream = async_stream::stream! {
        // Явные ребайнды переводят замыкание генератора во владение значениями
        // (как уже делает `sse_from_llm` для llm_stream) — иначе поток, обязанный
        // быть 'static, попытался бы заимствовать локальные переменные функции.
        let mut llm_stream = llm_stream;
        let pool = pool;
        let source_text = source_text;
        let settings = settings;
        let user_uuid = user_uuid;
        let mut buf = String::new();
        let mut had_error = false;
        while let Some(item) = llm_stream.next().await {
            match item {
                Ok(chunk) => {
                    buf.push_str(&chunk);
                    yield Ok::<_, Infallible>(Event::default().data(chunk));
                }
                Err(e) => {
                    yield Ok::<_, Infallible>(Event::default().event("error").data(e.to_string()));
                    had_error = true;
                    break;
                }
            }
        }
        if !had_error {
            match finalize_analysis(&pool, user_uuid, &buf, &source_text, &settings).await {
                Ok(response) => {
                    let json = serde_json::to_string(&response).unwrap_or_else(|_| "{}".to_string());
                    yield Ok::<_, Infallible>(Event::default().event("result").data(json));
                }
                Err(msg) => {
                    yield Ok::<_, Infallible>(Event::default().event("error").data(msg));
                }
            }
        }
    };

    Sse::new(stream.boxed())
}

/// POST /api/ai/creator/regenerate-card — заменяет одну карточку обзора:
/// та же логика качества (`validate_and_dedupe`), но на один элемент, и
/// с явным списком терминов, которых избегать (уже принятые/отклонённые).
pub async fn regenerate_card(
    State(pool): State<PgPool>,
    State(rate_limiter): State<AppRateLimiter>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<RegenerateCardRequest>,
) -> impl IntoResponse {
    let user_uuid = match check_rate_limit(&rate_limiter, &user.sub) {
        Ok(u) => u,
        Err((status, msg)) => return (status, Json(AiGatewayError { error: msg })).into_response(),
    };

    let settings = Settings::from_regenerate(&payload);
    let source_text: String = payload.content.chars().take(SOURCE_CHAR_LIMIT).collect();
    if source_text.trim().is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(AiGatewayError { error: "Пустой текст источника".to_string() }),
        )
            .into_response();
    }

    let mut avoid = payload.avoid_terms.clone();
    if !payload.term.is_empty() {
        avoid.push(payload.term.clone());
    }
    let system_prompt = build_regenerate_system_prompt(&settings, &avoid);

    let content = match llm::chat_text(ChatRequest {
        task: Task::Generation,
        messages: vec![ChatMessage::system(system_prompt), ChatMessage::user(source_text.clone())],
        max_tokens: 1000,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    {
        Ok(c) => c,
        Err(e) => {
            return (StatusCode::BAD_GATEWAY, Json(AiGatewayError { error: e.to_string() })).into_response()
        }
    };

    let raw: RawCard = match serde_json::from_str(extract_json(&content)) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AiGatewayError { error: format!("Не разобрал ответ модели: {e}") }),
            )
                .into_response()
        }
    };

    let mut avoid_norm: HashSet<String> = avoid.iter().map(|t| normalize_term(t)).collect();
    avoid_norm.extend(fetch_existing_terms(&pool, user_uuid).await);

    let (cards, _stats) =
        validate_and_dedupe(vec![raw], &source_text, &avoid_norm, settings.allow_proper_nouns, 1);

    match cards.into_iter().next() {
        Some(card) => Json(card).into_response(),
        None => (
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(AiGatewayError {
                error: "Не удалось подобрать замену — попробуйте ещё раз".to_string(),
            }),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---------- normalize_term / fold_diacritics ----------

    #[test]
    fn normalize_term_strips_article_and_diacritics() {
        assert_eq!(normalize_term("la maison"), "maison");
        assert_eq!(normalize_term("le chat"), "chat");
        assert_eq!(normalize_term("l'école"), "ecole");
        assert_eq!(normalize_term("  Été  "), "ete");
    }

    #[test]
    fn normalize_term_collapses_whitespace() {
        assert_eq!(normalize_term("un   grand    chat"), "grand chat");
    }

    #[test]
    fn fold_diacritics_covers_common_french_accents() {
        assert_eq!(fold_diacritics("être élève çà où"), "etre eleve ca ou");
    }

    // ---------- looks_like_junk ----------

    #[test]
    fn junk_when_empty_or_identical() {
        assert!(looks_like_junk("", "chat", false));
        assert!(looks_like_junk("chat", "", false));
        assert!(looks_like_junk("chat", "chat", false));
        assert!(looks_like_junk("Chat", "chat", false)); // регистронезависимо
    }

    #[test]
    fn junk_when_no_letters() {
        assert!(looks_like_junk("1234", "тысяча", false));
        assert!(looks_like_junk("...", "точки", false));
    }

    #[test]
    fn proper_noun_is_junk_unless_requested() {
        assert!(looks_like_junk("Paris", "Париж", false));
        assert!(!looks_like_junk("Paris", "Париж", true));
        // артикль перед существительным не считается именем собственным
        assert!(!looks_like_junk("la maison", "дом", false));
    }

    #[test]
    fn ordinary_word_is_not_junk() {
        assert!(!looks_like_junk("parler", "говорить", false));
        assert!(!looks_like_junk("le chat", "кот", false));
    }

    // ---------- term_in_source ----------

    #[test]
    fn exact_term_found_in_source() {
        let src = normalize_source("Le chat dort sur le canapé.");
        assert!(term_in_source("le chat", &src));
    }

    #[test]
    fn loose_lemma_match_finds_inflected_form() {
        let src = normalize_source("Je parle français tous les jours.");
        // "parler" (инфинитив-карточка) не встречается буквально, только "parle"
        assert!(term_in_source("parler", &src));
    }

    #[test]
    fn term_not_in_source_is_rejected() {
        let src = normalize_source("Le chat dort sur le canapé.");
        assert!(!term_in_source("le chien", &src));
    }

    // ---------- resolve_* ----------

    #[test]
    fn resolve_level_falls_back_to_a1() {
        assert_eq!(resolve_level("b2"), "B2");
        assert_eq!(resolve_level("nonsense"), "A1");
        assert_eq!(resolve_level(""), "A1");
    }

    #[test]
    fn resolve_count_clamps_to_range() {
        assert_eq!(resolve_count(5), MIN_COUNT);
        assert_eq!(resolve_count(1000), MAX_COUNT);
        assert_eq!(resolve_count(25), 25);
    }

    #[test]
    fn resolve_extract_defaults_to_both() {
        assert_eq!(resolve_extract("words"), "words");
        assert_eq!(resolve_extract("PHRASES"), "phrases");
        assert_eq!(resolve_extract("garbage"), "both");
    }

    #[test]
    fn wants_proper_nouns_detects_keywords() {
        assert!(wants_proper_nouns("хочу выучить имена персонажей"));
        assert!(!wants_proper_nouns("бытовая лексика"));
    }

    // ---------- null-tolerant parsing ----------

    #[test]
    fn raw_card_tolerates_nulls_and_missing_fields() {
        let json = r#"{"term":"chat","translation":null}"#;
        let card: RawCard = serde_json::from_str(json).unwrap();
        assert_eq!(card.term, "chat");
        assert_eq!(card.translation, "");
        assert_eq!(card.ipa, "");
    }

    #[test]
    fn raw_analyze_result_tolerates_missing_cards_array() {
        let json = r#"{"proposedTitle":"Titre","proposedDescription":null}"#;
        let parsed: RawAnalyzeResult = serde_json::from_str(json).unwrap();
        assert_eq!(parsed.proposed_title, "Titre");
        assert_eq!(parsed.proposed_description, "");
        assert!(parsed.cards.is_empty());
    }

    #[test]
    fn extract_json_then_parse_survives_wrapper_text() {
        let wrapped = "Sure, here you go:\n```json\n{\"proposedTitle\":\"T\",\"cards\":[]}\n```";
        let parsed: RawAnalyzeResult = serde_json::from_str(extract_json(wrapped)).unwrap();
        assert_eq!(parsed.proposed_title, "T");
    }

    // ---------- validate_and_dedupe ----------

    fn card(term: &str, translation: &str) -> RawCard {
        RawCard {
            term: term.to_string(),
            translation: translation.to_string(),
            part_of_speech: "nom".to_string(),
            example: "example".to_string(),
            example_translation: "пример".to_string(),
            ipa: "[test]".to_string(),
        }
    }

    #[test]
    fn validate_and_dedupe_filters_junk_and_out_of_source() {
        let source = "Le chat dort. La maison est grande.";
        let raw = vec![
            card("le chat", "кот"),        // ок, в тексте
            card("", "пусто"),              // мусор: пустой термин
            card("chat", "chat"),           // мусор: совпадает с переводом
            card("le robot", "робот"),      // не из текста
        ];
        let existing = HashSet::new();
        let (cards, stats) = validate_and_dedupe(raw, source, &existing, false, 10);
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].term, "le chat");
        assert_eq!(stats.invalid, 3);
        assert_eq!(stats.duplicates, 0);
    }

    #[test]
    fn validate_and_dedupe_drops_duplicates_within_batch() {
        let source = "Le chat dort sur le canapé.";
        // Второй термин отличается только регистром существительного (артикль
        // остаётся строчным) — не должен попасть под эвристику имён собственных.
        let raw = vec![card("le chat", "кот"), card("le Chat", "кот (дубль)")];
        let existing = HashSet::new();
        let (cards, stats) = validate_and_dedupe(raw, source, &existing, false, 10);
        assert_eq!(cards.len(), 1);
        assert_eq!(stats.duplicates, 1);
    }

    #[test]
    fn validate_and_dedupe_drops_duplicates_against_existing_cards() {
        let source = "Le chat dort sur le canapé.";
        let raw = vec![card("le chat", "кот")];
        let mut existing = HashSet::new();
        existing.insert(normalize_term("le chat"));
        let (cards, stats) = validate_and_dedupe(raw, source, &existing, false, 10);
        assert!(cards.is_empty());
        assert_eq!(stats.duplicates, 1);
        assert_eq!(stats.invalid, 0);
    }

    #[test]
    fn validate_and_dedupe_respects_max_count() {
        let source = "un deux trois quatre cinq";
        let raw = vec![
            card("un", "один"),
            card("deux", "два"),
            card("trois", "три"),
        ];
        let existing = HashSet::new();
        let (cards, _stats) = validate_and_dedupe(raw, source, &existing, false, 2);
        assert_eq!(cards.len(), 2);
    }
}
