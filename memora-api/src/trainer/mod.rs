//! Движок тренажёра карточек: классификация карточки (профиль) и сборка
//! упражнений по её виду.
//!
//! Три источника упражнений:
//! - **детерминированные** (`build_recall`, `build_listen`, `build_speak`,
//!   `build_gender`, `build_recognize`) — собраны напрямую из содержимого
//!   карточки, без LLM, поэтому бессмысленными быть не могут;
//! - **LLM** (`generate_llm_exercises`) — только там, где без генерации не
//!   обойтись (пример-клоуз, спряжение глагола, построение фразы), и только
//!   после того, как пройдут детерминированные проверки И судью (`crate::judge`);
//! - **классификация** (`build_profile`) — дешёвые эвристики сначала, судья —
//!   только когда эвристика не уверена.

use std::collections::BTreeMap;

use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::judge::{self, Answer, JudgeState, Question};
use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};

pub const KINDS: [&str; 7] = ["noun", "verb", "adjective", "adverb", "phrase", "sentence", "other"];
pub const LANGS: [&str; 7] = ["fr", "ru", "en", "uk", "de", "es", "other"];

// ---------- Публичные типы (совпадают с memora-web/src/lib/contracts/trainer.ts) ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardExample {
    pub text: String,
    pub translation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CardProfile {
    pub card_id: String,
    pub kind: String,
    pub lang_front: String,
    pub lang_back: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lemma: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gender: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub example: Option<CardExample>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mnemonic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainerExercise {
    pub id: String,
    pub card_id: String,
    pub kind: String,
    pub prompt: String,
    pub prompt_lang: String,
    pub answer: String,
    pub accepted_answers: Vec<String>,
    pub answer_lang: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hint: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedSet {
    pub profiles: Vec<CardProfile>,
    pub exercises: Vec<TrainerExercise>,
    pub pending: u32,
}

/// Ещё не сохранённое в БД упражнение — без `id` (его выдаст БД при вставке).
#[derive(Debug, Clone)]
pub struct ExerciseDraft {
    pub kind: String,
    pub prompt: String,
    pub prompt_lang: String,
    pub answer: String,
    pub accepted_answers: Vec<String>,
    pub answer_lang: String,
    pub options: Option<Vec<String>>,
    pub hint: Option<String>,
    pub explanation: Option<String>,
    pub confidence: f32,
}

impl ExerciseDraft {
    pub fn into_exercise(self, id: Uuid, card_id: Uuid) -> TrainerExercise {
        TrainerExercise {
            id: id.to_string(),
            card_id: card_id.to_string(),
            kind: self.kind,
            prompt: self.prompt,
            prompt_lang: self.prompt_lang,
            answer: self.answer,
            accepted_answers: self.accepted_answers,
            answer_lang: self.answer_lang,
            options: self.options,
            hint: self.hint,
            explanation: self.explanation,
            confidence: self.confidence,
        }
    }
}

/// Сырые данные карточки, нужные движку — не тащим сюда всю строку БД.
#[derive(Debug, Clone)]
pub struct RawCard {
    pub id: Uuid,
    pub term: String,
    pub definition: String,
    pub fields_data: Value,
}

/// Компактные данные соседних карточек набора — материал для дистракторов `recognize`.
#[derive(Debug, Clone)]
pub struct SiblingCard {
    pub id: Uuid,
    pub kind: String,
    pub lang_back: String,
    pub definition: String,
}

// ---------- card_hash: инвалидация при правке карточки ----------

/// Хэш содержимого карточки. `serde_json::Value` в этом проекте без фичи
/// `preserve_order` сериализует объекты как `BTreeMap` — ключи всегда в одном
/// порядке, так что `to_string()` детерминирован и не зависит от порядка правки полей.
pub fn card_hash(card: &RawCard) -> String {
    let mut hasher = Sha256::new();
    hasher.update(card.term.as_bytes());
    hasher.update([0u8]);
    hasher.update(card.definition.as_bytes());
    hasher.update([0u8]);
    hasher.update(card.fields_data.to_string().as_bytes());
    // `GenericArray` не реализует `LowerHex` в этой версии sha2 — форматируем
    // байты сами (как `handlers::courses::short_hash`).
    hasher.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

/// Какие LLM-упражнения имеет смысл строить для карточки такого вида.
/// Пустой список — для этой карточки LLM не нужен вовсе (только детерминированные).
pub fn llm_kinds_for(kind: &str) -> Vec<&'static str> {
    match kind {
        "noun" | "adjective" | "adverb" => vec!["cloze", "build"],
        "verb" => vec!["cloze", "build", "conjugate"],
        // Клоуз на многословной фразе легко выходит бессмысленным — только build.
        "phrase" => vec!["build"],
        // "sentence" — карточка уже целое предложение, "other" — вид не распознан:
        // рисковать LLM-генерацией на неопределённом материале не стоим.
        _ => vec![],
    }
}

// ---------- Классификация карточки ----------

/// Дешёвая эвристика языка по алфавиту/маркерным словам. `None` — не уверены,
/// решать будет судья.
fn detect_lang(text: &str) -> Option<&'static str> {
    let t = text.trim();
    if t.is_empty() {
        return None;
    }
    let lower = t.to_lowercase();
    let has = |cs: &[char]| lower.chars().any(|c| cs.contains(&c));

    const CYRILLIC: [char; 33] = [
        'а', 'б', 'в', 'г', 'д', 'е', 'ж', 'з', 'и', 'й', 'к', 'л', 'м', 'н', 'о', 'п', 'р', 'с', 'т', 'у', 'ф', 'х', 'ц', 'ч',
        'ш', 'щ', 'ъ', 'ы', 'ь', 'э', 'ю', 'я', 'ё',
    ];
    if has(&CYRILLIC) {
        // Буквы, которых нет в русском алфавите, но есть в украинском.
        if has(&['і', 'ї', 'є', 'ґ']) {
            return Some("uk");
        }
        return Some("ru");
    }

    if has(&['œ', 'ç', 'à', 'è', 'ê', 'â', 'î', 'ô', 'û', 'ë', 'ï', 'ù']) {
        return Some("fr");
    }
    if lower.contains('ß') || has(&['ä', 'ö', 'ü']) {
        return Some("de");
    }
    if has(&['ñ', '¿', '¡']) {
        return Some("es");
    }

    let words: Vec<&str> = lower.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    if words.is_empty() {
        return None;
    }

    const FR: &[&str] = &[
        "le", "la", "les", "un", "une", "des", "et", "de", "du", "au", "aux", "est", "es", "suis", "je", "tu", "il", "elle",
        "nous", "vous", "ils", "elles", "être", "avoir", "pas", "ne", "ce", "cette", "avec", "pour",
    ];
    const EN: &[&str] = &[
        "the", "a", "an", "is", "are", "was", "were", "and", "to", "of", "in", "you", "he", "she", "it", "we", "they",
        "have", "has", "this", "that",
    ];
    const DE: &[&str] = &["der", "die", "das", "und", "ist", "nicht", "ein", "eine", "ich", "du", "er", "sie", "wir", "habe", "haben"];
    const ES: &[&str] = &["el", "los", "las", "es", "son", "que", "yo", "ella", "nosotros", "para", "con"];

    let score = |dict: &[&str]| words.iter().filter(|w| dict.contains(w)).count();
    let scores = [("fr", score(FR)), ("en", score(EN)), ("de", score(DE)), ("es", score(ES))];
    let best = scores.iter().max_by_key(|(_, s)| *s).expect("scores is non-empty");
    if best.1 > 0 {
        Some(best.0)
    } else {
        None
    }
}

fn lang_label(code: &str) -> &'static str {
    match code {
        "fr" => "French",
        "ru" => "Russian",
        "en" => "English",
        "uk" => "Ukrainian",
        "de" => "German",
        "es" => "Spanish",
        _ => "some other language",
    }
}

