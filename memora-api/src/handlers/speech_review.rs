//! Разбор устного рассказа: «Présentez-vous», «Pourquoi ECR Sud ?».
//!
//! Остальные проверки курса судят одну фразу. На собеседовании важна вся
//! история целиком: сказал ли человек, кто он и что умеет, связно ли, без
//! бесконечных «euh». Поэтому здесь разбирается весь рассказ — что покрыто,
//! какие ошибки мешают сильнее всего, и как тот же рассказ звучал бы верно.
//!
//! Цифры беглости (слов в минуту, «euh», паузы) считаем сами, а не просим у
//! модели: она их выдумывает, а человек по ним следит за своим прогрессом.
//! Модели их передаём, чтобы оценка беглости опиралась на факты.

use std::collections::HashMap;
use std::convert::Infallible;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    body::Body,
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use governor::{Quota, RateLimiter};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};
use crate::middleware::{auth::AuthenticatedUser, rate_limiter::AppRateLimiter};

// ---------- Пределы входа ----------
//
// Две с половиной минуты речи начинающего — это 150–300 слов, около двух
// тысяч знаков. Всё, что сверх пределов ниже, — не рассказ, а мусор или
// попытка скормить модели чужой текст за наш счёт.

const MAX_QUESTION_CHARS: usize = 400;
const MAX_GOALS: usize = 8;
const MAX_GOAL_CHARS: usize = 200;
const MAX_MODEL_ANSWER_CHARS: usize = 1500;
const MAX_TRANSCRIPT_CHARS: usize = 3000;
const MAX_TIMED_WORDS: usize = 800;
const MAX_DURATION_SECONDS: f64 = 600.0;
/// Меньше этого — разбирать нечего: пара слов не рассказ.
const MIN_WORDS: usize = 5;
/// Не больше стольких ошибок: длинный список у начинающего отбивает охоту.
const MAX_ERRORS: usize = 6;
const MAX_PHRASES: usize = 4;
/// Пауза длиннее этого заметна собеседнику.
const LONG_PAUSE_SECONDS: f64 = 2.0;

/// Сколько ждём модель, прежде чем начать держать соединение пробелами.
const QUICK_WINDOW: Duration = Duration::from_secs(20);
/// Прокси веб-приложения рвёт молчащее соединение на тридцати секундах.
const HEARTBEAT: Duration = Duration::from_secs(10);

#[derive(Serialize)]
struct ErrorBody {
    error: String,
}

fn fail(status: StatusCode, msg: impl Into<String>) -> Response {
    (status, Json(ErrorBody { error: msg.into() })).into_response()
}

/// Та же проверка частоты, что у остальных AI-эндпоинтов (см. handlers::ai):
/// общий на человека счётчик, пять запросов в минуту. Скопирована, а не
/// вынесена, чтобы не трогать ai.rs, который сейчас правят параллельно.
fn rate_limited(rate_limiter: &AppRateLimiter, user_sub: &str) -> Option<Response> {
    let Ok(user_uuid) = uuid::Uuid::parse_str(user_sub) else {
        return Some(fail(StatusCode::UNAUTHORIZED, "Invalid User UUID"));
    };
    let limiter = rate_limiter.entry(user_uuid).or_insert_with(|| {
        Arc::new(RateLimiter::direct(Quota::per_minute(NonZeroU32::new(5).unwrap())))
    });
    if limiter.check().is_err() {
        return Some(fail(StatusCode::TOO_MANY_REQUESTS, "Слишком много проверок подряд — подождите минуту."));
    }
    None
}

// ---------- Запрос ----------

