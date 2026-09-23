//! Судья: задаёт типизированные вопросы и получает типизированные ответы с
//! уверенностью. Два провайдера за одним API:
//!
//! - **Jev** (TypeSafe AI) — используется, когда задан `JEV_API_KEY`. Настоящий
//!   калиброванный судья: `noul` (да/нет с вероятностью), `choice` (выбор из
//!   вариантов) и `score` (оценка по шкале). Насколько хорошо Jev справляется с
//!   французским/русским — неизвестно, поэтому деградация на резерв должна быть
//!   бесшовной.
//! - **Резерв** — существующий LLM-слой (`crate::llm`, `Task::Grading`). Ключи
//!   ответа диктуются прямо в промпте (модель схему игнорирует), разбор
//!   null-терпимый, а самооценка уверенности модели урезается сверху
//!   (`JUDGE_FALLBACK_CONFIDENCE_CAP`) — она хуже откалибрована, чем Jev.
//!
//! Пороги принятия `noul`-ответа настраиваются отдельно на каждый провайдер
//! (`JUDGE_THRESHOLD_JEV`, `JUDGE_THRESHOLD_FALLBACK`) — резерву нужен более
//! высокий порог именно из-за худшей калибровки.
//!
//! Сетевые вызовы отсюда не участвуют в обычных тестах (см. `#[cfg(test)]` —
//! тестируется только чистый разбор ответов).

use std::collections::BTreeMap;
use std::env;
use std::time::Duration;

use serde_json::{json, Value};

use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};

/// Состояние, которое видит судья: произвольный текст или JSON-объект.
#[derive(Debug, Clone)]
pub enum JudgeState {
    Text(String),
    Json(Value),
}

impl JudgeState {
    fn to_value(&self) -> Value {
        match self {
            JudgeState::Text(s) => Value::String(s.clone()),
            JudgeState::Json(v) => v.clone(),
        }
    }
}

impl From<String> for JudgeState {
    fn from(s: String) -> Self {
        JudgeState::Text(s)
    }
}

impl From<&str> for JudgeState {
    fn from(s: &str) -> Self {
        JudgeState::Text(s.to_string())
    }
}

/// Типизированный вопрос судье.
#[derive(Debug, Clone)]
pub enum Question {
    /// Да/нет с вероятностью. `criteria` — необязательные пояснения "что значит true/false".
    Noul {
        instructions: String,
        criteria: Option<(String, String)>,
    },
    /// Выбор одного варианта. `options`: значение варианта → описание (до 255 симв.).
    Choice {
        instructions: String,
        options: BTreeMap<String, String>,
    },
    /// Оценка по шкале из 2–10 описанных уровней.
    #[allow(dead_code)] // пока не используется в движке тренажёра — часть публичного API судьи
    Score {
        instructions: String,
        levels: Vec<String>,
    },
}

impl Question {
    fn to_json(&self) -> Value {
        match self {
            Question::Noul { instructions, criteria } => {
                let mut obj = json!({ "type": "noul", "instructions": instructions });
                if let Some((yes, no)) = criteria {
                    obj["criteria"] = json!({ "true": yes, "false": no });
                }
                obj
            }
            Question::Choice { instructions, options } => {
                json!({ "type": "choice", "instructions": instructions, "criteria": options })
            }
            Question::Score { instructions, levels } => {
                json!({ "type": "score", "instructions": instructions, "criteria": levels })
            }
        }
    }
}

/// Типизированный ответ судьи.
#[derive(Debug, Clone)]
pub enum Answer {
    Noul(f32),
    Choice { choice: String, confidence: f32 },
    #[allow(dead_code)]
    Score { score: u32, confidence: f32 },
}

impl Answer {
    pub fn as_noul(&self) -> Option<f32> {
        match self {
            Answer::Noul(p) => Some(*p),
            _ => None,
        }
    }

    pub fn as_choice(&self) -> Option<(&str, f32)> {
        match self {
            Answer::Choice { choice, confidence } => Some((choice.as_str(), *confidence)),
            _ => None,
        }
    }

