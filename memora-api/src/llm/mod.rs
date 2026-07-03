//! Единая точка доступа к LLM-провайдеру.
//!
//! Все обращения к модели идут через `chat_text` (нестриминговый ответ) и
//! `chat_stream` (поток текстовых чанков). Хендлеры не знают ни формата провайдера,
//! ни его URL — только сообщения, лимит токенов и требуемый формат ответа.
//!
//! Конфигурация через переменные окружения:
//! - `LLM_BASE_URL` — базовый URL OpenAI-совместимого API (например `https://ollama.com/v1`,
//!   OpenRouter, Groq, локальный Ollama `http://localhost:11434/v1`). Если задан,
//!   запросы идут на `{LLM_BASE_URL}/chat/completions` в формате OpenAI.
//! - `LLM_API_KEY` — ключ для `LLM_BASE_URL` (фолбэк на `OLLAMA_API_KEY`).
//! - `LLM_MODEL` — модель по умолчанию (фолбэк на `OLLAMA_MODEL`, затем `gpt-oss:120b`).
//! - `LLM_MODEL_GENERATION` / `LLM_MODEL_GRADING` / `LLM_MODEL_CHAT` — переопределение
//!   модели по назначению вызова: тяжёлая генерация контента / оценка ответов / диалоги.
//! - `LLM_FALLBACK_BASE_URL`, `LLM_FALLBACK_API_KEY`, `LLM_FALLBACK_MODEL` — резервный
//!   OpenAI-совместимый провайдер: используется, когда основной недоступен или вернул ошибку.
//! - `LLM_STRUCTURED_OUTPUTS=0` — аварийно отключить structured outputs (если провайдер
//!   не поддерживает `format`/`response_format`).
//!
//! Обратная совместимость: если `LLM_BASE_URL` не задан, работает прежний путь —
//! нативный Ollama API по `OLLAMA_BASE_URL` (полный URL до `/api/chat`,
//! по умолчанию `http://localhost:11434/api/chat`) с ключом `OLLAMA_API_KEY`.
//! Существующий деплой на Railway продолжает работать без изменения переменных.

use std::env;

use futures::stream::BoxStream;
use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};

/// Сообщение диалога. `images` — base64-изображения БЕЗ префикса `data:image/...;base64,`.
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub images: Option<Vec<String>>,
}

impl ChatMessage {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: "system".to_string(), content: content.into(), images: None }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self { role: "user".to_string(), content: content.into(), images: None }
    }

    pub fn new(role: impl Into<String>, content: impl Into<String>) -> Self {
        Self { role: role.into(), content: content.into(), images: None }
    }
}

/// Назначение вызова — выбирает модель через `LLM_MODEL_GENERATION`/`_GRADING`/`_CHAT`:
/// тяжёлую генерацию можно направить на сильную модель, рутину — на дешёвую.
#[derive(Debug, Clone, Copy)]
pub enum Task {
    /// Генерация учебного контента (юниты, упражнения, варианты, истории).
    Generation,
    /// Оценка ответа учащегося.
    Grading,
    /// Диалоги: тьютор, Q-Chat, разговорная практика.
    Chat,
}

/// Требуемый формат ответа модели (structured outputs).
pub enum ResponseFormat {
    /// Обычный текст.
    Text,
    /// Любой валидный JSON (объект или массив). Пока не используется хендлерами —
    /// пригодится генераторам со свободной структурой (фоновая прегенерация, слайс 7).
    #[allow(dead_code)]
    JsonObject,
    /// JSON строго по схеме (JSON Schema как `serde_json::Value`).
    JsonSchema(Value),
}

pub struct ChatRequest {
    pub task: Task,
    pub messages: Vec<ChatMessage>,
    /// Лимит генерации: `options.num_predict` (Ollama) / `max_tokens` (OpenAI).
    pub max_tokens: u32,
    pub format: ResponseFormat,
}

#[derive(Debug)]
pub enum LlmError {
    /// Не хватает конфигурации (ключ/URL) — ошибка деплоя, не провайдера.
    Config(String),
    /// Провайдер недоступен или ответил ошибкой.
    Upstream(String),
    /// Ответ провайдера не удалось разобрать.
    Protocol(String),
}

impl std::fmt::Display for LlmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LlmError::Config(m) => write!(f, "LLM config error: {}", m),
            LlmError::Upstream(m) => write!(f, "LLM provider error: {}", m),
            LlmError::Protocol(m) => write!(f, "LLM protocol error: {}", m),
        }
    }
}