const FR_ARTICLES: [(&str, &str); 4] = [("le ", "m"), ("un ", "m"), ("la ", "f"), ("une ", "f")];

/// Артикль на письме однозначно даёт род (кроме l' — оно определяет только элизию,
/// не род). Возвращает (род, лемма-без-артикля).
fn gender_and_lemma_from_article(term: &str) -> (Option<&'static str>, Option<String>) {
    let t = term.trim();
    let lower = t.to_lowercase();
    for (article, gender) in FR_ARTICLES {
        if let Some(rest) = strip_prefix_ci(t, &lower, article) {
            return (Some(gender), Some(rest.trim().to_string()));
        }
    }
    for article in ["l'", "l’"] {
        if let Some(rest) = strip_prefix_ci(t, &lower, article) {
            return (None, Some(rest.trim().to_string()));
        }
    }
    (None, None)
}

fn strip_prefix_ci<'a>(original: &'a str, lower: &str, prefix: &str) -> Option<&'a str> {
    if lower.starts_with(prefix) {
        // Артикли — чистый ASCII/латиница, байтовая длина совпадает с исходной строкой.
        Some(&original[prefix.len()..])
    } else {
        None
    }
}

fn starts_with_article(lower: &str) -> bool {
    FR_ARTICLES.iter().any(|(a, _)| lower.starts_with(a)) || lower.starts_with("l'") || lower.starts_with("l’") || lower.starts_with("les ")
}

