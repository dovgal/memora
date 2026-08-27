// Перевод для читалки: DeepL как основной провайдер, облачная LLM как запасной.
//
// Три причины именно такой конструкции:
//  1. Кэш в БД обязателен. DeepL Free — 500 000 символов в месяц, а читалка
//     дёргает перевод на каждое наведение мыши. Кэш общий на всю платформу:
//     одно и то же слово в одной языковой паре переводится ровно один раз.
//  2. Контекст. Слово вне предложения переводится наугад («замок» → lock/castle).
//     DeepL принимает параметр `context`: окружающий текст улучшает выбор
//     значения и при этом не тарифицируется.
//  3. Фолбэк. Без ключа DeepL (или при его сбое) сервис не должен молчать —
//     переводим через ту же LLM, что и остальной контент.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};
use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

/// Ограничения запроса: защита и от опечатки клиента, и от слива квоты DeepL.
const MAX_TEXTS: usize = 50;          // столько же принимает DeepL за раз
const MAX_TEXT_CHARS: usize = 2_000;  // абзац — да, глава — нет
const MAX_CONTEXT_CHARS: usize = 1_000;

// ---------- DTO ----------

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateRequest {
    /// Один или несколько кусочков. Клиент шлёт пачкой, чтобы не плодить запросы.
    pub texts: Vec<String>,
    pub target_lang: String,
    /// Пусто — пусть определяет провайдер.
    #[serde(default)]
    pub source_lang: String,
    /// Окружение фразы: предложение для слова, абзац для предложения.
    #[serde(default)]
    pub context: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslateResponse {
    pub translations: Vec<String>,
    /// Язык оригинала: либо переданный клиентом, либо определённый DeepL.
    pub source_lang: String,
    pub provider: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryRequest {
    pub word: String,
    /// Предложение, в котором слово встретилось.
    #[serde(default)]
    pub sentence: String,
    pub source_lang: String,
    pub target_lang: String,
}

/// Модель регулярно присылает `null` вместо строки в необязательных полях
/// (`"example": null`). `#[serde(default)]` тут бесполезен — он срабатывает,
/// только когда поля нет вовсе, а явный null serde всё равно пытается положить
/// в String и падает. Разбор всей статьи из-за этого валился целиком.
fn null_as_empty<'de, D>(d: D) -> Result<String, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Ok(Option::<String>::deserialize(d)?.unwrap_or_default())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryMeaning {
    pub gloss: String,
    pub example: String,
}

/// Значение приходит то объектом `{"gloss": …}`, то просто строкой — модель
/// решает это заново на каждый запрос. Принимаем оба вида, иначе разбор
/// статьи зависит от настроения генерации.
impl<'de> Deserialize<'de> for DictionaryMeaning {
    fn deserialize<D>(d: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum Raw {
            Text(String),
            Obj {
                #[serde(default, alias = "meaning", alias = "text", deserialize_with = "null_as_empty")]
                gloss: String,
                #[serde(default, deserialize_with = "null_as_empty")]
                example: String,
            },
        }
        Ok(match Raw::deserialize(d)? {
            Raw::Text(t) => DictionaryMeaning { gloss: t, example: String::new() },
            Raw::Obj { gloss, example } => DictionaryMeaning { gloss, example },
        })
    }
}

/// Список значений: поле целиком может прийти null, и отдельный элемент тоже.
fn meanings_lenient<'de, D>(d: D) -> Result<Vec<DictionaryMeaning>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let raw = Option::<Vec<Option<DictionaryMeaning>>>::deserialize(d)?;
    Ok(raw.unwrap_or_default().into_iter().flatten().collect())
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DictionaryEntry {
    /// Начальная форма: инфинитив, единственное число, мужской род.
    /// Псевдонимы — имена, которые модель выдумывает, когда ей не продиктовать
    /// схему: она отвечает то `base_form`, то `part_of_speech`.
    /// `word` в псевдонимы НЕ берём: модель присылает его вместе с `base_form`,
    /// и serde падает на дубле полей. Потери нет — при пустой lemma
    /// подставляется само запрошенное слово, то есть ровно то же значение.
    #[serde(default, alias = "base_form", alias = "baseForm", deserialize_with = "null_as_empty")]
    pub lemma: String,
    #[serde(default, alias = "part_of_speech", alias = "partOfSpeech", deserialize_with = "null_as_empty")]
    pub pos: String,
    /// Перевод именно в этом контексте — то, ради чего словарь и открывают.
    #[serde(default, alias = "meaning_in_sentence", alias = "meaningInSentence", alias = "in_context", deserialize_with = "null_as_empty")]
    pub in_context: String,
    #[serde(default, alias = "common_meanings", alias = "commonMeanings", deserialize_with = "meanings_lenient")]
    pub meanings: Vec<DictionaryMeaning>,
    #[serde(default, deserialize_with = "null_as_empty")]
    pub note: String,
}

// ---------- Языки ----------

/// Человеческое имя языка для промпта LLM.
pub fn lang_name(code: &str) -> &'static str {
    match code.to_lowercase().split('-').next().unwrap_or("") {
        "ru" => "Russian", "en" => "English", "fr" => "French", "de" => "German",
        "es" => "Spanish", "it" => "Italian", "pt" => "Portuguese", "pl" => "Polish",
        "uk" => "Ukrainian", "nl" => "Dutch", "cs" => "Czech", "sv" => "Swedish",
        "da" => "Danish", "fi" => "Finnish", "no" | "nb" => "Norwegian", "tr" => "Turkish",
        "el" => "Greek", "ro" => "Romanian", "hu" => "Hungarian", "bg" => "Bulgarian",
        "sk" => "Slovak", "sl" => "Slovenian", "et" => "Estonian", "lv" => "Latvian",
        "lt" => "Lithuanian", "ja" => "Japanese", "zh" => "Chinese", "ko" => "Korean",
        "ar" => "Arabic", "he" => "Hebrew", "id" => "Indonesian", "be" => "Belarusian",
        "ca" => "Catalan", "sr" => "Serbian", "hr" => "Croatian", "fa" => "Persian",
        "hi" => "Hindi", "vi" => "Vietnamese", "th" => "Thai", "la" => "Latin",
        _ => "the source language",
    }
}