/// Формат обмена с провайдером.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Dialect {
    /// OpenAI chat completions (`/chat/completions`, SSE-стрим `data: ...`).
    OpenAi,
    /// Нативный Ollama (`/api/chat`, NDJSON-стрим) — прежнее поведение.
    OllamaNative,
}

struct Provider {
    /// Полный URL чат-эндпоинта.
    url: String,
    api_key: String,
    dialect: Dialect,
    model: String,
}

fn env_nonempty(key: &str) -> Option<String> {
    env::var(key).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn structured_outputs_enabled() -> bool {
    env_nonempty("LLM_STRUCTURED_OUTPUTS").map(|v| v != "0").unwrap_or(true)
}

fn model_for(task: Task) -> String {
    let per_task = match task {
        Task::Generation => env_nonempty("LLM_MODEL_GENERATION"),
        Task::Grading => env_nonempty("LLM_MODEL_GRADING"),
        Task::Chat => env_nonempty("LLM_MODEL_CHAT"),
    };
    per_task
        .or_else(|| env_nonempty("LLM_MODEL"))
        .or_else(|| env_nonempty("OLLAMA_MODEL"))
        .unwrap_or_else(|| "gpt-oss:120b".to_string())
}

fn primary_provider(task: Task) -> Result<Provider, LlmError> {
    if let Some(base) = env_nonempty("LLM_BASE_URL") {
        let api_key = env_nonempty("LLM_API_KEY")
            .or_else(|| env_nonempty("OLLAMA_API_KEY"))
            .ok_or_else(|| LlmError::Config("LLM_API_KEY is not set".to_string()))?;
        return Ok(Provider {
            url: format!("{}/chat/completions", base.trim_end_matches('/')),
            api_key,
            dialect: Dialect::OpenAi,
            model: model_for(task),
        });
    }
    // Legacy-путь: нативный Ollama, URL задаётся целиком (включая /api/chat).
    let url = env_nonempty("OLLAMA_BASE_URL")
        .unwrap_or_else(|| "http://localhost:11434/api/chat".to_string());
    let api_key = env_nonempty("OLLAMA_API_KEY")
        .ok_or_else(|| LlmError::Config("Ollama API Key not configured".to_string()))?;
    Ok(Provider { url, api_key, dialect: Dialect::OllamaNative, model: model_for(task) })
}

/// Резервный провайдер — всегда OpenAI-совместимый.
fn fallback_provider(task: Task) -> Option<Provider> {
    let base = env_nonempty("LLM_FALLBACK_BASE_URL")?;
    Some(Provider {
        url: format!("{}/chat/completions", base.trim_end_matches('/')),
        api_key: env_nonempty("LLM_FALLBACK_API_KEY").unwrap_or_default(),
        dialect: Dialect::OpenAi,
        model: env_nonempty("LLM_FALLBACK_MODEL").unwrap_or_else(|| model_for(task)),
    })
}

fn build_body(provider: &Provider, req: &ChatRequest, stream: bool) -> Value {
    match provider.dialect {
        Dialect::OllamaNative => {
            let messages: Vec<Value> = req.messages.iter().map(|m| {
                json!({ "role": m.role, "content": m.content, "images": m.images })
            }).collect();
            let mut body = json!({
                "model": provider.model,
                "messages": messages,
                "stream": stream,
                "options": { "num_predict": req.max_tokens },
            });
            if structured_outputs_enabled() {
                match &req.format {
                    ResponseFormat::Text => {}
                    ResponseFormat::JsonObject => body["format"] = json!("json"),
                    ResponseFormat::JsonSchema(schema) => body["format"] = schema.clone(),
                }
            }
            body
        }
        Dialect::OpenAi => {
            let messages: Vec<Value> = req.messages.iter().map(|m| {
                match &m.images {
                    None => json!({ "role": m.role, "content": m.content }),
                    Some(images) => {
                        let mut parts = vec![json!({ "type": "text", "text": m.content })];
                        for b64 in images {
                            parts.push(json!({
                                "type": "image_url",
                                "image_url": { "url": format!("data:image/jpeg;base64,{}", b64) },
                            }));
                        }
                        json!({ "role": m.role, "content": parts })
                    }
                }
            }).collect();
            let mut body = json!({
                "model": provider.model,
                "messages": messages,
                "stream": stream,
                "max_tokens": req.max_tokens,
            });
            if structured_outputs_enabled() {
                match &req.format {
                    ResponseFormat::Text => {}
                    ResponseFormat::JsonObject => {
                        body["response_format"] = json!({ "type": "json_object" })
                    }
                    ResponseFormat::JsonSchema(schema) => {
                        body["response_format"] = json!({
                            "type": "json_schema",
                            "json_schema": { "name": "response", "schema": schema },
                        })
                    }
                }
            }
            body
        }
    }
}

async fn try_send(provider: &Provider, req: &ChatRequest, stream: bool) -> Result<reqwest::Response, LlmError> {
    let client = Client::new();
    let mut request = client.post(&provider.url)
        .header("Content-Type", "application/json")
        .json(&build_body(provider, req, stream));
    if !provider.api_key.is_empty() {
        request = request.header("Authorization", format!("Bearer {}", provider.api_key));
    }
    let response = request.send().await
        .map_err(|e| LlmError::Upstream(format!("Upstream AI Provider Error: {}", e)))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        let text: String = text.chars().take(500).collect();
        return Err(LlmError::Upstream(format!("provider rejected request ({}): {}", status, text)));
    }
    Ok(response)
}