/// Эвристика части речи по написанию — дёшево и достаточно для большинства
/// карточек; остальное решает судья. Не претендует на лингвистическую строгость.
fn detect_kind_heuristic(term: &str) -> Option<&'static str> {
    let t = term.trim();
    if t.is_empty() {
        return None;
    }
    let lower = t.to_lowercase();

    if starts_with_article(&lower) {
        return Some("noun");
    }

    let word_count = lower.split_whitespace().count();
    let ends_sentence = t.ends_with('.') || t.ends_with('!') || t.ends_with('?');
    if ends_sentence || word_count >= 6 {
        return Some("sentence");
    }

    if word_count == 1 {
        if lower.ends_with("er") || lower.ends_with("ir") || lower.ends_with("oir") || lower.ends_with("re") {
            return Some("verb");
        }
        if lower.ends_with("ться") || lower.ends_with("ть") {
            return Some("verb");
        }
        return None;
    }

    if (2..=5).contains(&word_count) {
        return Some("phrase");
    }
    None
}

/// Определяет языки обеих сторон карточки: эвристика, а где не хватило — судья
/// (одним batched-вопросом на обе стороны сразу, если понадобилось обе).
async fn resolve_langs(term: &str, definition: &str, lf: Option<&'static str>, lb: Option<&'static str>) -> (String, String) {
    if let (Some(lf), Some(lb)) = (lf, lb) {
        return (lf.to_string(), lb.to_string());
    }

    let options: BTreeMap<String, String> = LANGS.iter().map(|l| (l.to_string(), lang_label(l).to_string())).collect();
    let mut questions = BTreeMap::new();
    if lf.is_none() {
        questions.insert(
            "lang_front".to_string(),
            Question::Choice {
                instructions: format!("What language is this text written in: \"{term}\"? Pick the closest option."),
                options: options.clone(),
            },
        );
    }
    if lb.is_none() {
        questions.insert(
            "lang_back".to_string(),
            Question::Choice {
                instructions: format!("What language is this text written in: \"{definition}\"? Pick the closest option."),
                options: options.clone(),
            },
        );
    }

    let state = JudgeState::Json(serde_json::json!({ "term": term, "definition": definition }));
    let result = judge::ask(state, questions).await.ok();

    let pick = |key: &str, fallback: Option<&'static str>| -> String {
        result
            .as_ref()
            .and_then(|r| r.answers.get(key))
            .and_then(Answer::as_choice)
            .map(|(c, _)| c.to_string())
            .or_else(|| fallback.map(str::to_string))
            .unwrap_or_else(|| "other".to_string())
    };

    (pick("lang_front", lf), pick("lang_back", lb))
}

async fn resolve_kind_via_judge(term: &str, definition: &str) -> String {
    let options: BTreeMap<String, String> = KINDS
        .iter()
        .map(|k| {
            let desc = match *k {
                "noun" => "a noun (thing, person, concept)",
                "verb" => "a verb (action, in any form)",
                "adjective" => "an adjective (describes a noun)",
                "adverb" => "an adverb (describes a verb/adjective)",
                "phrase" => "a short multi-word expression that is not a full sentence",
                "sentence" => "a full sentence",
                _ => "none of the above / unclear",
            };
            (k.to_string(), desc.to_string())
        })
        .collect();
    let mut questions = BTreeMap::new();
    questions.insert(
        "kind".to_string(),
        Question::Choice {
            instructions: format!(
                "A flashcard's front side reads: \"{term}\" and its back side (translation/definition) reads: \"{definition}\". \
                 What part of speech / kind of text is the front side?"
            ),
            options,
        },
    );
    let state = JudgeState::Json(serde_json::json!({ "term": term, "definition": definition }));
    match judge::ask(state, questions).await {
        Ok(result) => result
            .answers
            .get("kind")
            .and_then(Answer::as_choice)
            .map(|(c, _)| c.to_string())
            .unwrap_or_else(|| "other".to_string()),
        Err(_) => "other".to_string(),
    }
}

async fn resolve_gender_via_judge(term: &str, definition: &str) -> Option<String> {
    let mut options = BTreeMap::new();
    options.insert("m".to_string(), "masculine (le)".to_string());
    options.insert("f".to_string(), "feminine (la)".to_string());
    let mut questions = BTreeMap::new();
    questions.insert(
        "gender".to_string(),
        Question::Choice {
            instructions: format!(
                "In French, is the noun \"{term}\" (meaning: \"{definition}\") masculine or feminine?"
            ),
            options,
        },
    );
    let state = JudgeState::Text(format!("{term} — {definition}"));
    match judge::ask(state, questions).await {
        Ok(result) => result.answers.get("gender").and_then(Answer::as_choice).map(|(c, _)| c.to_string()),
        Err(_) => None,
    }
}