    #[allow(dead_code)]
    pub fn as_score(&self) -> Option<(u32, f32)> {
        match self {
            Answer::Score { score, confidence } => Some((*score, *confidence)),
            _ => None,
        }
    }
}

/// Какой провайдер в итоге ответил — от этого зависит порог принятия.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Provider {
    Jev,
    Fallback,
}

#[derive(Debug)]
pub struct JudgeError(String);

impl std::fmt::Display for JudgeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "judge unavailable: {}", self.0)
    }
}

impl std::error::Error for JudgeError {}

pub struct JudgeResult {
    pub provider: Provider,
    pub answers: BTreeMap<String, Answer>,
}

fn env_nonempty(key: &str) -> Option<String> {
    env::var(key).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}

fn env_f32(key: &str, default: f32) -> f32 {
    env::var(key).ok().and_then(|v| v.parse::<f32>().ok()).unwrap_or(default)
}

/// Порог `noul`-вероятности, начиная с которого ответ считается «да». Разный на
/// каждого провайдера: Jev откалиброван лучше, у резерва планка выше.
pub fn noul_threshold(provider: Provider) -> f32 {
    match provider {
        Provider::Jev => env_f32("JUDGE_THRESHOLD_JEV", 0.7),
        Provider::Fallback => env_f32("JUDGE_THRESHOLD_FALLBACK", 0.75),
    }
}

fn fallback_confidence_cap() -> f32 {
    env_f32("JUDGE_FALLBACK_CONFIDENCE_CAP", 0.6)
}

/// Задать набор вопросов судье. Пробует Jev (если настроен), при любой ошибке —
/// резервный LLM-слой. Ошибка возвращается, только если оба провайдера недоступны
/// или не задан ни один ключ.
pub async fn ask(state: impl Into<JudgeState>, questions: BTreeMap<String, Question>) -> Result<JudgeResult, JudgeError> {
    let state = state.into();
    if questions.is_empty() {
        return Ok(JudgeResult { provider: Provider::Fallback, answers: BTreeMap::new() });
    }

    if env_nonempty("JEV_API_KEY").is_some() {
        match ask_jev(&state, &questions).await {
            Ok(answers) => return Ok(JudgeResult { provider: Provider::Jev, answers }),
            Err(e) => eprintln!("judge: Jev failed, falling back to LLM: {e}"),
        }
    }

    ask_fallback(&state, &questions)
        .await
        .map(|answers| JudgeResult { provider: Provider::Fallback, answers })
        .map_err(JudgeError)
}

/// Удобный шорткат для самого частого случая: один вопрос «осмысленно ли это?».
/// Возвращает (прошёл ли порог, вероятность, провайдер).
pub async fn ask_sensible(instructions: impl Into<String>, state: impl Into<JudgeState>) -> (bool, f32, Provider) {
    let mut questions = BTreeMap::new();
    questions.insert(
        "sensible".to_string(),
        Question::Noul { instructions: instructions.into(), criteria: None },
    );
    match ask(state, questions).await {
        Ok(result) => {
            let p = result.answers.get("sensible").and_then(Answer::as_noul).unwrap_or(0.0);
            (p >= noul_threshold(result.provider), p, result.provider)
        }
        // Судья целиком недоступен — консервативный ответ: не публиковать непроверенное.
        Err(_) => (false, 0.0, Provider::Fallback),
    }
}

// ---------- Jev ----------