/// Отправляет запрос основному провайдеру, при ошибке — резервному (если настроен).
async fn send(req: &ChatRequest, stream: bool) -> Result<(reqwest::Response, Dialect), LlmError> {
    let primary = primary_provider(req.task)?;
    match try_send(&primary, req, stream).await {
        Ok(resp) => Ok((resp, primary.dialect)),
        Err(primary_err) => {
            let Some(fallback) = fallback_provider(req.task) else { return Err(primary_err) };
            eprintln!("LLM primary failed, trying fallback: {}", primary_err);
            match try_send(&fallback, req, stream).await {
                Ok(resp) => Ok((resp, fallback.dialect)),
                Err(fallback_err) => Err(LlmError::Upstream(format!(
                    "{}; fallback: {}", primary_err, fallback_err
                ))),
            }
        }
    }
}

/// Достаёт текст ответа из нестримингового тела (оба диалекта).
fn parse_completion(body: &str, dialect: Dialect) -> Result<String, LlmError> {
    let v: Value = serde_json::from_str(body)
        .map_err(|e| LlmError::Protocol(format!("bad JSON from provider: {} - Body: {}", e, body.chars().take(300).collect::<String>())))?;

    // Ollama может вернуть {"error": "..."} со статусом 200 (например, модель требует подписки).
    if let Some(err) = v.get("error") {
        let msg = err.as_str().map(str::to_string)
            .or_else(|| err.get("message").and_then(|m| m.as_str()).map(str::to_string))
            .unwrap_or_else(|| err.to_string());
        return Err(LlmError::Upstream(msg));
    }

    let content = match dialect {
        Dialect::OllamaNative => v.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_str()),
        Dialect::OpenAi => v.get("choices").and_then(|c| c.get(0))
            .and_then(|c| c.get("message")).and_then(|m| m.get("content")).and_then(|c| c.as_str()),
    };
    content.map(str::to_string)
        .ok_or_else(|| LlmError::Protocol(format!("no content in provider response: {}", body.chars().take(300).collect::<String>())))
}

/// Разбирает одну строку стрима. Возвращает (контент-чанк, признак конца).
fn parse_stream_line(line: &str, dialect: Dialect) -> (Option<String>, bool) {
    match dialect {
        Dialect::OllamaNative => {
            // NDJSON: {"message":{"content":"..."},"done":bool}
            let Ok(v) = serde_json::from_str::<Value>(line) else { return (None, false) };
            let done = v.get("done").and_then(|d| d.as_bool()).unwrap_or(false);
            let content = v.get("message").and_then(|m| m.get("content"))
                .and_then(|c| c.as_str())
                .filter(|c| !c.is_empty())
                .map(str::to_string);
            (content, done)
        }
        Dialect::OpenAi => {
            // SSE: "data: {...}" | "data: [DONE]"
            let Some(data) = line.strip_prefix("data:").map(str::trim) else { return (None, false) };
            if data == "[DONE]" {
                return (None, true);
            }
            let Ok(v) = serde_json::from_str::<Value>(data) else { return (None, false) };
            let content = v.get("choices").and_then(|c| c.get(0))
                .and_then(|c| c.get("delta")).and_then(|d| d.get("content"))
                .and_then(|c| c.as_str())
                .filter(|c| !c.is_empty())
                .map(str::to_string);
            let done = v.get("choices").and_then(|c| c.get(0))
                .and_then(|c| c.get("finish_reason"))
                .map(|fr| !fr.is_null())
                .unwrap_or(false);
            (content, done)
        }
    }
}