/// Строит профиль карточки: часть речи, языки сторон, лемма, род (для fr-сущ.).
/// Эвристики сначала — судья подключается только там, где эвристика не уверена.
pub async fn build_profile(card: &RawCard) -> CardProfile {
    let term = card.term.trim();
    let definition = card.definition.trim();

    let lf_guess = detect_lang(term);
    let lb_guess = detect_lang(definition);
    let (lang_front, lang_back) = resolve_langs(term, definition, lf_guess, lb_guess).await;

    let (article_gender, article_lemma) = if lang_front == "fr" { gender_and_lemma_from_article(term) } else { (None, None) };

    let mut kind = detect_kind_heuristic(term);
    if kind.is_none() && article_lemma.is_some() {
        kind = Some("noun");
    }
    let kind = match kind {
        Some(k) => k.to_string(),
        None => resolve_kind_via_judge(term, definition).await,
    };

    let gender = if kind == "noun" && lang_front == "fr" {
        match article_gender {
            Some(g) => Some(g.to_string()),
            None => resolve_gender_via_judge(term, definition).await,
        }
    } else {
        None
    };

    let lemma = article_lemma.or_else(|| Some(term.to_string()));

    CardProfile {
        card_id: card.id.to_string(),
        kind,
        lang_front,
        lang_back,
        lemma,
        gender,
        example: None,
        mnemonic: None,
    }
}

// ---------- Детерминированные упражнения ----------

pub fn build_recall(card: &RawCard, profile: &CardProfile) -> ExerciseDraft {
    ExerciseDraft {
        kind: "recall".to_string(),
        prompt: card.term.clone(),
        prompt_lang: profile.lang_front.clone(),
        answer: card.definition.clone(),
        accepted_answers: vec![card.definition.clone()],
        answer_lang: profile.lang_back.clone(),
        options: None,
        hint: None,
        explanation: None,
        confidence: 1.0,
    }
}

/// Что озвучить — оборотная сторона в своём языке, а ответ — то же самое: диктант.
pub fn build_listen(card: &RawCard, profile: &CardProfile) -> ExerciseDraft {
    ExerciseDraft {
        kind: "listen".to_string(),
        prompt: card.term.clone(),
        prompt_lang: profile.lang_front.clone(),
        answer: card.term.clone(),
        accepted_answers: vec![card.term.clone()],
        answer_lang: profile.lang_front.clone(),
        options: None,
        hint: None,
        explanation: None,
        confidence: 1.0,
    }
}

pub fn build_speak(card: &RawCard, profile: &CardProfile) -> ExerciseDraft {
    ExerciseDraft {
        kind: "speak".to_string(),
        prompt: card.term.clone(),
        prompt_lang: profile.lang_front.clone(),
        answer: card.term.clone(),
        accepted_answers: vec![card.term.clone()],
        answer_lang: profile.lang_front.clone(),
        options: None,
        hint: None,
        explanation: None,
        confidence: 1.0,
    }
}

/// Род — только для французских существительных с уже известным родом в профиле.
pub fn build_gender(card: &RawCard, profile: &CardProfile) -> Option<ExerciseDraft> {
    if profile.kind != "noun" || profile.lang_front != "fr" {
        return None;
    }
    let gender = profile.gender.as_deref()?;
    let lemma = profile.lemma.clone().unwrap_or_else(|| card.term.clone());
    let answer = if gender == "m" { "le" } else { "la" };
    Some(ExerciseDraft {
        kind: "gender".to_string(),
        prompt: lemma,
        prompt_lang: "fr".to_string(),
        answer: answer.to_string(),
        accepted_answers: vec![answer.to_string()],
        answer_lang: "fr".to_string(),
        options: Some(vec!["le".to_string(), "la".to_string()]),
        hint: None,
        explanation: None,
        confidence: 1.0,
    })
}

fn similarity_score(a: &str, b: &str) -> f64 {
    let len_a = a.chars().count() as f64;
    let len_b = b.chars().count() as f64;
    let len_diff = (len_a - len_b).abs();
    let len_score = 1.0 / (1.0 + len_diff);
    let prefix_len = a.chars().zip(b.chars()).take_while(|(x, y)| x == y).count() as f64;
    let prefix_score = prefix_len / len_a.max(len_b).max(1.0);
    len_score * 0.5 + prefix_score * 0.5
}

/// Ранжирует кандидатов-дистракторов по похожести на верный ответ. Дешёвая
/// эвристика (длина + общий префикс) вместо честного редакционного расстояния —
/// достаточно, чтобы отличить правдоподобный «почти такой же» от случайного слова,
/// а зависимость на новый crate не нужна.
fn rank_distractors(correct: &str, candidates: Vec<(Uuid, String)>) -> Vec<(Uuid, String)> {
    let correct_lower = correct.to_lowercase();
    let mut scored: Vec<(f64, (Uuid, String))> = candidates
        .into_iter()
        .filter(|(_, text)| !text.trim().is_empty() && text.to_lowercase() != correct_lower)
        .map(|c| (similarity_score(&correct_lower, &c.1.to_lowercase()), c))
        .collect();
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.into_iter().map(|(_, c)| c).collect()
}

fn shuffle_in_place(items: &mut [String]) {
    let mut rng = rand::rng();
    items.shuffle(&mut rng);
}