/// Код языка для DeepL. У цели два кода требуют уточнения варианта
/// (EN-US/EN-GB, PT-PT/PT-BR) — иначе API отвечает 400.
fn deepl_code(code: &str, is_target: bool) -> String {
    let base = code.to_lowercase();
    let base = base.split('-').next().unwrap_or("");
    match (base, is_target) {
        ("en", true) => "EN-US".to_string(),
        ("pt", true) => "PT-PT".to_string(),
        ("nb", _) => "NB".to_string(),
        _ => base.to_uppercase(),
    }
}

// ---------- Кэш ----------

fn cache_key(provider: &str, src: &str, tgt: &str, context: &str, text: &str) -> String {
    let mut h = Sha256::new();
    h.update(format!("{provider}|{src}|{tgt}|{context}|{text}").as_bytes());
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(h.finalize())
}

async fn cache_get(pool: &PgPool, key: &str) -> Option<String> {
    sqlx::query("SELECT translated FROM translation_cache WHERE hash = $1")
        .bind(key)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .map(|r| r.get::<String, _>("translated"))
}

/// Пачка ключей одним запросом. Читалка предзагружает всю страницу разом, и
/// полсотни отдельных SELECT'ов перед каждым листанием — лишние полсекунды.
async fn cache_get_many(pool: &PgPool, keys: &[String]) -> std::collections::HashMap<String, String> {
    let rows = sqlx::query("SELECT hash, translated FROM translation_cache WHERE hash = ANY($1)")
        .bind(keys)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    rows.into_iter()
        .map(|r| (r.get::<String, _>("hash"), r.get::<String, _>("translated")))
        .collect()
}

async fn cache_put(pool: &PgPool, key: &str, provider: &str, src: &str, tgt: &str, text: &str, translated: &str) {
    let _ = sqlx::query(
        "INSERT INTO translation_cache (hash, provider, source_lang, target_lang, source_text, translated)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (hash) DO NOTHING",
    )
    .bind(key).bind(provider).bind(src).bind(tgt).bind(text).bind(translated)
    .execute(pool)
    .await;
}

// ---------- DeepL ----------

/// Ключ Free-плана оканчивается на `:fx` — по нему и выбираем хост,
/// чтобы не заводить отдельную переменную окружения под план.
fn deepl_endpoint(key: &str) -> String {
    if let Ok(url) = std::env::var("DEEPL_API_URL") {
        if !url.trim().is_empty() { return url; }
    }
    if key.trim_end().ends_with(":fx") {
        "https://api-free.deepl.com/v2/translate".to_string()
    } else {
        "https://api.deepl.com/v2/translate".to_string()
    }
}