async fn ask_jev(state: &JudgeState, questions: &BTreeMap<String, Question>) -> Result<BTreeMap<String, Answer>, String> {
    let api_key = env_nonempty("JEV_API_KEY").ok_or_else(|| "JEV_API_KEY not set".to_string())?;
    let url = env_nonempty("JEV_URL").unwrap_or_else(|| "https://api.typesafe.ai/v1/systemone".to_string());
    let model = env_nonempty("JEV_MODEL").unwrap_or_else(|| "jev-latest".to_string());

    let mut q_json = serde_json::Map::new();
    for (key, q) in questions {
        q_json.insert(key.clone(), q.to_json());
    }
    let body = json!({
        "model": model,
        "state": state.to_value(),
        "questions": Value::Object(q_json),
    });

    let client = reqwest::Client::new();
    let mut backed_off = false;
    loop {
        let response = client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Authorization", format!("Bearer {api_key}"))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("request failed: {e}"))?;

        let status = response.status();
        if status.is_success() {
            let text = response.text().await.map_err(|e| format!("failed to read response: {e}"))?;
            return parse_jev_response(&text, questions);
        }

        // 429 (rate limit) / 529 (overloaded) — один раз подождать и повторить,
        // затем сдаться и уйти на резерв.
        if !backed_off && (status.as_u16() == 429 || status.as_u16() == 529) {
            backed_off = true;
            tokio::time::sleep(Duration::from_millis(600)).await;
            continue;
        }

        let text = response.text().await.unwrap_or_default();
        return Err(format!("Jev responded {status}: {}", text.chars().take(300).collect::<String>()));
    }
}

fn parse_jev_response(body: &str, questions: &BTreeMap<String, Question>) -> Result<BTreeMap<String, Answer>, String> {
    let v: Value = serde_json::from_str(body).map_err(|e| format!("bad JSON from Jev: {e}"))?;
    let answers_obj = v
        .get("answers")
        .and_then(Value::as_object)
        .ok_or_else(|| "no 'answers' object in Jev response".to_string())?;

    let mut out = BTreeMap::new();
    for (key, q) in questions {
        if let Some(av) = answers_obj.get(key)
            && let Some(answer) = parse_answer(q, av)
        {
            out.insert(key.clone(), answer);
        }
    }
    if out.is_empty() {
        return Err("Jev response had no parseable answers".to_string());
    }
    Ok(out)
}

// ---------- Резерв (существующий LLM-слой) ----------