/// Нестриминговый вызов: возвращает полный текст ответа модели.
pub async fn chat_text(req: ChatRequest) -> Result<String, LlmError> {
    let (response, dialect) = send(&req, false).await?;
    let body = response.text().await
        .map_err(|e| LlmError::Upstream(format!("failed to read provider response: {}", e)))?;
    parse_completion(&body, dialect)
}

/// Стриминговый вызов: поток текстовых чанков ответа модели.
/// Строки провайдера буферизуются — чанк сети может разорвать JSON посередине.
pub async fn chat_stream(req: ChatRequest) -> Result<BoxStream<'static, Result<String, LlmError>>, LlmError> {
    let (response, dialect) = send(&req, true).await?;
    let mut byte_stream = response.bytes_stream();

    let stream = async_stream::stream! {
        let mut line_buf = String::new();
        'read: while let Some(chunk) = byte_stream.next().await {
            match chunk {
                Ok(bytes) => {
                    line_buf.push_str(&String::from_utf8_lossy(&bytes));
                    while let Some(pos) = line_buf.find('\n') {
                        let line: String = line_buf.drain(..=pos).collect();
                        let line = line.trim();
                        if line.is_empty() { continue; }
                        let (content, done) = parse_stream_line(line, dialect);
                        if let Some(c) = content {
                            yield Ok(c);
                        }
                        if done { break 'read; }
                    }
                }
                Err(e) => {
                    yield Err(LlmError::Upstream(format!("stream read error: {}", e)));
                    break;
                }
            }
        }
    };
    Ok(stream.boxed())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_ollama_native_completion() {
        let body = r#"{"message":{"role":"assistant","content":"bonjour"},"done":true}"#;
        assert_eq!(parse_completion(body, Dialect::OllamaNative).unwrap(), "bonjour");
    }

    #[test]
    fn parses_openai_completion() {
        let body = r#"{"choices":[{"message":{"role":"assistant","content":"salut"}}]}"#;
        assert_eq!(parse_completion(body, Dialect::OpenAi).unwrap(), "salut");
    }

    #[test]
    fn ollama_error_body_becomes_upstream_error() {
        let body = r#"{"error":"model requires subscription"}"#;
        match parse_completion(body, Dialect::OllamaNative) {
            Err(LlmError::Upstream(m)) => assert!(m.contains("subscription")),
            other => panic!("expected Upstream error, got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn openai_error_object_becomes_upstream_error() {
        let body = r#"{"error":{"message":"invalid api key","type":"auth"}}"#;
        match parse_completion(body, Dialect::OpenAi) {
            Err(LlmError::Upstream(m)) => assert!(m.contains("invalid api key")),
            other => panic!("expected Upstream error, got {:?}", other.map(|_| ())),
        }
    }

    #[test]
    fn parses_ollama_stream_line() {
        let (c, done) = parse_stream_line(r#"{"message":{"content":"bon"},"done":false}"#, Dialect::OllamaNative);
        assert_eq!(c.as_deref(), Some("bon"));
        assert!(!done);
        let (c, done) = parse_stream_line(r#"{"message":{"content":""},"done":true}"#, Dialect::OllamaNative);
        assert!(c.is_none());
        assert!(done);
    }

    #[test]
    fn parses_openai_stream_line() {
        let (c, done) = parse_stream_line(r#"data: {"choices":[{"delta":{"content":"jour"},"finish_reason":null}]}"#, Dialect::OpenAi);
        assert_eq!(c.as_deref(), Some("jour"));
        assert!(!done);
        let (c, done) = parse_stream_line("data: [DONE]", Dialect::OpenAi);
        assert!(c.is_none());
        assert!(done);
        // finish_reason приходит непустым в последнем содержательном чанке.
        let (_, done) = parse_stream_line(r#"data: {"choices":[{"delta":{},"finish_reason":"stop"}]}"#, Dialect::OpenAi);
        assert!(done);
    }

    #[test]
    fn garbage_stream_line_is_skipped() {
        let (c, done) = parse_stream_line("not json at all", Dialect::OllamaNative);
        assert!(c.is_none());
        assert!(!done);
    }
}