/// `recognize`: варианты — из карточек того же вида и того же языка ответа,
/// отранжированные по похожести. Судья `noul` вопросом отбраковывает варианты,
/// которые тоже могли бы сойти за верный ответ (неоднозначный дистрактор вредит
/// больше, чем его отсутствие). Если после этого дистракторов меньше двух —
/// упражнение не строим вовсе, а не подсовываем слабое.
pub async fn build_recognize(card: &RawCard, profile: &CardProfile, siblings: &[SiblingCard]) -> Option<ExerciseDraft> {
    let candidates: Vec<(Uuid, String)> = siblings
        .iter()
        .filter(|s| s.id != card.id && s.kind == profile.kind && s.lang_back == profile.lang_back)
        .map(|s| (s.id, s.definition.clone()))
        .collect();

    let ranked = rank_distractors(&card.definition, candidates);
    let mut picked: Vec<String> = ranked.into_iter().take(6).map(|(_, text)| text).collect();

    if !picked.is_empty() {
        let mut questions = BTreeMap::new();
        for (i, cand) in picked.iter().enumerate() {
            questions.insert(
                format!("d{i}"),
                Question::Noul {
                    instructions: format!(
                        "Flashcard front: \"{}\". Correct answer: \"{}\". Candidate distractor option: \"{}\". \
                         Could the candidate ALSO reasonably be accepted as correct for the front \
                         (synonym, near-duplicate meaning, same translation)?",
                        card.term, card.definition, cand
                    ),
                    criteria: Some(("yes, it could also be accepted as correct".to_string(), "no, it is clearly a different, wrong answer".to_string())),
                },
            );
        }
        let state = JudgeState::Text(format!("front={}; correct_answer={}", card.term, card.definition));
        // Судья целиком недоступен — доверяем ранжированию как есть (best-effort),
        // не отбрасываем упражнение только из-за недоступности judge.
        if let Ok(result) = judge::ask(state, questions).await {
            let threshold = judge::noul_threshold(result.provider);
            picked = picked
                .into_iter()
                .enumerate()
                .filter(|(i, _)| {
                    result
                        .answers
                        .get(&format!("d{i}"))
                        .and_then(Answer::as_noul)
                        // Низкая "could also be correct" вероятность => безопасный дистрактор.
                        .map(|p| p < threshold)
                        .unwrap_or(true)
                })
                .map(|(_, c)| c)
                .collect();
        }
    }

    if picked.len() < 2 {
        return None;
    }
    picked.truncate(3);

    let mut options = picked;
    options.push(card.definition.clone());
    shuffle_in_place(&mut options);

    Some(ExerciseDraft {
        kind: "recognize".to_string(),
        prompt: card.term.clone(),
        prompt_lang: profile.lang_front.clone(),
        answer: card.definition.clone(),
        accepted_answers: vec![card.definition.clone()],
        answer_lang: profile.lang_back.clone(),
        options: Some(options),
        hint: None,
        explanation: None,
        confidence: 1.0,
    })
}

// ---------- LLM-упражнения (только где без генерации не обойтись) ----------

fn extract_json_object(content: &str) -> &str {
    match (content.find('{'), content.rfind('}')) {
        (Some(s), Some(e)) if e > s => &content[s..=e],
        _ => content,
    }
}

fn judge_confidence_threshold() -> f32 {
    std::env::var("TRAINER_EXERCISE_MIN_CONFIDENCE").ok().and_then(|v| v.parse().ok()).unwrap_or(0.7)
}