/// Связка ключей DeepL.
///
/// Бесплатный ключ даёт 500 тысяч знаков в месяц, а книга их съедает за раз.
/// Поэтому ключей может быть несколько, с разных учётных записей: когда на
/// одном кончается месячный запас, перевод продолжается со следующего и дальше
/// по кругу.
struct KeyRing {
    keys: Vec<String>,
    /// До какого времени ключ не трогать. Пусто — ключ рабочий.
    blocked: Vec<Option<std::time::Instant>>,
    /// С какого ключа начинать: исчерпанный не проверяем заново каждый раз.
    cur: usize,
}

/// Запас месяца кончился. Ждём до его обновления, но проверяем и раньше:
/// точную дату сброса DeepL не сообщает.
const QUOTA_COOLDOWN: Duration = Duration::from_secs(6 * 60 * 60);
/// Ключ не принят — почти наверняка опечатка. Долбить им бессмысленно.
const BAD_KEY_COOLDOWN: Duration = Duration::from_secs(24 * 60 * 60);
/// Слишком частые запросы — это про минуту, а не про месяц.
const RATE_COOLDOWN: Duration = Duration::from_secs(60);

static RING: OnceLock<Mutex<KeyRing>> = OnceLock::new();

/// Ключи из окружения: DEEPL_API_KEY, затем DEEPL_API_KEY_2… DEEPL_API_KEY_9.
///
/// Внутри каждой переменной можно перечислить несколько ключей через запятую —
/// так добавить второй аккаунт можно и не заводя новую переменную.
fn read_keys() -> Vec<String> {
    let names = std::iter::once("DEEPL_API_KEY".to_string())
        .chain((2..=9).map(|i| format!("DEEPL_API_KEY_{i}")));
    let raw: Vec<String> = names.filter_map(|n| std::env::var(&n).ok()).collect();
    parse_keys(&raw)
}

/// Разбор перечисления ключей. Отдельно от окружения — чтобы проверялось.
fn parse_keys(values: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for raw in values {
        for part in raw.split([',', ';', '\n']) {
            let k = part.trim().to_string();
            // Один и тот же ключ дважды — это не запас, а лишний поход впустую.
            if !k.is_empty() && !out.contains(&k) { out.push(k); }
        }
    }
    out
}

impl KeyRing {
    /// Следующий ключ, который сейчас можно пробовать.
    fn pick(&mut self, now: std::time::Instant) -> Option<(usize, String)> {
        let n = self.keys.len();
        for step in 0..n {
            let i = (self.cur + step) % n;
            match self.blocked[i] {
                Some(until) if until > now => continue,
                _ => {
                    // Срок вышел — ключ снова в строю.
                    self.blocked[i] = None;
                    self.cur = i;
                    return Some((i, self.keys[i].clone()));
                }
            }
        }
        None
    }

    /// Отставляет ключ на время и переводит стрелку на следующий.
    fn block(&mut self, idx: usize, how_long: Duration, now: std::time::Instant) {
        let n = self.keys.len();
        if idx < n {
            self.blocked[idx] = Some(now + how_long);
            self.cur = (idx + 1) % n;
        }
    }
}

fn ring() -> &'static Mutex<KeyRing> {
    RING.get_or_init(|| {
        let keys = read_keys();
        let blocked = vec![None; keys.len()];
        Mutex::new(KeyRing { keys, blocked, cur: 0 })
    })
}

/// Есть ли вообще чем переводить через DeepL.
fn deepl_key() -> Option<String> {
    ring().lock().ok()?.keys.first().cloned()
}

/// Следующий рабочий ключ: его номер (для журнала) и сам ключ.
fn next_key() -> Option<(usize, String)> {
    ring().lock().ok()?.pick(std::time::Instant::now())
}

fn block_key(idx: usize, how_long: Duration, why: &str) {
    if let Ok(mut r) = ring().lock() {
        r.block(idx, how_long, std::time::Instant::now());
    }
    // В журнал — только номер: ключ в логах Railway не нужен никому.
    eprintln!("[translate] ключ DeepL №{} отложен: {why}", idx + 1);
}

/// Ошибка DeepL вместе с кодом ответа: по коду решаем, менять ли ключ.
struct DeeplError {
    status: Option<u16>,
    message: String,
}

impl std::fmt::Display for DeeplError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.message)
    }
}