async fn ask_fallback(state: &JudgeState, questions: &BTreeMap<String, Question>) -> Result<BTreeMap<String, Answer>, String> {
    let state_text = match state {
        JudgeState::Text(s) => s.clone(),
        JudgeState::Json(v) => v.to_string(),
    };

    let lines: Vec<String> = questions.iter().map(|(k, q)| describe_question(k, q)).collect();
    let system = format!(
        "You are a careful judge inside an educational app. You are given some context (\"state\") \
         and a list of typed questions about it. Answer ALL of them.\n\
         Reply with ONLY a raw JSON object whose keys are EXACTLY the question keys below (no markdown). \
         Each value is a JSON object shaped like this, depending on the question's type:\n\
         - type \"noul\": {{\"type\":\"noul\",\"noul\": <number 0..1, probability the answer is yes>}}\n\
         - type \"choice\": {{\"type\":\"choice\",\"choice\": <one of the given option keys, exact string>,\"confidence\": <number 0..1>}}\n\
         - type \"score\": {{\"type\":\"score\",\"score\": <0-based index into the given levels>,\"confidence\": <number 0..1>}}\n\n\
         Questions:\n{}",
        lines.join("\n")
    );
    let user = format!("State:\n{state_text}");

    let content = llm::chat_text(ChatRequest {
        task: Task::Grading,
        messages: vec![ChatMessage::system(system), ChatMessage::user(user)],
        max_tokens: 800,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    .map_err(|e| format!("fallback LLM error: {e}"))?;

    let parsed: Value = serde_json::from_str(extract_json_object(&content))
        .map_err(|e| format!("fallback LLM returned unparseable JSON: {e} - content: {}", content.chars().take(300).collect::<String>()))?;
    let obj = parsed.as_object().ok_or_else(|| "fallback LLM JSON is not an object".to_string())?;

    let cap = fallback_confidence_cap();
    let mut out = BTreeMap::new();
    for (key, q) in questions {
        let Some(av) = obj.get(key) else { continue };
        let Some(mut answer) = parse_answer(q, av) else { continue };
        // Модель хуже откалибрована, чем Jev — самооценке уверенности не доверяем целиком.
        match &mut answer {
            Answer::Choice { confidence, .. } | Answer::Score { confidence, .. } => *confidence = confidence.min(cap),
            Answer::Noul(_) => {}
        }
        out.insert(key.clone(), answer);
    }
    if out.is_empty() {
        return Err("fallback LLM answered none of the questions".to_string());
    }
    Ok(out)
}

fn describe_question(key: &str, q: &Question) -> String {
    match q {
        Question::Noul { instructions, criteria } => {
            let crit = criteria
                .as_ref()
                .map(|(y, n)| format!(" (true means: {y}; false means: {n})"))
                .unwrap_or_default();
            format!("- \"{key}\" [noul]: {instructions}{crit}")
        }
        Question::Choice { instructions, options } => {
            let opts = options.iter().map(|(k, v)| format!("\"{k}\": {v}")).collect::<Vec<_>>().join("; ");
            format!("- \"{key}\" [choice, options: {opts}]: {instructions}")
        }
        Question::Score { instructions, levels } => {
            let lv = levels.iter().enumerate().map(|(i, d)| format!("{i}: {d}")).collect::<Vec<_>>().join("; ");
            format!("- \"{key}\" [score, levels: {lv}]: {instructions}")
        }
    }
}

// ---------- Общий null-терпимый разбор ответа (используется обоими провайдерами) ----------

/// Разбирает один ответ по ожидаемому типу вопроса. `None`, если поля нет или
/// значение не подходит (например, choice вне списка опций) — вызывающий код
/// просто пропускает такой ключ, а не падает.
fn parse_answer(question: &Question, v: &Value) -> Option<Answer> {
    match question {
        Question::Noul { .. } => {
            let p = v.get("noul").and_then(Value::as_f64)?;
            Some(Answer::Noul(p.clamp(0.0, 1.0) as f32))
        }
        Question::Choice { options, .. } => {
            let choice = v.get("choice").and_then(Value::as_str)?.to_string();
            if !options.contains_key(&choice) {
                return None;
            }
            let confidence = v.get("confidence").and_then(Value::as_f64).unwrap_or(0.5);
            Some(Answer::Choice { choice, confidence: confidence.clamp(0.0, 1.0) as f32 })
        }
        Question::Score { levels, .. } => {
            let raw = v.get("score").and_then(Value::as_f64)?;
            let max_idx = levels.len().saturating_sub(1) as f64;
            let score = raw.clamp(0.0, max_idx).round() as u32;
            let confidence = v.get("confidence").and_then(Value::as_f64).unwrap_or(0.5);
            Some(Answer::Score { score, confidence: confidence.clamp(0.0, 1.0) as f32 })
        }
    }
}

/// Вырезает первый JSON-объект из ответа модели (может быть обёрнут текстом/markdown).
/// Копия `handlers::ai::extract_json_object` — не импортируем оттуда намеренно
/// (ai.rs правит параллельно другой агент, свою мелкую копию проще держать своей).
fn extract_json_object(content: &str) -> &str {
    match (content.find('{'), content.rfind('}')) {
        (Some(s), Some(e)) if e > s => &content[s..=e],
        _ => content,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn noul_q(text: &str) -> Question {
        Question::Noul { instructions: text.to_string(), criteria: None }
    }

    fn choice_q(text: &str, opts: &[&str]) -> Question {
        Question::Choice {
            instructions: text.to_string(),
            options: opts.iter().map(|o| (o.to_string(), format!("desc {o}"))).collect(),
        }
    }

    fn score_q(text: &str, levels: &[&str]) -> Question {
        Question::Score { instructions: text.to_string(), levels: levels.iter().map(|s| s.to_string()).collect() }
    }

    #[test]
    fn parses_jev_noul_answer() {
        let mut questions = BTreeMap::new();
        questions.insert("sensible".to_string(), noul_q("is it sensible?"));
        let body = r#"{"model":"jev-latest","answers":{"sensible":{"type":"noul","noul":0.83}},"usage":{}}"#;
        let answers = parse_jev_response(body, &questions).unwrap();
        assert!((answers["sensible"].as_noul().unwrap() - 0.83).abs() < 1e-6);
    }

    #[test]
    fn parses_jev_choice_answer() {
        let mut questions = BTreeMap::new();
        questions.insert("kind".to_string(), choice_q("what kind?", &["noun", "verb"]));
        let body = r#"{"answers":{"kind":{"type":"choice","choice":"verb","probabilities":{"noun":0.1,"verb":0.9},"confidence":0.9}}}"#;
        let answers = parse_jev_response(body, &questions).unwrap();
        let (choice, confidence) = answers["kind"].as_choice().unwrap();
        assert_eq!(choice, "verb");
        assert!((confidence - 0.9).abs() < 1e-6);
    }

    #[test]
    fn parses_jev_score_answer() {
        let mut questions = BTreeMap::new();
        questions.insert("quality".to_string(), score_q("rate it", &["bad", "ok", "great"]));
        let body = r#"{"answers":{"quality":{"type":"score","score":2,"legend":{},"probabilities":{},"confidence":0.75}}}"#;
        let answers = parse_jev_response(body, &questions).unwrap();
        let (score, confidence) = answers["quality"].as_score().unwrap();
        assert_eq!(score, 2);
        assert!((confidence - 0.75).abs() < 1e-6);
    }

    #[test]
    fn jev_choice_outside_options_is_dropped() {
        let mut questions = BTreeMap::new();
        questions.insert("kind".to_string(), choice_q("what kind?", &["noun", "verb"]));
        let body = r#"{"answers":{"kind":{"type":"choice","choice":"adjective","confidence":0.9}}}"#;
        // "adjective" не входит в предложенные опции — весь ответ пуст, это ошибка.
        assert!(parse_jev_response(body, &questions).is_err());
    }

    #[test]
    fn jev_response_missing_answers_object_is_error() {
        let mut questions = BTreeMap::new();
        questions.insert("sensible".to_string(), noul_q("is it sensible?"));
        let body = r#"{"model":"jev-latest"}"#;
        assert!(parse_jev_response(body, &questions).is_err());
    }

    #[test]
    fn fallback_json_tolerates_nulls_and_missing_keys() {
        let mut questions = BTreeMap::new();
        questions.insert("sensible".to_string(), noul_q("is it sensible?"));
        questions.insert("extra".to_string(), noul_q("unrelated question"));
        // Модель забыла "extra" и обернула ответ в markdown — оба случая должны пройти.
        let content = "```json\n{\"sensible\":{\"type\":\"noul\",\"noul\":0.6}}\n```";
        let parsed: Value = serde_json::from_str(extract_json_object(content)).unwrap();
        let obj = parsed.as_object().unwrap();
        assert!(obj.get("extra").is_none());
        let answer = parse_answer(&questions["sensible"], &obj["sensible"]).unwrap();
        assert!((answer.as_noul().unwrap() - 0.6).abs() < 1e-6);
    }

    #[test]
    fn fallback_confidence_is_capped() {
        // env::set_var — тест может выполняться параллельно с другими, но переменная
        // своя (JUDGE_FALLBACK_CONFIDENCE_CAP) и нигде больше в этом бинарнике не читается.
        unsafe { env::set_var("JUDGE_FALLBACK_CONFIDENCE_CAP", "0.5"); }
        let mut answer = Answer::Choice { choice: "verb".to_string(), confidence: 0.95 };
        let cap = fallback_confidence_cap();
        if let Answer::Choice { confidence, .. } = &mut answer {
            *confidence = confidence.min(cap);
        }
        assert!((answer.as_choice().unwrap().1 - 0.5).abs() < 1e-6);
        unsafe { env::remove_var("JUDGE_FALLBACK_CONFIDENCE_CAP"); }
    }

    #[test]
    fn noul_threshold_differs_by_provider() {
        unsafe { env::remove_var("JUDGE_THRESHOLD_JEV"); }
        unsafe { env::remove_var("JUDGE_THRESHOLD_FALLBACK"); }
        assert!((noul_threshold(Provider::Jev) - 0.7).abs() < 1e-6);
        assert!((noul_threshold(Provider::Fallback) - 0.75).abs() < 1e-6);
    }

    #[test]
    fn extract_json_object_strips_surrounding_text() {
        let content = "Sure! ```json\n{\"a\": 1}\n``` done.";
        assert_eq!(extract_json_object(content), "{\"a\": 1}");
    }
}