/// Слово с метками времени от распознавания (секунды от начала записи).
#[derive(Deserialize, Clone, Debug)]
pub struct TimedWord {
    #[serde(default)]
    #[allow(dead_code)]
    pub word: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MonologueReviewRequest {
    #[serde(default)]
    pub question: String,
    #[serde(default)]
    pub goals: Vec<String>,
    #[serde(default)]
    pub model_answer: Option<String>,
    #[serde(default)]
    pub transcript: String,
    #[serde(default)]
    pub duration_seconds: f64,
    #[serde(default)]
    pub level: Option<String>,
    /// Слова с метками времени — только когда распознавал наш сервис.
    #[serde(default)]
    pub words: Vec<TimedWord>,
    /// 'speech' — рассказ записан голосом, 'typed' — напечатан.
    #[serde(default)]
    pub mode: Option<String>,
}

/// Вход после обрезки по пределам.
#[derive(Debug)]
struct ReviewInput {
    question: String,
    goals: Vec<String>,
    model_answer: String,
    transcript: String,
    duration_seconds: f64,
    level: String,
    words: Vec<TimedWord>,
    spoken: bool,
}

/// Первые `max` знаков; длинный текст режем по границе слова, а не посреди него.
fn cap(s: &str, max: usize) -> String {
    let s = s.trim();
    if s.chars().count() <= max {
        return s.to_string();
    }
    let cut: String = s.chars().take(max).collect();
    match cut.rfind(char::is_whitespace) {
        Some(i) if i > max / 2 => cut[..i].trim_end().to_string(),
        _ => cut,
    }
}

fn sanitize(req: MonologueReviewRequest) -> ReviewInput {
    let level: String = req.level.unwrap_or_default().chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(4)
        .collect();
    let duration = if req.duration_seconds.is_finite() {
        req.duration_seconds.clamp(0.0, MAX_DURATION_SECONDS)
    } else {
        0.0
    };
    ReviewInput {
        question: cap(&req.question, MAX_QUESTION_CHARS),
        goals: req.goals.iter()
            .map(|g| cap(g, MAX_GOAL_CHARS))
            .filter(|g| !g.is_empty())
            .take(MAX_GOALS)
            .collect(),
        model_answer: cap(req.model_answer.as_deref().unwrap_or_default(), MAX_MODEL_ANSWER_CHARS),
        transcript: cap(&req.transcript, MAX_TRANSCRIPT_CHARS),
        duration_seconds: duration,
        level: if level.is_empty() { "A1".to_string() } else { level.to_uppercase() },
        words: req.words.into_iter()
            .filter(|w| w.start.is_finite() && w.end.is_finite())
            .take(MAX_TIMED_WORDS)
            .collect(),
        spoken: req.mode.as_deref() != Some("typed"),
    }
}

// ---------- Беглость ----------

/// Слова рассказа: строчные, без пунктуации; «j'ai» остаётся одним словом.
fn tokens(text: &str) -> Vec<String> {
    text.split(|c: char| !(c.is_alphanumeric() || c == '\'' || c == '’' || c == '-'))
        .map(|t| t.trim_matches(|c: char| c == '\'' || c == '’' || c == '-').to_lowercase())
        .filter(|t| !t.is_empty())
        .collect()
}

/// Звук-заполнитель: «euh», «heu», «hum», «bah». Слова в нём нет вовсе.
fn is_hesitation(t: &str) -> bool {
    let len = t.chars().count();
    let only = |allowed: &str| t.chars().all(|c| allowed.contains(c));
    // Без «h» это уже слово: «j'ai eu».
    (only("euh") && t.contains('e') && t.contains('u') && t.contains('h') && len <= 6)
        || (only("hmu") && t.contains('m') && len <= 5)
        || matches!(t, "bah" | "beh" | "ben")
}

/// Связки, которые становятся заполнителем, когда ими подпирают каждую фразу.
/// Первые два раза — нормальная речь, дальше — привычка тянуть время.
const DISCOURSE_MARKERS: &[&str] = &["alors", "donc", "voilà", "voila"];
const DISCOURSE_ALLOWANCE: u32 = 2;

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FillerCount {
    pub word: String,
    pub count: u32,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FluencyFacts {
    /// Слов без заполнителей.
    pub words: u32,
    pub duration_seconds: f64,
    /// Нет, если запись короче десяти секунд или ответ напечатан.
    pub words_per_minute: Option<u32>,
    /// Всего заполнителей: «euh» и лишние «alors».
    pub fillers: u32,
    pub filler_words: Vec<FillerCount>,
    /// Слово подряд дважды: «je je suis».
    pub repetitions: u32,
    /// Паузы длиннее двух секунд — только когда есть метки времени.
    pub long_pauses: Option<u32>,
    pub longest_pause_seconds: Option<f64>,
}

fn round1(x: f64) -> f64 {
    (x * 10.0).round() / 10.0
}

fn fluency_facts(transcript: &str, duration_seconds: f64, words: &[TimedWord], spoken: bool) -> FluencyFacts {
    let toks = tokens(transcript);
    let mut hesitations: HashMap<String, u32> = HashMap::new();
    let mut markers: HashMap<&str, u32> = HashMap::new();
    let mut content_words = 0u32;
    let mut repetitions = 0u32;

    for (i, t) in toks.iter().enumerate() {
        if is_hesitation(t) {
            // «euh», «euhh», «heu» — одна и та же привычка, считаем вместе.
            let key = if t.contains('e') && t.contains('u') && !t.contains('m') { "euh" } else { t.as_str() };
            *hesitations.entry(key.to_string()).or_default() += 1;
            continue;
        }
        content_words += 1;
        if let Some(m) = DISCOURSE_MARKERS.iter().find(|m| **m == t.as_str()) {
            let m = if *m == "voila" { "voilà" } else { *m };
            *markers.entry(m).or_default() += 1;
        }
        // «nous nous levons» — это грамматика, а не запинка.
        if i > 0 && toks[i - 1] == *t && !matches!(t.as_str(), "nous" | "vous") {
            repetitions += 1;
        }
    }

    let mut filler_words: Vec<FillerCount> = hesitations.into_iter()
        .map(|(word, count)| FillerCount { word, count })
        .chain(markers.into_iter()
            .filter(|(_, n)| *n > DISCOURSE_ALLOWANCE)
            .map(|(w, n)| FillerCount { word: w.to_string(), count: n - DISCOURSE_ALLOWANCE }))
        .collect();
    filler_words.sort_by(|a, b| b.count.cmp(&a.count).then_with(|| a.word.cmp(&b.word)));
    let fillers = filler_words.iter().map(|f| f.count).sum();

    // Темп по напечатанному ответу ничего не значит: время ушло на набор.
    let words_per_minute = (spoken && duration_seconds >= 10.0)
        .then(|| (f64::from(content_words) * 60.0 / duration_seconds).round() as u32);

    let (long_pauses, longest_pause_seconds) = if spoken && words.len() >= 2 {
        let mut sorted: Vec<&TimedWord> = words.iter().collect();
        sorted.sort_by(|a, b| a.start.total_cmp(&b.start));
        // Отрицательный зазор бывает на стыке кусков записи — его пропускаем.
        let gaps: Vec<f64> = sorted.windows(2).map(|w| w[1].start - w[0].end).filter(|g| *g > 0.0).collect();
        let long = gaps.iter().filter(|g| **g >= LONG_PAUSE_SECONDS).count() as u32;
        let longest = gaps.iter().copied().fold(0.0_f64, f64::max);
        (Some(long), Some(round1(longest)))
    } else {
        (None, None)
    };

    FluencyFacts {
        words: content_words,
        duration_seconds: round1(duration_seconds),
        words_per_minute,
        fillers,
        filler_words,
        repetitions,
        long_pauses,
        longest_pause_seconds,
    }
}

/// Распознавание, зациклившееся на шуме: одна и та же тройка слов раз за разом.
/// Такой текст разбирать — значит ругать человека за выдумку модели.
fn looks_like_loop(toks: &[String]) -> bool {
    if toks.len() < 12 {
        return false;
    }
    let mut trigrams: HashMap<(&str, &str, &str), usize> = HashMap::new();
    for w in toks.windows(3) {
        *trigrams.entry((&w[0], &w[1], &w[2])).or_default() += 1;
    }
    let top = trigrams.values().copied().max().unwrap_or(0);
    if top >= 4 && top * 3 * 2 >= toks.len() {
        return true;
    }
    let mut unique: Vec<&String> = toks.iter().collect();
    unique.sort();
    unique.dedup();
    toks.len() >= 20 && unique.len() * 5 < toks.len()
}

// ---------- Ответ ----------

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GoalCheck {
    pub goal: String,
    pub covered: bool,
    pub note: String,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SpeechError {
    pub quote: String,
    pub correction: String,
    pub explanation: String,
    pub kind: String,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct UsefulPhrase {
    pub fr: String,
    pub ru: String,
}

/// Оценки 1–5; ноль — модель оценку не дала, и показывать нечего.
#[derive(Serialize, Debug, Default, PartialEq)]
pub struct Scores {
    pub content: u8,
    pub grammar: u8,
    pub vocabulary: u8,
    pub fluency: u8,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MonologueReview {
    pub overall: String,
    pub goals_covered: Vec<GoalCheck>,
    pub errors: Vec<SpeechError>,
    pub better_version: String,
    pub useful_phrases: Vec<UsefulPhrase>,
    pub scores: Scores,
    pub next_step: String,
    pub fluency: FluencyFacts,
}

// ---------- Разбор ответа модели ----------
//
// Разбираем через Value, а не через строгие структуры: модель отвечает null
// вместо пустых полей, строкой вместо числа, называет ключи то в camelCase, то
// в snake_case. Строгий разбор ронял бы весь разбор из-за одной мелочи.

/// Первое непустое поле из вариантов названия.
fn field<'a>(v: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    keys.iter().filter_map(|k| v.get(*k)).find(|x| !x.is_null())
}

fn text_of(v: Option<&Value>, max: usize) -> String {
    match v {
        Some(Value::String(s)) => cap(s, max),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

fn flag_of(v: Option<&Value>) -> bool {
    match v {
        Some(Value::Bool(b)) => *b,
        Some(Value::Number(n)) => n.as_f64().is_some_and(|x| x != 0.0),
        Some(Value::String(s)) => matches!(s.trim().to_lowercase().as_str(), "true" | "yes" | "да" | "oui" | "1"),
        _ => false,
    }
}

fn score_of(v: Option<&Value>) -> u8 {
    let x = match v {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => s.trim().split('/').next().and_then(|p| p.trim().parse::<f64>().ok()),
        _ => None,
    };
    match x {
        Some(x) if x.is_finite() => x.round().clamp(1.0, 5.0) as u8,
        _ => 0,
    }
}

fn list_of(v: Option<&Value>) -> &[Value] {
    match v {
        Some(Value::Array(a)) => a.as_slice(),
        _ => &[],
    }
}

fn kind_of(raw: &str) -> String {
    let k = raw.trim().to_lowercase();
    let kind = if k.starts_with("gram") {
        "grammar"
    } else if k.starts_with("voc") || k.starts_with("lex") || k.starts_with("word") {
        "vocabulary"
    } else if k.starts_with("pron") || k.starts_with("phon") {
        "pronunciation"
    } else {
        "other"
    };
    kind.to_string()
}

fn same_words(a: &str, b: &str) -> bool {
    tokens(a) == tokens(b)
}

/// Цели — в том порядке и в той формулировке, что в курсе: модель любит их
/// пересказывать своими словами, а человек должен узнать свой список.
fn align_goals(goals: &[String], raw: &[Value]) -> Vec<GoalCheck> {
    goals.iter().enumerate().map(|(i, goal)| {
        let by_text = raw.iter().find(|r| {
            text_of(field(r, &["goal"]), MAX_GOAL_CHARS).to_lowercase() == goal.to_lowercase()
        });
        let entry = by_text.or_else(|| raw.get(i));
        match entry {
            Some(e) => GoalCheck {
                goal: goal.clone(),
                covered: flag_of(field(e, &["covered", "done", "met"])),
                note: text_of(field(e, &["note", "comment"]), 300),
            },
            None => GoalCheck { goal: goal.clone(), covered: false, note: String::new() },
        }
    }).collect()
}

fn parse_review(content: &str, goals: &[String], fluency: FluencyFacts) -> Option<MonologueReview> {
    let v: Value = serde_json::from_str(extract_json_object(content)).ok()?;
    if !v.is_object() {
        return None;
    }

    let mut errors: Vec<SpeechError> = Vec::new();
    for e in list_of(field(&v, &["errors", "mistakes"])) {
        let quote = text_of(field(e, &["quote", "original"]), 200);
        let correction = text_of(field(e, &["correction", "corrected", "fix"]), 200);
        // Без цитаты или без правки карточку не понять; «исправление» на то же
        // самое — частый шум модели, человек решит, что сказал неверно.
        if quote.is_empty() || correction.is_empty() || same_words(&quote, &correction) {
            continue;
        }
        if errors.iter().any(|x| x.quote == quote) {
            continue;
        }
        errors.push(SpeechError {
            quote,
            correction,
            explanation: text_of(field(e, &["explanation", "why"]), 400),
            kind: kind_of(&text_of(field(e, &["kind", "type", "category"]), 40)),
        });
        if errors.len() >= MAX_ERRORS {
            break;
        }
    }

    let useful_phrases: Vec<UsefulPhrase> = list_of(field(&v, &["usefulPhrases", "useful_phrases", "phrases"]))
        .iter()
        .map(|p| UsefulPhrase {
            fr: text_of(field(p, &["fr", "french", "phrase"]), 200),
            ru: text_of(field(p, &["ru", "russian", "translation"]), 200),
        })
        .filter(|p| !p.fr.is_empty())
        .take(MAX_PHRASES)
        .collect();

    let scores_v = field(&v, &["scores", "score"]).cloned().unwrap_or(Value::Null);
    let scores = Scores {
        content: score_of(field(&scores_v, &["content"])),
        grammar: score_of(field(&scores_v, &["grammar"])),
        vocabulary: score_of(field(&scores_v, &["vocabulary"])),
        fluency: score_of(field(&scores_v, &["fluency"])),
    };

    let review = MonologueReview {
        overall: text_of(field(&v, &["overall", "summary"]), 800),
        goals_covered: align_goals(goals, list_of(field(&v, &["goalsCovered", "goals_covered", "goals"]))),
        errors,
        better_version: text_of(field(&v, &["betterVersion", "better_version", "improved"]), 3000),
        useful_phrases,
        scores,
        next_step: text_of(field(&v, &["nextStep", "next_step"]), 400),
        fluency,
    };
    // Ни общего вывода, ни исправленного рассказа — модель ответила не то.
    if review.overall.is_empty() && review.better_version.is_empty() {
        return None;
    }
    Some(review)
}

/// Первый JSON-объект из ответа: модель может обернуть его текстом или markdown.
fn extract_json_object(content: &str) -> &str {
    match (content.find('{'), content.rfind('}')) {
        (Some(s), Some(e)) if e > s => &content[s..=e],
        _ => content,
    }
}

// ---------- Промпт ----------

const SYSTEM_PROMPT: &str = "You review a SPOKEN answer of a Russian-speaking adult BEGINNER learning French \
who is preparing a job interview in French for a technician job (installation and maintenance of industrial doors, \
a Hörmann partner company). Be warm, encouraging and honest: praise what works first, then show what to fix.\n\
Reply with ONLY a JSON object with exactly these keys:\n\
\"overall\" (string), \"goalsCovered\" (array of {\"goal\": string, \"covered\": bool, \"note\": string}), \
\"errors\" (array of {\"quote\": string, \"correction\": string, \"explanation\": string, \"kind\": \"grammar\"|\"vocabulary\"|\"pronunciation\"|\"other\"}), \
\"betterVersion\" (string), \"usefulPhrases\" (array of {\"fr\": string, \"ru\": string}), \
\"scores\" ({\"content\": 1-5, \"grammar\": 1-5, \"vocabulary\": 1-5, \"fluency\": 1-5}), \"nextStep\" (string).\n\
Rules:\n\
- \"overall\": 2-3 short encouraging sentences in Russian. Start with what went well.\n\
- \"goalsCovered\": exactly one entry per listed goal, in the same order, goal text copied as given. \
\"note\" in Russian, one short sentence: what was said, or what is missing.\n\
- \"errors\": at most 6, the most important first (errors that hurt understanding, then frequent grammar). \
\"quote\" is copied EXACTLY from the learner's text; \"correction\" is the same fragment fixed; \
\"explanation\" is Russian, one short sentence. Never report punctuation or capital letters. \
For a spoken answer the text is an automatic transcript: do not report spelling or accents that sound the same; \
use \"pronunciation\" only when a word was clearly heard as a different, similar-sounding word.\n\
- \"betterVersion\": the learner's OWN story rewritten in correct, simple French of the same level. Keep their ideas, \
facts and order, change as little as possible, add nothing new. It is NOT the reference answer.\n\
- \"usefulPhrases\": 2-4 short French phrases that would make THIS answer better (especially for missed goals), with Russian translation.\n\
- \"scores\": integers 1-5 for a beginner at the given level (3 = fine for this level). Judge fluency from the measured facts.\n\
- \"nextStep\": one concrete thing to practise next, in Russian, one sentence.\n\
- If the answer is not French or not about the question, say so kindly in \"overall\" and give a low content score.";

fn build_user_prompt(input: &ReviewInput, fluency: &FluencyFacts) -> String {
    let goals = if input.goals.is_empty() {
        "—".to_string()
    } else {
        input.goals.iter().enumerate().map(|(i, g)| format!("{}. {g}", i + 1)).collect::<Vec<_>>().join("\n")
    };
    let fillers = if fluency.filler_words.is_empty() {
        "none detected".to_string()
    } else {
        fluency.filler_words.iter().map(|f| format!("{} ×{}", f.word, f.count)).collect::<Vec<_>>().join(", ")
    };
    let mut facts = format!(
        "words: {}; duration: {} s; fillers: {fillers}; repeated words: {}",
        fluency.words, fluency.duration_seconds, fluency.repetitions,
    );
    if let Some(wpm) = fluency.words_per_minute {
        facts.push_str(&format!("; words per minute: {wpm}"));
    }
    if let (Some(n), Some(longest)) = (fluency.long_pauses, fluency.longest_pause_seconds) {
        facts.push_str(&format!("; pauses over {LONG_PAUSE_SECONDS} s: {n} (longest {longest} s)"));
    }
    let reference = if input.model_answer.is_empty() {
        String::new()
    } else {
        format!("\nReference answer (ideas only, do NOT copy it into betterVersion): {}", input.model_answer)
    };
    format!(
        "Interview question: {}\nLearner level: {}\nGoals the answer should cover:\n{goals}\n\
         Answer given: {}\nMeasured facts: {facts}{reference}\n\nLearner's answer:\n{}",
        if input.question.is_empty() { "—" } else { input.question.as_str() },
        input.level,
        if input.spoken { "spoken (automatic transcript)" } else { "typed" },
        input.transcript,
    )
}

// ---------- Обработчик ----------

type ReviewOutcome = Result<MonologueReview, (StatusCode, String)>;

const INTERRUPTED: &str = "Проверка прервалась — попробуйте ещё раз.";

async fn run_review(input: ReviewInput, fluency: FluencyFacts) -> ReviewOutcome {
    let messages = vec![
        ChatMessage::system(SYSTEM_PROMPT),
        ChatMessage::user(build_user_prompt(&input, &fluency)),
    ];
    let content = llm::chat_text(ChatRequest {
        task: Task::Grading,
        messages,
        // Разбор длинный: исправленный рассказ, карточки ошибок по-русски.
        // Рассуждения держим короткими — иначе они съедают лимит и время,
        // а ждать разбора дольше полуминуты человек не станет.
        max_tokens: 4000,
        format: ResponseFormat::Text,
        think: Some("low".to_string()),
    })
    .await
    .map_err(|e| {
        eprintln!("[speech_review] llm: {e}");
        (StatusCode::BAD_GATEWAY, "Проверка сейчас недоступна — попробуйте через минуту.".to_string())
    })?;

    parse_review(&content, &input.goals, fluency).ok_or_else(|| {
        eprintln!("[speech_review] unparsable: {}", content.chars().take(300).collect::<String>());
        (StatusCode::BAD_GATEWAY, "Не разобрал ответ проверки — попробуйте ещё раз.".to_string())
    })
}

fn finished(joined: Result<ReviewOutcome, tokio::task::JoinError>) -> Response {
    match joined {
        Ok(Ok(review)) => Json(review).into_response(),
        Ok(Err((status, msg))) => fail(status, msg),
        Err(_) => fail(StatusCode::INTERNAL_SERVER_ERROR, INTERRUPTED),
    }
}

/// POST /api/ai/course/review-monologue — разбор рассказа целиком.
///
/// Разбор длинный, и модель может думать дольше, чем прокси веб-приложения
/// держит молчащее соединение (30 секунд). Поэтому если за двадцать секунд
/// ответа нет, отвечаем 200 сразу и держим соединение пробелами, а в конце
/// пишем JSON: разбора или `{"error": …}`. Ведущие пробелы JSON не мешают.
pub async fn review_monologue(
    State(rate_limiter): State<AppRateLimiter>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<MonologueReviewRequest>,
) -> Response {
    if let Some(resp) = rate_limited(&rate_limiter, &user.sub) {
        return resp;
    }
    let input = sanitize(payload);
    let toks = tokens(&input.transcript);
    if toks.iter().filter(|t| !is_hesitation(t)).count() < MIN_WORDS {
        return fail(StatusCode::UNPROCESSABLE_ENTITY, "Слишком короткий ответ — расскажите хотя бы пару предложений.");
    }
    if looks_like_loop(&toks) {
        return fail(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Похоже, распознавание приняло шум за речь. Запишите ещё раз ближе к микрофону.",
        );
    }

    let fluency = fluency_facts(&input.transcript, input.duration_seconds, &input.words, input.spoken);
    respond_patiently(tokio::spawn(run_review(input, fluency)), QUICK_WINDOW, HEARTBEAT).await
}

/// Быстрый ответ — обычный JSON с настоящим статусом. Долгий — 200 сразу,
/// пробел раз в `heartbeat`, в конце JSON разбора или `{"error": …}`.
async fn respond_patiently(
    mut task: tokio::task::JoinHandle<ReviewOutcome>,
    quick: Duration,
    heartbeat: Duration,
) -> Response {
    if let Ok(joined) = tokio::time::timeout(quick, &mut task).await {
        return finished(joined);
    }

    let stream = async_stream::stream! {
        let mut task = task;
        let mut tick = tokio::time::interval(heartbeat);
        tick.tick().await; // первый тик срабатывает сразу
        yield Ok::<_, Infallible>(bytes::Bytes::from_static(b" "));
        loop {
            tokio::select! {
                joined = &mut task => {
                    let body = match joined {
                        Ok(Ok(review)) => serde_json::to_vec(&review).unwrap_or_default(),
                        Ok(Err((_, msg))) => serde_json::to_vec(&ErrorBody { error: msg }).unwrap_or_default(),
                        Err(_) => serde_json::to_vec(&ErrorBody { error: INTERRUPTED.into() }).unwrap_or_default(),
                    };
                    yield Ok(bytes::Bytes::from(body));
                    break;
                }
                _ = tick.tick() => {
                    yield Ok(bytes::Bytes::from_static(b" "));
                }
            }
        }
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/json; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-cache")
        .header("X-Accel-Buffering", "no")
        .body(Body::from_stream(stream))
        .unwrap_or_else(|_| fail(StatusCode::INTERNAL_SERVER_ERROR, "response build failed"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tw(start: f64, end: f64) -> TimedWord {
        TimedWord { word: "x".into(), start, end }
    }

    fn goals() -> Vec<String> {
        vec!["Имя и откуда вы".to_string(), "Опыт работы".to_string(), "Почему эта работа".to_string()]
    }

    #[test]
    fn tokens_keep_elision_and_drop_punctuation() {
        assert_eq!(tokens("Bonjour, j'ai 35 ans. Euh… je suis technicien !"),
            vec!["bonjour", "j'ai", "35", "ans", "euh", "je", "suis", "technicien"]);
        assert_eq!(tokens("J’habite à Nice"), vec!["j’habite", "à", "nice"]);
    }

    #[test]
    fn hesitations_are_recognised() {
        for t in ["euh", "heu", "euhh", "eeuh", "hum", "hmm", "mm", "bah", "ben"] {
            assert!(is_hesitation(t), "{t} should be a filler");
        }
        for t in ["un", "une", "heure", "eu", "hier", "hommes", "bon", "alors", "nuh"] {
            assert!(!is_hesitation(t), "{t} is not a filler");
        }
    }

    #[test]
    fn fillers_count_euh_and_only_extra_alors() {
        let text = "Euh je m'appelle Ivan. Alors euh je suis technicien. Alors j'aime le travail. \
                    Alors heu je répare les portes. Alors voilà.";
        let f = fluency_facts(text, 60.0, &[], true);
        // euh ×2 + heu ×1 → «euh» ×3; alors ×4 − 2 разрешённых = 2.
        assert_eq!(f.filler_words, vec![
            FillerCount { word: "euh".into(), count: 3 },
            FillerCount { word: "alors".into(), count: 2 },
        ]);
        assert_eq!(f.fillers, 5);
    }

    #[test]
    fn words_per_minute_excludes_fillers() {
        // 20 слов без заполнителей за 30 секунд → 40 в минуту.
        let text = format!("euh {}", ["mot"; 20].join(" "));
        let f = fluency_facts(&text, 30.0, &[], true);
        assert_eq!(f.words, 20);
        assert_eq!(f.words_per_minute, Some(40));
    }

    #[test]
    fn no_rate_for_short_or_typed_answers() {
        assert_eq!(fluency_facts("je suis technicien", 5.0, &[], true).words_per_minute, None);
        assert_eq!(fluency_facts("je suis technicien", 60.0, &[], false).words_per_minute, None);
    }

    #[test]
    fn repetitions_skip_reflexive_pronouns() {
        let f = fluency_facts("je je suis là, nous nous levons tôt, le le travail", 30.0, &[], true);
        assert_eq!(f.repetitions, 2);
    }

    #[test]
    fn long_pauses_come_from_timestamps() {
        let words = vec![tw(0.0, 0.4), tw(0.5, 0.9), tw(3.5, 3.9), tw(4.0, 4.3), tw(7.0, 7.5), tw(7.4, 8.0)];
        let f = fluency_facts("a b c d e f", 8.0, &words, true);
        assert_eq!(f.long_pauses, Some(2));
        assert_eq!(f.longest_pause_seconds, Some(2.7));
    }

    #[test]
    fn pauses_unknown_without_timestamps() {
        let f = fluency_facts("un deux trois", 30.0, &[], true);
        assert_eq!(f.long_pauses, None);
        assert_eq!(f.longest_pause_seconds, None);
    }

    #[test]
    fn loops_are_detected_but_real_answers_pass() {
        let looped = tokens(&"Merci d'avoir regardé la vidéo. ".repeat(6));
        assert!(looks_like_loop(&looped));
        let same = tokens(&"oui ".repeat(25));
        assert!(looks_like_loop(&same));
        let real = tokens("Bonjour, je m'appelle Ivan, j'ai trente-cinq ans. Je suis technicien depuis dix ans. \
            J'ai travaillé en Ukraine dans une entreprise de portes. Je répare et j'installe les portes sectionnelles. \
            Je veux travailler chez vous parce que j'aime le travail manuel.");
        assert!(!looks_like_loop(&real));
        assert!(!looks_like_loop(&tokens("je suis je suis")));
    }

    #[test]
    fn caps_trim_long_input_at_word_boundary() {
        let long = "mot ".repeat(2000);
        let req = MonologueReviewRequest {
            question: "q".repeat(1000),
            goals: (0..20).map(|i| format!("goal {i}")).chain(std::iter::once("  ".to_string())).collect(),
            model_answer: Some("m".repeat(5000)),
            transcript: long,
            duration_seconds: 99999.0,
            level: Some("a2; DROP TABLE".into()),
            words: (0..2000).map(|i| tw(f64::from(i), f64::from(i) + 0.5)).collect(),
            mode: None,
        };
        let input = sanitize(req);
        assert_eq!(input.question.chars().count(), MAX_QUESTION_CHARS);
        assert_eq!(input.goals.len(), MAX_GOALS);
        assert!(input.model_answer.chars().count() <= MAX_MODEL_ANSWER_CHARS);
        assert!(input.transcript.chars().count() <= MAX_TRANSCRIPT_CHARS);
        assert!(input.transcript.ends_with("mot"), "cut at a word boundary");
        assert_eq!(input.duration_seconds, MAX_DURATION_SECONDS);
        assert_eq!(input.level, "A2DR");
        assert_eq!(input.words.len(), MAX_TIMED_WORDS);
        assert!(input.spoken);
    }

    #[test]
    fn bad_numbers_are_neutralised() {
        let req = MonologueReviewRequest {
            question: String::new(), goals: vec![], model_answer: None, transcript: "x".into(),
            duration_seconds: f64::NAN, level: None,
            words: vec![tw(f64::INFINITY, 1.0), tw(0.0, 1.0)], mode: Some("typed".into()),
        };
        let input = sanitize(req);
        assert_eq!(input.duration_seconds, 0.0);
        assert_eq!(input.level, "A1");
        assert_eq!(input.words.len(), 1);
        assert!(!input.spoken);
    }

    fn facts() -> FluencyFacts {
        fluency_facts("je suis technicien", 30.0, &[], true)
    }

    #[test]
    fn parses_a_complete_answer() {
        let raw = r#"Voici: ```json
        {"overall": "Хорошо!", "goalsCovered": [
            {"goal": "Имя и откуда вы", "covered": true, "note": "Сказали имя"},
            {"goal": "Опыт работы", "covered": false, "note": "Нет опыта"},
            {"goal": "Почему эта работа", "covered": "yes", "note": null}],
         "errors": [{"quote": "je suis 35 ans", "correction": "j'ai 35 ans", "explanation": "Возраст — avoir", "kind": "grammar"}],
         "betterVersion": "Je m'appelle Ivan, j'ai 35 ans.",
         "usefulPhrases": [{"fr": "J'ai dix ans d'expérience.", "ru": "У меня десять лет опыта."}],
         "scores": {"content": 4, "grammar": "3", "vocabulary": 3.6, "fluency": 9},
         "nextStep": "Потренируйте avoir."}
        ```"#;
        let r = parse_review(raw, &goals(), facts()).expect("parsed");
        assert_eq!(r.overall, "Хорошо!");
        assert_eq!(r.goals_covered.len(), 3);
        assert!(r.goals_covered[0].covered);
        assert!(!r.goals_covered[1].covered);
        assert!(r.goals_covered[2].covered);
        assert_eq!(r.goals_covered[2].note, "");
        assert_eq!(r.errors.len(), 1);
        assert_eq!(r.errors[0].kind, "grammar");
        assert_eq!(r.scores, Scores { content: 4, grammar: 3, vocabulary: 4, fluency: 5 });
        assert_eq!(r.useful_phrases.len(), 1);
        assert_eq!(r.next_step, "Потренируйте avoir.");
    }

    #[test]
    fn tolerates_nulls_missing_keys_and_snake_case() {
        let raw = r#"{"overall": null, "goals_covered": null, "errors": null,
            "better_version": "Je suis technicien.", "useful_phrases": [{"fr": null, "ru": "x"}, "junk"],
            "scores": null, "next_step": null}"#;
        let r = parse_review(raw, &goals(), facts()).expect("parsed");
        assert_eq!(r.overall, "");
        assert_eq!(r.better_version, "Je suis technicien.");
        assert!(r.errors.is_empty());
        assert!(r.useful_phrases.is_empty());
        assert_eq!(r.scores, Scores::default());
        // Все цели на месте, даже если модель о них промолчала.
        assert_eq!(r.goals_covered.iter().map(|g| g.goal.as_str()).collect::<Vec<_>>(),
            vec!["Имя и откуда вы", "Опыт работы", "Почему эта работа"]);
        assert!(r.goals_covered.iter().all(|g| !g.covered));
    }

    #[test]
    fn goals_keep_course_wording_and_match_by_text() {
        // Модель перепутала порядок и переписала одну цель своими словами.
        let raw = r#"{"overall": "ok", "goalsCovered": [
            {"goal": "Почему эта работа", "covered": true, "note": "a"},
            {"goal": "Расскажите об опыте", "covered": true, "note": "b"},
            {"goal": "имя и откуда вы", "covered": false, "note": "c"}]}"#;
        let r = parse_review(raw, &goals(), facts()).unwrap();
        assert_eq!(r.goals_covered[0], GoalCheck { goal: "Имя и откуда вы".into(), covered: false, note: "c".into() });
        assert_eq!(r.goals_covered[1].note, "b");
        assert_eq!(r.goals_covered[2], GoalCheck { goal: "Почему эта работа".into(), covered: true, note: "a".into() });
    }

    #[test]
    fn errors_are_cleaned_capped_and_normalised() {
        let mut items: Vec<String> = vec![
            r#"{"quote": "je suis content", "correction": "Je suis content.", "kind": "grammar"}"#.into(),
            r#"{"quote": "", "correction": "x"}"#.into(),
            r#"{"quote": "la porte", "correction": null}"#.into(),
            r#"{"quote": "le travaille", "correction": "le travail", "kind": "Vocabulaire"}"#.into(),
            r#"{"quote": "le travaille", "correction": "le travail", "kind": "vocabulary"}"#.into(),
            r#"{"quote": "j'ai marché", "correction": "j'ai marchais", "kind": "prononciation"}"#.into(),
        ];
        for i in 0..10 {
            items.push(format!(r#"{{"quote": "q{i}", "correction": "c{i}", "kind": null}}"#));
        }
        let raw = format!(r#"{{"overall": "ok", "errors": [{}]}}"#, items.join(","));
        let r = parse_review(&raw, &[], facts()).unwrap();
        assert_eq!(r.errors.len(), MAX_ERRORS);
        assert_eq!(r.errors[0].quote, "le travaille");
        assert_eq!(r.errors[0].kind, "vocabulary");
        assert_eq!(r.errors[1].kind, "pronunciation");
        assert_eq!(r.errors[2].kind, "other");
    }

    #[test]
    fn empty_or_broken_answers_are_rejected() {
        assert!(parse_review("не JSON", &goals(), facts()).is_none());
        assert!(parse_review("[1,2]", &goals(), facts()).is_none());
        assert!(parse_review(r#"{"errors": []}"#, &goals(), facts()).is_none());
    }

    #[test]
    fn prompt_carries_facts_and_marks_reference() {
        let input = ReviewInput {
            question: "Présentez-vous".into(),
            goals: goals(),
            model_answer: "Je m'appelle Paul.".into(),
            transcript: "Je m'appelle Ivan euh je suis technicien".into(),
            duration_seconds: 40.0,
            level: "A1".into(),
            words: vec![],
            spoken: true,
        };
        let f = fluency_facts(&input.transcript, 40.0, &[], true);
        let p = build_user_prompt(&input, &f);
        assert!(p.contains("euh ×1"));
        assert!(p.contains("words per minute: 9"));
        assert!(p.contains("do NOT copy"));
        assert!(p.contains("2. Опыт работы"));
        assert!(!p.contains("pauses over"));
    }

    fn sample_review() -> MonologueReview {
        parse_review(r#"{"overall": "Bravo", "betterVersion": "Je suis technicien."}"#, &[], facts()).unwrap()
    }

    async fn body_text(resp: Response) -> String {
        let bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        String::from_utf8(bytes.to_vec()).unwrap()
    }

    #[tokio::test]
    async fn quick_review_is_plain_json() {
        let task = tokio::spawn(async { Ok(sample_review()) });
        let resp = respond_patiently(task, Duration::from_millis(500), Duration::from_millis(50)).await;
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_text(resp).await;
        assert!(body.starts_with('{'));
        let v: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["overall"], "Bravo");
        assert_eq!(v["fluency"]["words"], 3);
    }

    #[tokio::test]
    async fn quick_failure_keeps_its_status() {
        let task = tokio::spawn(async { Err((StatusCode::BAD_GATEWAY, "нет".to_string())) });
        let resp = respond_patiently(task, Duration::from_millis(500), Duration::from_millis(50)).await;
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
        assert_eq!(serde_json::from_str::<Value>(&body_text(resp).await).unwrap()["error"], "нет");
    }

    #[tokio::test]
    async fn slow_review_is_padded_with_spaces_then_json() {
        let task = tokio::spawn(async {
            tokio::time::sleep(Duration::from_millis(200)).await;
            Ok(sample_review())
        });
        let resp = respond_patiently(task, Duration::from_millis(20), Duration::from_millis(40)).await;
        assert_eq!(resp.status(), StatusCode::OK);
        let body = body_text(resp).await;
        assert!(body.starts_with("  "), "heartbeats first: {body:?}");
        // Ведущие пробелы JSON не мешают — клиент разбирает тело как есть.
        let v: Value = serde_json::from_str(&body).unwrap();
        assert_eq!(v["betterVersion"], "Je suis technicien.");
    }

    #[tokio::test]
    async fn slow_failure_arrives_as_error_field() {
        let task = tokio::spawn(async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            Err((StatusCode::BAD_GATEWAY, "модель молчит".to_string()))
        });
        let resp = respond_patiently(task, Duration::from_millis(20), Duration::from_millis(30)).await;
        let v: Value = serde_json::from_str(&body_text(resp).await).unwrap();
        assert_eq!(v["error"], "модель молчит");
    }
}