/// GET /api/translate/quota — сколько знаков осталось на каждом ключе.
///
/// Сами ключи наружу не отдаём: только их номера, расход и состояние. Иначе
/// узнать, что запас кончается, можно лишь по упавшему качеству перевода.
pub async fn deepl_quota(
    AuthenticatedUser(_user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let keys = ring().lock().map(|r| r.keys.clone()).unwrap_or_default();
    let now = std::time::Instant::now();
    let blocked: Vec<bool> = ring()
        .lock()
        .map(|r| r.blocked.iter().map(|b| matches!(b, Some(t) if *t > now)).collect())
        .unwrap_or_default();

    let client = reqwest::Client::new();
    let mut out = Vec::new();
    for (i, key) in keys.iter().enumerate() {
        let url = deepl_endpoint(key).replace("/translate", "/usage");
        let mut row = json!({
            "n": i + 1,
            "blocked": blocked.get(i).copied().unwrap_or(false),
        });
        match client
            .get(url)
            .header("Authorization", format!("DeepL-Auth-Key {}", key.trim()))
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
            Ok(r) => {
                let status = r.status();
                let body: serde_json::Value = r.json().await.unwrap_or_else(|_| json!({}));
                if status.is_success() {
                    row["used"] = body.get("character_count").cloned().unwrap_or(json!(null));
                    row["limit"] = body.get("character_limit").cloned().unwrap_or(json!(null));
                } else {
                    row["error"] = json!(status.as_u16());
                }
            }
            Err(e) => { row["error"] = json!(e.to_string()); }
        }
        out.push(row);
    }
    Ok((StatusCode::OK, Json(json!({ "keys": out }))))
}

/// Перевод через связку ключей: исчерпанный ключ уступает место следующему.
async fn deepl_translate_rotating(
    texts: &[String], source: &str, target: &str, context: &str,
) -> Result<(Vec<String>, String), String> {
    let total = ring().lock().map(|r| r.keys.len()).unwrap_or(0);
    let mut last = "нет ключей DeepL".to_string();

    for _ in 0..total {
        let Some((idx, key)) = next_key() else { break };
        match deepl_translate(&key, texts, source, target, context).await {
            Ok(v) => return Ok(v),
            Err(e) => {
                let cooldown = match e.status {
                    Some(456) => QUOTA_COOLDOWN,
                    Some(403) => BAD_KEY_COOLDOWN,
                    // Частота — беда минутная, но на другом аккаунте её нет.
                    Some(429) => RATE_COOLDOWN,
                    // Сеть или невнятный ответ: ключ ни при чём, менять нечего.
                    _ => return Err(e.message),
                };
                block_key(idx, cooldown, &e.message);
                last = e.message;
            }
        }
    }
    Err(last)
}


/// Перевод пачки через DeepL. Возвращает переводы и определённый язык оригинала.
async fn deepl_translate(
    key: &str, texts: &[String], source: &str, target: &str, context: &str,
) -> Result<(Vec<String>, String), DeeplError> {
    let mut body = json!({
        "text": texts,
        "target_lang": deepl_code(target, true),
    });
    if !source.is_empty() {
        body["source_lang"] = json!(deepl_code(source, false));
    }
    if !context.is_empty() {
        // Контекст не тарифицируется, но помогает выбрать значение слова.
        body["context"] = json!(context);
    }

    let res = reqwest::Client::new()
        .post(deepl_endpoint(key))
        .header("Authorization", format!("DeepL-Auth-Key {}", key.trim()))
        .json(&body)
        .send()
        .await
        .map_err(|e| DeeplError { status: None, message: format!("DeepL unreachable: {e}") })?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        // 456 — исчерпана квота месяца: сообщение должно быть понятным в UI.
        let hint = match status.as_u16() {
            403 => "неверный ключ DeepL",
            429 => "слишком много запросов к DeepL",
            456 => "исчерпана месячная квота DeepL",
            _ => "DeepL вернул ошибку",
        };
        return Err(DeeplError { status: Some(status.as_u16()), message: format!("{hint} ({status})") });
    }

    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| DeeplError { status: None, message: format!("DeepL: неразборный ответ ({e})") })?;
    let arr = parsed.get("translations").and_then(|v| v.as_array())
        .ok_or_else(|| DeeplError { status: None, message: "DeepL: нет поля translations".to_string() })?;

    let mut out = Vec::with_capacity(arr.len());
    let mut detected = String::new();
    for t in arr {
        out.push(t.get("text").and_then(|v| v.as_str()).unwrap_or("").to_string());
        if detected.is_empty() {
            if let Some(d) = t.get("detected_source_language").and_then(|v| v.as_str()) {
                detected = d.to_lowercase();
            }
        }
    }
    Ok((out, detected))
}

// ---------- LLM-фолбэк ----------