/// Пример-клоуз: LLM пишет короткое предложение со словом карточки, мы режем
/// это же слово в пропуск. Деривированный `example` (для профиля) — то же
/// предложение целиком, с переводом.
async fn build_cloze(card: &RawCard, profile: &CardProfile) -> Option<(ExerciseDraft, CardExample)> {
    let system = "You write short example sentences for a language-learning flashcard app. \
        Reply with ONLY a raw JSON object: {\"sentence\": string, \"translation\": string}. \
        \"sentence\" is a short natural A1-A2 level sentence in the target language that uses the given word \
        naturally (any grammatical form is fine for a verb). \"translation\" is that sentence translated into \
        the answer language. No markdown, no extra text.";
    let user = format!(
        "Target language: {}. Answer/translation language: {}. Word: \"{}\" (meaning: \"{}\").",
        lang_label(&profile.lang_front),
        lang_label(&profile.lang_back),
        card.term,
        card.definition
    );
    let content = llm::chat_text(ChatRequest {
        task: Task::Generation,
        messages: vec![ChatMessage::system(system), ChatMessage::user(user)],
        max_tokens: 400,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    .ok()?;

    let parsed: Value = serde_json::from_str(extract_json_object(&content)).ok()?;
    let sentence = parsed.get("sentence").and_then(Value::as_str)?.trim().to_string();
    let translation = parsed.get("translation").and_then(Value::as_str).unwrap_or_default().trim().to_string();

    // Детерминированные проверки — прежде, чем тратить вызов судьи.
    if sentence.is_empty() || translation.is_empty() || translation == sentence {
        return None;
    }
    let word = card.term.trim();
    let pos = sentence.to_lowercase().find(&word.to_lowercase())?;
    let blanked = format!("{}___{}", &sentence[..pos], &sentence[pos + word.len()..]);
    if blanked == sentence {
        return None;
    }

    let (ok, probability, _provider) = judge::ask_sensible(
        format!(
            "This is a fill-in-the-blank exercise for an A1-A2 language learner. Sentence with blank: \"{blanked}\". \
             The word that must go in the blank: \"{word}\". Full sentence: \"{sentence}\" (translation: \"{translation}\"). \
             Is this exercise sensible for a beginner, and is \"{word}\" the one clearly correct answer for that blank?"
        ),
        JudgeState::Text(sentence.clone()),
    )
    .await;
    if !ok {
        return None;
    }

    let draft = ExerciseDraft {
        kind: "cloze".to_string(),
        prompt: blanked,
        prompt_lang: profile.lang_front.clone(),
        answer: word.to_string(),
        accepted_answers: vec![word.to_string()],
        answer_lang: profile.lang_front.clone(),
        options: None,
        hint: Some(translation.clone()),
        explanation: None,
        confidence: probability,
    };
    Some((draft, CardExample { text: sentence, translation }))
}

/// «Построй фразу»: русское задание, 1-3 принимаемых варианта ответа на языке карточки.
async fn build_build(card: &RawCard, profile: &CardProfile) -> Option<ExerciseDraft> {
    let system = "Ты — методист языковой платформы Memora. Придумай короткое задание уровня A1-A2 \
        по-русски: попроси составить короткое предложение с данным словом на изучаемом языке. \
        Ответь ТОЛЬКО сырым JSON-объектом: {\"task\": string (задание по-русски, упомяни слово в кавычках), \
        \"answers\": [string, ...] (1-3 примера верного ответа, короткие предложения на изучаемом языке, \
        каждое использует данное слово)}. Без markdown.";
    let user = format!(
        "Изучаемый язык: {}. Слово: «{}» (перевод: «{}»).",
        lang_label(&profile.lang_front),
        card.term,
        card.definition
    );
    let content = llm::chat_text(ChatRequest {
        task: Task::Generation,
        messages: vec![ChatMessage::system(system), ChatMessage::user(user)],
        max_tokens: 500,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    .ok()?;

    let parsed: Value = serde_json::from_str(extract_json_object(&content)).ok()?;
    let task = parsed.get("task").and_then(Value::as_str)?.trim().to_string();
    let answers: Vec<String> = parsed
        .get("answers")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(|v| v.as_str()).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect())
        .unwrap_or_default();

    if task.is_empty() || answers.is_empty() {
        return None;
    }
    let word_lower = card.term.trim().to_lowercase();
    let valid_answers: Vec<String> = answers.into_iter().filter(|a| a.to_lowercase().contains(&word_lower)).take(3).collect();
    if valid_answers.is_empty() {
        return None;
    }

    let (ok, probability, _provider) = judge::ask_sensible(
        format!(
            "This is a Russian-language instruction asking a beginner to build a short sentence with the word \"{}\". \
             Instruction: \"{task}\". Example accepted answers: {}. \
             Is the instruction clear and sensible for an A1-A2 learner, and are the example answers valid, \
             natural sentences using that word?",
            card.term,
            valid_answers.join(" | ")
        ),
        JudgeState::Text(task.clone()),
    )
    .await;
    if !ok {
        return None;
    }

    Some(ExerciseDraft {
        kind: "build".to_string(),
        prompt: task,
        prompt_lang: "ru".to_string(),
        answer: valid_answers[0].clone(),
        accepted_answers: valid_answers,
        answer_lang: profile.lang_front.clone(),
        options: None,
        hint: None,
        explanation: None,
        confidence: probability,
    })
}

const CONJUGATE_PERSONS: [(&str, &str); 2] = [("je", "я"), ("nous", "мы")];

/// Спряжение — только для глаголов. Одна проверка судьи на весь набор форм
/// (не на каждое лицо отдельно): либо форм у этого глагола можно доверять, либо нет.
async fn build_conjugate(card: &RawCard, profile: &CardProfile) -> Vec<ExerciseDraft> {
    let infinitive = profile.lemma.clone().unwrap_or_else(|| card.term.clone());
    let persons_list = CONJUGATE_PERSONS.iter().map(|(p, _)| *p).collect::<Vec<_>>().join(", ");

    let system = format!(
        "You conjugate French verbs for a beginner exercise. Reply with ONLY a raw JSON object: \
         {{\"forms\": {{\"<person>\": \"<present tense form>\", ...}}}} with exactly these persons: {persons_list}."
    );
    let user = format!("Infinitive: \"{infinitive}\" (meaning: \"{}\"). Present tense.", card.definition);
    let Ok(content) = llm::chat_text(ChatRequest {
        task: Task::Generation,
        messages: vec![ChatMessage::system(system), ChatMessage::user(user)],
        max_tokens: 300,
        format: ResponseFormat::Text,
        think: None,
    })
    .await
    else {
        return Vec::new();
    };

    let Ok(parsed) = serde_json::from_str::<Value>(extract_json_object(&content)) else {
        return Vec::new();
    };
    let Some(forms) = parsed.get("forms").and_then(Value::as_object) else {
        return Vec::new();
    };

    let mut collected: Vec<(&'static str, &'static str, String)> = Vec::new();
    for (person, person_ru) in CONJUGATE_PERSONS {
        let Some(form) = forms.get(person).and_then(Value::as_str) else { continue };
        let form = form.trim().to_string();
        if form.is_empty() || form.eq_ignore_ascii_case(&infinitive) {
            continue;
        }
        collected.push((person, person_ru, form));
    }
    if collected.is_empty() {
        return Vec::new();
    }

    let forms_summary = collected.iter().map(|(p, _, f)| format!("{p} → {f}")).collect::<Vec<_>>().join(", ");
    let (ok, probability, _provider) = judge::ask_sensible(
        format!(
            "These are present-tense French conjugation forms of the verb \"{infinitive}\" for a beginner drill: {forms_summary}. \
             Are these forms grammatically correct standard French?"
        ),
        JudgeState::Text(forms_summary.clone()),
    )
    .await;
    if !ok {
        return Vec::new();
    }

    collected
        .into_iter()
        .map(|(person, person_ru, form)| ExerciseDraft {
            kind: "conjugate".to_string(),
            prompt: format!("{infinitive} — {person} ___"),
            prompt_lang: "fr".to_string(),
            answer: form.clone(),
            accepted_answers: vec![form],
            answer_lang: "fr".to_string(),
            options: None,
            hint: Some(format!("{person} = {person_ru}")),
            explanation: None,
            confidence: probability,
        })
        .collect()
}

/// Строит запрошенные LLM-упражнения для карточки. Возвращает черновики и,
/// если строился `cloze`, пример для профиля карточки (см. `card_profiles.example`).
/// Вызовы идут последовательно (обычный `for` + `.await`) — Ollama Free
/// обслуживает один запрос за раз, параллелить их нельзя.
pub async fn generate_llm_exercises(card: &RawCard, profile: &CardProfile, kinds: &[&'static str]) -> (Vec<ExerciseDraft>, Option<CardExample>) {
    let min_confidence = judge_confidence_threshold();
    let mut out = Vec::new();
    let mut example = None;

    for kind in kinds {
        match *kind {
            "cloze" => {
                if let Some((draft, ex)) = build_cloze(card, profile).await
                    && draft.confidence >= min_confidence
                {
                    example = Some(ex);
                    out.push(draft);
                }
            }
            "build" => {
                if let Some(draft) = build_build(card, profile).await
                    && draft.confidence >= min_confidence
                {
                    out.push(draft);
                }
            }
            "conjugate" => {
                out.extend(build_conjugate(card, profile).await.into_iter().filter(|d| d.confidence >= min_confidence));
            }
            _ => {}
        }
    }
    (out, example)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn card(term: &str, definition: &str) -> RawCard {
        RawCard { id: Uuid::new_v4(), term: term.to_string(), definition: definition.to_string(), fields_data: serde_json::json!({}) }
    }

    #[test]
    fn card_hash_is_stable_for_same_content() {
        let c1 = card("le chat", "кот");
        let c2 = RawCard { id: Uuid::new_v4(), ..card("le chat", "кот") };
        assert_eq!(card_hash(&c1), card_hash(&c2));
    }

    #[test]
    fn card_hash_changes_when_term_changes() {
        let c1 = card("le chat", "кот");
        let c2 = card("le chien", "кот");
        assert_ne!(card_hash(&c1), card_hash(&c2));
    }

    #[test]
    fn card_hash_is_insensitive_to_fields_data_key_order() {
        let c1 = RawCard { id: Uuid::new_v4(), term: "a".into(), definition: "b".into(), fields_data: serde_json::json!({"x": 1, "y": 2}) };
        let c2 = RawCard { id: Uuid::new_v4(), term: "a".into(), definition: "b".into(), fields_data: serde_json::json!({"y": 2, "x": 1}) };
        assert_eq!(card_hash(&c1), card_hash(&c2));
    }

    #[test]
    fn gender_from_masculine_article() {
        let (gender, lemma) = gender_and_lemma_from_article("le chat");
        assert_eq!(gender, Some("m"));
        assert_eq!(lemma.as_deref(), Some("chat"));
    }

    #[test]
    fn gender_from_feminine_article() {
        let (gender, lemma) = gender_and_lemma_from_article("une porte");
        assert_eq!(gender, Some("f"));
        assert_eq!(lemma.as_deref(), Some("porte"));
    }

    #[test]
    fn elided_article_gives_no_gender() {
        let (gender, lemma) = gender_and_lemma_from_article("l'ami");
        assert_eq!(gender, None);
        assert_eq!(lemma.as_deref(), Some("ami"));
    }

    #[test]
    fn no_article_gives_no_gender() {
        let (gender, lemma) = gender_and_lemma_from_article("chat");
        assert_eq!(gender, None);
        assert_eq!(lemma, None);
    }

    #[test]
    fn kind_heuristic_detects_noun_by_article() {
        assert_eq!(detect_kind_heuristic("la porte"), Some("noun"));
        assert_eq!(detect_kind_heuristic("un chat"), Some("noun"));
    }

    #[test]
    fn kind_heuristic_detects_sentence_by_punctuation_or_length() {
        assert_eq!(detect_kind_heuristic("Je vais au marché ce matin."), Some("sentence"));
        assert_eq!(detect_kind_heuristic("mot un deux trois quatre cinq"), Some("sentence"));
    }

    #[test]
    fn kind_heuristic_detects_verb_infinitive() {
        assert_eq!(detect_kind_heuristic("manger"), Some("verb"));
        assert_eq!(detect_kind_heuristic("finir"), Some("verb"));
        assert_eq!(detect_kind_heuristic("говорить"), Some("verb"));
    }

    #[test]
    fn kind_heuristic_detects_phrase() {
        assert_eq!(detect_kind_heuristic("bonjour tout le monde"), Some("phrase"));
    }

    #[test]
    fn kind_heuristic_unsure_for_ambiguous_single_word() {
        // Ни артикля, ни глагольного окончания — пусть решает судья.
        assert_eq!(detect_kind_heuristic("bleu"), None);
    }

    #[test]
    fn lang_detection_recognizes_russian_and_ukrainian() {
        assert_eq!(detect_lang("привет"), Some("ru"));
        assert_eq!(detect_lang("привіт"), Some("uk"));
    }

    #[test]
    fn lang_detection_recognizes_french_by_diacritics() {
        assert_eq!(detect_lang("château"), Some("fr"));
    }

    #[test]
    fn lang_detection_recognizes_french_by_marker_words() {
        assert_eq!(detect_lang("le chat noir"), Some("fr"));
    }

    #[test]
    fn lang_detection_unsure_for_unknown_word() {
        assert_eq!(detect_lang("xyzzy"), None);
    }

    #[test]
    fn distractor_ranking_prefers_similar_length_and_prefix() {
        let candidates = vec![
            (Uuid::new_v4(), "кот".to_string()),
            (Uuid::new_v4(), "котёнок побежал за мячиком через весь двор".to_string()),
            (Uuid::new_v4(), "код".to_string()),
        ];
        let ranked = rank_distractors("кот", candidates);
        // "код" (общий префикс "ко", близкая длина) должен обойти длинный текст.
        assert_eq!(ranked[0].1, "код");
    }

    #[test]
    fn distractor_ranking_drops_duplicates_of_correct_answer() {
        let id = Uuid::new_v4();
        let candidates = vec![(id, "КОТ".to_string()), (Uuid::new_v4(), "собака".to_string())];
        let ranked = rank_distractors("кот", candidates);
        assert_eq!(ranked.len(), 1);
        assert_eq!(ranked[0].1, "собака");
    }

    #[test]
    fn llm_kinds_for_sentence_and_other_is_empty() {
        assert!(llm_kinds_for("sentence").is_empty());
        assert!(llm_kinds_for("other").is_empty());
    }

    #[test]
    fn llm_kinds_for_verb_includes_conjugate() {
        assert!(llm_kinds_for("verb").contains(&"conjugate"));
    }

    #[test]
    fn deterministic_builders_produce_expected_shape() {
        let c = card("le chat", "кот");
        let profile = CardProfile {
            card_id: c.id.to_string(),
            kind: "noun".into(),
            lang_front: "fr".into(),
            lang_back: "ru".into(),
            lemma: Some("chat".into()),
            gender: Some("m".into()),
            example: None,
            mnemonic: None,
        };
        let recall = build_recall(&c, &profile);
        assert_eq!(recall.prompt, "le chat");
        assert_eq!(recall.answer, "кот");

        let listen = build_listen(&c, &profile);
        assert_eq!(listen.answer, "le chat");
        assert_eq!(listen.answer_lang, "fr");

        let gender = build_gender(&c, &profile).unwrap();
        assert_eq!(gender.answer, "le");
        assert_eq!(gender.options, Some(vec!["le".to_string(), "la".to_string()]));
    }

    #[test]
    fn gender_exercise_skipped_for_non_noun_or_non_french() {
        let c = card("manger", "есть");
        let verb_profile = CardProfile {
            card_id: c.id.to_string(),
            kind: "verb".into(),
            lang_front: "fr".into(),
            lang_back: "ru".into(),
            lemma: Some("manger".into()),
            gender: None,
            example: None,
            mnemonic: None,
        };
        assert!(build_gender(&c, &verb_profile).is_none());
    }
}