async fn llm_translate(text: &str, source: &str, target: &str, context: &str) -> Result<String, String> {
    let src = if source.is_empty() { "the source language".to_string() } else { lang_name(source).to_string() };
    let ctx = if context.is_empty() { String::new() } else {
        format!("\nIt occurs in this passage: \"{context}\". Choose the meaning that fits this passage.")
    };
    let content = llm::chat_text(ChatRequest {
        task: Task::Grading,
        messages: vec![
            ChatMessage::system(format!(
                "You are a translation engine. Translate from {src} into {}. \
                 Answer with JSON only: {{\"translation\": \"…\"}}. No explanations.",
                lang_name(target),
            )),
            ChatMessage::user(format!("Translate: \"{text}\"{ctx}")),
        ],
        max_tokens: 400,
        format: ResponseFormat::JsonSchema(json!({
            "type": "object",
            "properties": { "translation": { "type": "string" } },
            "required": ["translation"],
        })),
        // Механическая задача: размышления только съедают бюджет вывода.
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| e.to_string())?;

    let v: serde_json::Value = serde_json::from_str(super::ai::extract_json(&content))
        .map_err(|e| format!("LLM: неразборный ответ ({e})"))?;
    Ok(v.get("translation").and_then(|t| t.as_str()).unwrap_or("").to_string())
}

// ---------- Публичная функция перевода ----------

/// Переводит пачку строк с кэшем. Возвращает (переводы, язык оригинала, провайдер).
pub async fn translate_batch(
    pool: &PgPool, texts: &[String], source: &str, target: &str, context: &str,
) -> Result<(Vec<String>, String, String), String> {
    let provider = if deepl_key().is_some() { "deepl" } else { "llm" };
    let mut out = vec![String::new(); texts.len()];
    let mut missing: Vec<usize> = Vec::new();

    // 1. Кэш. Контекст входит в ключ: одно и то же слово в разных предложениях —
    //    разные переводы, и склеивать их нельзя.
    let keys: Vec<String> = texts.iter().map(|t| cache_key(provider, source, target, context, t)).collect();
    let cached = cache_get_many(pool, &keys).await;
    for (i, key) in keys.iter().enumerate() {
        match cached.get(key) {
            Some(v) => out[i] = v.clone(),
            None => missing.push(i),
        }
    }
    if missing.is_empty() {
        return Ok((out, source.to_string(), format!("{provider}-cache")));
    }

    let batch: Vec<String> = missing.iter().map(|&i| texts[i].clone()).collect();
    let mut detected = source.to_string();

    // 2. DeepL, если ключ есть.
    if deepl_key().is_some() {
        match deepl_translate_rotating(&batch, source, target, context).await {
            Ok((res, det)) => {
                if !det.is_empty() { detected = det; }
                for (k, &i) in missing.iter().enumerate() {
                    let v = res.get(k).cloned().unwrap_or_default();
                    cache_put(pool, &cache_key("deepl", source, target, context, &texts[i]), "deepl", &detected, target, &texts[i], &v).await;
                    out[i] = v;
                }
                return Ok((out, detected, "deepl".to_string()));
            }
            Err(e) => {
                // Все ключи исчерпаны — не роняем чтение, идём в LLM.
                eprintln!("[translate] DeepL failed, falling back to LLM: {e}");
            }
        }
    }

    // 3. LLM — по одному запросу на строку (путь редкий, батч не нужен).
    for &i in &missing {
        let v = llm_translate(&texts[i], source, target, context).await?;
        cache_put(pool, &cache_key("llm", source, target, context, &texts[i]), "llm", source, target, &texts[i], &v).await;
        out[i] = v;
    }
    Ok((out, detected, "llm".to_string()))
}

/// Список тем для полки. Закрытый намеренно: если позволить модели придумывать
/// формулировки, на десяти книгах выйдет десять разных рубрик и группировка
/// потеряет смысл.
pub const BOOK_TOPICS: [&str; 12] = [
    "Классика", "Приключения", "Детектив", "Фантастика", "История", "Наука",
    "Психология", "Бизнес", "Детская литература", "Поэзия", "Публицистика", "Учебник",
];

/// Язык и тема книги одним запросом: два похода к модели ради одной загрузки
/// не нужны, а данные нужны одновременно.
pub async fn detect_book_facts(sample: &str, title: &str) -> Result<(String, String), String> {
    let snippet: String = sample.chars().take(1200).collect();
    let topics = BOOK_TOPICS.join(", ");
    let content = llm::chat_text(ChatRequest {
        task: Task::Grading,
        messages: vec![
            ChatMessage::system(format!(
                "You classify books. Reply with ONE JSON object and nothing else, using exactly \
                 these keys: {{\"language\": string, \"topic\": string}}. \
                 language — the ISO 639-1 two-letter code of the language the excerpt is written in. \
                 topic — EXACTLY one value from this list, copied verbatim: {topics}. \
                 Never use null.",
            )),
            ChatMessage::user(format!("Title: \"{title}\"\nExcerpt:\n\"\"\"\n{snippet}\n\"\"\"")),
        ],
        max_tokens: 150,
        format: ResponseFormat::JsonSchema(json!({
            "type": "object",
            "properties": {
                "language": { "type": "string" },
                "topic": { "type": "string", "enum": BOOK_TOPICS },
            },
            "required": ["language", "topic"],
        })),
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| e.to_string())?;

    let v: serde_json::Value = serde_json::from_str(super::ai::extract_json(&content))
        .map_err(|e| format!("LLM: неразборный ответ ({e})"))?;

    let code: String = v.get("language").and_then(|l| l.as_str()).unwrap_or("")
        .to_lowercase().chars().take(2).filter(|c| c.is_ascii_alphabetic()).collect();

    // Тему принимаем только из списка: модель любит переформулировать.
    let raw_topic = v.get("topic").and_then(|t| t.as_str()).unwrap_or("");
    let topic = BOOK_TOPICS.iter()
        .find(|t| t.eq_ignore_ascii_case(raw_topic.trim()))
        .map(|t| t.to_string())
        .unwrap_or_default();

    if code.len() != 2 {
        return Err("не удалось определить язык".to_string());
    }
    Ok((code, topic))
}

/// Определение языка текста облачной LLM: код ISO 639-1.
/// Используется после загрузки книги, если язык не указан вручную.
#[allow(dead_code)]
pub async fn detect_language(sample: &str) -> Result<String, String> {
    let snippet: String = sample.chars().take(1200).collect();
    let content = llm::chat_text(ChatRequest {
        task: Task::Grading,
        messages: vec![
            ChatMessage::system(
                "You identify the language of a text. Reply with JSON only: \
                 {\"language\": \"<ISO 639-1 two-letter code>\", \"confidence\": <0..1>}.",
            ),
            ChatMessage::user(format!("Text:\n\"\"\"\n{snippet}\n\"\"\"")),
        ],
        max_tokens: 100,
        format: ResponseFormat::JsonSchema(json!({
            "type": "object",
            "properties": {
                "language": { "type": "string" },
                "confidence": { "type": "number" },
            },
            "required": ["language"],
        })),
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| e.to_string())?;

    let v: serde_json::Value = serde_json::from_str(super::ai::extract_json(&content))
        .map_err(|e| format!("LLM: неразборный ответ ({e})"))?;
    let code = v.get("language").and_then(|l| l.as_str()).unwrap_or("").to_lowercase();
    let code: String = code.chars().take(2).filter(|c| c.is_ascii_alphabetic()).collect();
    if code.len() != 2 {
        return Err("не удалось определить язык".to_string());
    }
    Ok(code)
}

// ---------- Хендлеры ----------

/// POST /api/translate — перевод пачки строк (наведение, выделение, предзагрузка).
pub async fn translate_handler(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
    Json(payload): Json<TranslateRequest>,
) -> ApiResult<impl IntoResponse> {
    if payload.texts.is_empty() || payload.texts.len() > MAX_TEXTS {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("texts: 1..{MAX_TEXTS}")));
    }
    if payload.target_lang.trim().is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "targetLang is required"));
    }
    let texts: Vec<String> = payload.texts.iter()
        .map(|t| t.chars().take(MAX_TEXT_CHARS).collect::<String>().trim().to_string())
        .collect();
    let context: String = payload.context.chars().take(MAX_CONTEXT_CHARS).collect();

    let source = payload.source_lang.to_lowercase();
    let target = payload.target_lang.to_lowercase();
    // Язык оригинала совпал с языком перевода — переводить нечего.
    if !source.is_empty() && source == target {
        return Ok((StatusCode::OK, Json(TranslateResponse {
            translations: texts, source_lang: source, provider: "none".to_string(),
        })));
    }

    let (translations, source_lang, provider) = translate_batch(&pool, &texts, &source, &target, &context)
        .await
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, e))?;

    Ok((StatusCode::OK, Json(TranslateResponse { translations, source_lang, provider })))
}

/// POST /api/dictionary — словарная статья слова в его контексте (LLM).
pub async fn dictionary_handler(
    State(pool): State<PgPool>,
    AuthenticatedUser(_user): AuthenticatedUser,
    Json(payload): Json<DictionaryRequest>,
) -> ApiResult<impl IntoResponse> {
    let word = payload.word.trim();
    if word.is_empty() || word.chars().count() > 80 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "word: 1..80 chars"));
    }
    let sentence: String = payload.sentence.chars().take(MAX_CONTEXT_CHARS).collect();
    let src = payload.source_lang.to_lowercase();
    let tgt = payload.target_lang.to_lowercase();

    // Словарная статья дороже перевода — кэшируем её так же, в общей таблице.
    let key = cache_key("dict", &src, &tgt, &sentence, word);
    if let Some(cached) = cache_get(&pool, &key).await {
        if let Ok(entry) = serde_json::from_str::<DictionaryEntry>(&cached) {
            return Ok((StatusCode::OK, Json(entry)));
        }
    }

    let content = llm::chat_text(ChatRequest {
        task: Task::Grading,
        messages: vec![
            // Имена полей приходится диктовать в самой инструкции: схема из
            // поля `format` до модели не доезжает, и она отвечает то
            // `base_form`, то `part_of_speech` — знакомых полей ноль, статья
            // выходит пустой. С явным перечислением ключей ответ стабилен.
            ChatMessage::system(format!(
                "You are a bilingual learner's dictionary for a reader of {} texts. \
                 Reply with ONE JSON object and nothing else. Use exactly these keys:\n\
                 {{\"lemma\": string, \"pos\": string, \"inContext\": string, \
                 \"meanings\": [{{\"gloss\": string, \"example\": string}}], \"note\": string}}\n\
                 lemma — the dictionary (base) form; pos — part of speech; \
                 inContext — what the word means in THIS sentence; \
                 meanings — up to three common meanings; \
                 note — \"\" unless the word is a proper name. \
                 Never use null: write \"\" or [] instead. All explanations are written in {}.",
                lang_name(&src), lang_name(&tgt),
            )),
            ChatMessage::user(format!("Word: \"{word}\"\nSentence: \"{sentence}\"")),
        ],
        max_tokens: 700,
        format: ResponseFormat::JsonSchema(json!({
            "type": "object",
            "properties": {
                "lemma": { "type": "string" },
                "pos": { "type": "string" },
                "inContext": { "type": "string" },
                "meanings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "gloss": { "type": "string" },
                            "example": { "type": "string" },
                        },
                        "required": ["gloss"],
                    },
                },
                "note": { "type": "string" },
            },
            "required": ["lemma", "pos", "inContext", "meanings"],
        })),
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, e.to_string()))?;

    let mut entry: DictionaryEntry = serde_json::from_str(super::ai::extract_json(&content))
        .map_err(|e| ApiError::response(StatusCode::BAD_GATEWAY, format!("Dictionary parse error: {e}")))?;

    // Подчищаем недоделки модели: значение без текста только мусорит панель,
    // а статья без начальной формы выглядит сломанной.
    entry.meanings.retain(|m| !m.gloss.trim().is_empty());
    if entry.lemma.trim().is_empty() {
        entry.lemma = word.to_string();
    }
    if entry.in_context.trim().is_empty() {
        entry.in_context = entry.meanings.first().map(|m| m.gloss.clone()).unwrap_or_default();
    }

    // Пустую статью в кэш не кладём. Однажды закэшированный неудачный ответ
    // не лечится ни повтором, ни перезапуском — этот урок уже был с озвучкой.
    let worth_caching = !entry.in_context.trim().is_empty() || !entry.meanings.is_empty();
    if worth_caching {
        if let Ok(raw) = serde_json::to_string(&entry) {
            cache_put(&pool, &key, "dict", &src, &tgt, word, &raw).await;
        }
    }
    Ok((StatusCode::OK, Json(entry)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_variants_get_a_region() {
        // DeepL отвергает голый EN/PT в target_lang — проверяем, что не отдаём его.
        assert_eq!(deepl_code("en", true), "EN-US");
        assert_eq!(deepl_code("pt", true), "PT-PT");
        assert_eq!(deepl_code("en", false), "EN");
        assert_eq!(deepl_code("fr", true), "FR");
        assert_eq!(deepl_code("ru-RU", true), "RU");
    }

    fn ring_of(n: usize) -> KeyRing {
        let keys: Vec<String> = (1..=n).map(|i| format!("key{i}")).collect();
        let blocked = vec![None; keys.len()];
        KeyRing { keys, blocked, cur: 0 }
    }

    #[test]
    fn keys_are_split_and_deduped() {
        let raw = vec![
            "  a:fx , b:fx ".to_string(),
            "b:fx".to_string(),   // тот же ключ второй раз — лишний
            "c:fx;d:fx".to_string(),
            "   ".to_string(),
        ];
        assert_eq!(parse_keys(&raw), vec!["a:fx", "b:fx", "c:fx", "d:fx"]);
    }

    #[test]
    fn exhausted_key_gives_way_to_the_next() {
        let now = std::time::Instant::now();
        let mut r = ring_of(3);
        assert_eq!(r.pick(now).unwrap().0, 0);

        r.block(0, QUOTA_COOLDOWN, now);
        assert_eq!(r.pick(now).unwrap().0, 1, "должен взяться следующий ключ");
        // Пока запас не обновился, к первому не возвращаемся.
        r.block(1, QUOTA_COOLDOWN, now);
        assert_eq!(r.pick(now).unwrap().0, 2);
    }

    #[test]
    fn all_exhausted_means_no_key() {
        let now = std::time::Instant::now();
        let mut r = ring_of(2);
        r.block(0, QUOTA_COOLDOWN, now);
        r.block(1, QUOTA_COOLDOWN, now);
        assert!(r.pick(now).is_none(), "все ключи исчерпаны — переводит модель");
    }

    #[test]
    fn key_returns_after_its_time() {
        let now = std::time::Instant::now();
        let mut r = ring_of(2);
        r.block(0, Duration::from_secs(0), now);
        r.block(1, QUOTA_COOLDOWN, now);
        // Срок первого уже вышел — круг замкнулся, снова берём его.
        assert_eq!(r.pick(now).unwrap().0, 0);
    }

    #[test]
    fn single_key_still_works() {
        let now = std::time::Instant::now();
        let mut r = ring_of(1);
        assert_eq!(r.pick(now).unwrap().0, 0);
        r.block(0, QUOTA_COOLDOWN, now);
        assert!(r.pick(now).is_none());
    }

    #[test]
    fn free_key_picks_free_host() {
        assert!(deepl_endpoint("abc:fx").contains("api-free"));
        assert!(!deepl_endpoint("abc").contains("api-free"));
    }

    #[test]
    fn dictionary_tolerates_nulls() {
        // Ровно тот ответ, на котором падала панель разбора: null вместо строки.
        let raw = r#"{"lemma":"dans","pos":"préposition","inContext":"в",
                      "note":null,
                      "meanings":[{"gloss":"в","example":null},{"gloss":"внутри"}]}"#;
        let e: DictionaryEntry = serde_json::from_str(raw).expect("null не должен ломать разбор");
        assert_eq!(e.note, "");
        assert_eq!(e.meanings[0].example, "");
        assert_eq!(e.meanings[1].gloss, "внутри");
    }

    #[test]
    fn dictionary_reads_the_shape_the_model_actually_returns() {
        // Дословный ответ gpt-oss:120b, на котором панель выходила пустой:
        // свои имена полей и значения строками вместо объектов.
        let raw = r#"{"word":"dans","base_form":"dans","part_of_speech":"предлог",
                      "meaning_in_sentence":"в (место или область)",
                      "common_meanings":["в, внутри (место)","в течение (время)"]}"#;
        let e: DictionaryEntry = serde_json::from_str(raw).expect("импровизация модели должна читаться");
        assert_eq!(e.lemma, "dans");
        assert_eq!(e.pos, "предлог");
        assert_eq!(e.in_context, "в (место или область)");
        assert_eq!(e.meanings.len(), 2);
        assert_eq!(e.meanings[0].gloss, "в, внутри (место)");
        assert_eq!(e.meanings[0].example, "");
    }

    #[test]
    fn dictionary_skips_null_inside_meanings() {
        let raw = r#"{"lemma":"dans","meanings":[{"gloss":"в"},null,{"gloss":"внутри"}]}"#;
        let e: DictionaryEntry = serde_json::from_str(raw).expect("null-элемент не должен ломать список");
        assert_eq!(e.meanings.len(), 2);
    }

    #[test]
    fn dictionary_survives_null_meanings() {
        let raw = r#"{"lemma":"dans","pos":"prep","inContext":"в","meanings":null}"#;
        let e: DictionaryEntry = serde_json::from_str(raw).expect("null-массив не должен ломать разбор");
        assert!(e.meanings.is_empty());
    }

    #[test]
    fn dictionary_survives_missing_fields() {
        let e: DictionaryEntry = serde_json::from_str("{}").expect("пустой объект не должен ломать разбор");
        assert_eq!(e.lemma, "");
        assert!(e.meanings.is_empty());
    }

    #[test]
    fn cache_key_separates_context() {
        let a = cache_key("deepl", "fr", "ru", "le château", "château");
        let b = cache_key("deepl", "fr", "ru", "la serrure", "château");
        assert_ne!(a, b, "разный контекст — разный ключ кэша");
    }
}
