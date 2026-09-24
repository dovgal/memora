//! Валидация и «ремонт» JSON юнита, сгенерированного LLM в `handlers::ai::generate_course_unit`,
//! для упражнений лесенки построения фраз (`substitution` / `transformation` /
//! `meaning-to-form`) и разговора с моделью (`ai-talk`).
//!
//! Модель (gpt-oss:120b через `crate::llm`) не соблюдает JSON-схему в `ResponseFormat`
//! даже когда промпт диктует форму буквально: то оставляет пустой ответ, то отвечает
//! одним словом вместо целой фразы, то путает cue-слово подстановки с самим ответом,
//! то пишет typographic-апостроф вместо обычного. Одна битая деталь не должна ронять
//! весь юнит — брак вычищается точечно: плохие пункты внутри упражнения выбрасываются,
//! а упражнение целиком — только если после чистки не осталось ни одного пункта.
//!
//! Вызывается ОДИН раз из `handlers::ai::generate_course_unit`, сразу после разбора
//! JSON от LLM и перед отправкой ответа клиенту.

use std::collections::{BTreeMap, HashSet};

use serde_json::Value;

use crate::judge::{self, Answer, Question};

/// Точка входа: чистит `unit["exercises"]` на месте. При иной форме unit (не объект
/// с массивом exercises) — no-op, ошибку сознательно не возвращаем: вызывающий код
/// уже провалидировал бы JSON раньше, если бы это было нужно для другой цели.
pub async fn validate_and_repair_unit(unit: &mut Value) {
    normalize_apostrophes(unit);

    let Some(exercises) = unit.get_mut("exercises").and_then(Value::as_array_mut) else {
        return;
    };

    // Шаг 1 (без сети): дедупликация id + детерминированный ремонт/отбраковка пунктов.
    let mut seen_ids: HashSet<String> = HashSet::new();
    exercises.retain_mut(|ex| {
        if let Some(id) = ex.get("id").and_then(Value::as_str) {
            // Дубликат id — упражнение целиком выбрасываем, первое вхождение остаётся.
            if !seen_ids.insert(id.to_string()) {
                return false;
            }
        }
        match ex.get("type").and_then(Value::as_str) {
            Some("substitution") => repair_substitution(ex),
            Some("transformation") => repair_transformation(ex),
            Some("meaning-to-form") => repair_meaning_to_form(ex),
            Some("ai-talk") => validate_ai_talk(ex),
            _ => true,
        }
    });

    // Шаг 2 (опционально, по сети): судья проверяет, что французский ответ
    // meaning-to-form действительно передаёт русский смысл. Один запрос на
    // упражнение (все пункты — одним батчем вопросов), не на пункт — иначе
    // генерация юнита с несколькими такими упражнениями ощутимо замедлится.
    // Судья недоступен/ошибся — молча оставляем то, что прошло шаг 1 (best-effort,
    // не гасим контент из-за флаки-сети).
    let mut keep = vec![true; exercises.len()];
    for (i, ex) in exercises.iter_mut().enumerate() {
        if ex.get("type").and_then(Value::as_str) == Some("meaning-to-form") {
            keep[i] = judge_meaning_to_form(ex).await;
        }
    }
    let mut idx = 0usize;
    exercises.retain(|_| {
        let k = keep[idx];
        idx += 1;
        k
    });
}

// ---------- Нормализация ----------

/// Заменяет типографский апостроф (U+2019, ’) на обычный (') во всех строках юнита.
/// Модель периодически отвечает «Je m’appelle» вместо «Je m'appelle», а клиентский
/// пословный diff (dictation/production) сравнивает буквально.
fn normalize_apostrophes(v: &mut Value) {
    match v {
        Value::String(s) => {
            if s.contains('\u{2019}') {
                *s = s.replace('\u{2019}', "'");
            }
        }
        Value::Array(arr) => arr.iter_mut().for_each(normalize_apostrophes),
        Value::Object(map) => map.values_mut().for_each(normalize_apostrophes),
        _ => {}
    }
}

/// true — строка непустая (после trim) и заканчивается на `.`, `?` или `!`.
fn ends_with_sentence_punct(s: &str) -> bool {
    let s = s.trim();
    !s.is_empty() && matches!(s.chars().last(), Some('.') | Some('?') | Some('!'))
}

/// Сворачивает распространённые французские диакритики к ASCII-базе — для
/// сравнения без учёта акцента (не для показа). Копия `handlers::creator::fold_diacritics`:
/// оба модуля мелкие и независимые, тянуть ради одной функции связь между ними не стоит.
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

/// Оставляет в `answers` только непустые строки, заканчивающиеся на `.`/`?`/`!`.
fn retain_sentence_answers(answers: &mut Vec<Value>) {
    answers.retain(|a| a.as_str().map(ends_with_sentence_punct).unwrap_or(false));
}

// ---------- substitution ----------

/// true — упражнение остаётся (возможно, часть пунктов вычищена); false — выбросить целиком.
fn repair_substitution(ex: &mut Value) -> bool {
    let Some(items) = ex.get_mut("substitutions").and_then(Value::as_array_mut) else {
        return false;
    };
    items.retain_mut(repair_substitution_item);
    !items.is_empty()
}

fn repair_substitution_item(it: &mut Value) -> bool {
    let cue = it.get("cue").and_then(Value::as_str).unwrap_or("").trim().to_string();
    if cue.is_empty() {
        return false;
    }
    let Some(answers) = it.get_mut("answers").and_then(Value::as_array_mut) else {
        return false;
    };
    retain_sentence_answers(answers);
    if answers.is_empty() {
        return false;
    }
    // Короткие служебные слова (артикли, предлоги) не всегда входят в ответ дословно
    // («un» → «une élève»), поэтому требование действует только для значимых cue.
    if cue.chars().count() > 2 {
        let cue_folded = fold_diacritics(&cue.to_lowercase());
        let found = answers
            .iter()
            .filter_map(Value::as_str)
            .any(|a| fold_diacritics(&a.to_lowercase()).contains(&cue_folded));
        if !found {
            return false;
        }
    }
    true
}

// ---------- transformation ----------

fn repair_transformation(ex: &mut Value) -> bool {
    let Some(items) = ex.get_mut("transformations").and_then(Value::as_array_mut) else {
        return false;
    };
    items.retain_mut(repair_transformation_item);
    !items.is_empty()
}

fn repair_transformation_item(it: &mut Value) -> bool {
    let source = it.get("source").and_then(Value::as_str).unwrap_or("").trim().to_string();
    if source.is_empty() {
        return false;
    }
    let Some(answers) = it.get_mut("answers").and_then(Value::as_array_mut) else {
        return false;
    };
    retain_sentence_answers(answers);
    // Ответ, дословно совпадающий с исходной фразой (без учёта регистра/акцента),
    // означает, что модель не выполнила задание («поставьте в отрицание» и т.п.).
    let source_folded = fold_diacritics(&source.to_lowercase());
    answers.retain(|a| {
        a.as_str()
            .map(|s| fold_diacritics(&s.to_lowercase()) != source_folded)
            .unwrap_or(false)
    });
    !answers.is_empty()
}

// ---------- meaning-to-form ----------

fn repair_meaning_to_form(ex: &mut Value) -> bool {
    let Some(items) = ex.get_mut("productions").and_then(Value::as_array_mut) else {
        return false;
    };
    items.retain_mut(repair_production_item);
    !items.is_empty()
}

fn repair_production_item(it: &mut Value) -> bool {
    let ru_ok = it.get("ru").and_then(Value::as_str).map(|s| !s.trim().is_empty()).unwrap_or(false);
    if !ru_ok {
        return false;
    }
    let Some(answers) = it.get_mut("answers").and_then(Value::as_array_mut) else {
        return false;
    };
    retain_sentence_answers(answers);
    !answers.is_empty()
}

/// Судья (best-effort): для каждого production-пункта спрашивает, действительно ли
/// французский ответ выражает данную русскую мысль. Все пункты упражнения — одним
/// батчем вопросов в одном запросе (см. `crate::judge`, ~0.3с на запрос).
/// Возвращает, остаётся ли упражнение (>=1 пункт после проверки).
async fn judge_meaning_to_form(ex: &mut Value) -> bool {
    let has_items = ex
        .get("productions")
        .and_then(Value::as_array)
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_items {
        return false;
    }

    let title = ex.get("title").and_then(Value::as_str).unwrap_or("").to_string();
    let items: Vec<(String, String)> = ex
        .get("productions")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .map(|it| {
                    let ru = it.get("ru").and_then(Value::as_str).unwrap_or("").to_string();
                    let answers = it
                        .get("answers")
                        .and_then(Value::as_array)
                        .map(|a| a.iter().filter_map(Value::as_str).collect::<Vec<_>>().join(" / "))
                        .unwrap_or_default();
                    (ru, answers)
                })
                .collect()
        })
        .unwrap_or_default();

    let mut questions: BTreeMap<String, Question> = BTreeMap::new();
    for (i, (ru, answers)) in items.iter().enumerate() {
        questions.insert(
            format!("p{i}"),
            Question::Noul {
                instructions: format!(
                    "Russian meaning to express: \"{ru}\". Proposed French answer(s): \"{answers}\". \
                     Does at least one French answer correctly and fully express this Russian meaning \
                     (ignore accents, capitalization and final punctuation)?"
                ),
                criteria: Some((
                    "yes, the meaning is fully expressed".to_string(),
                    "no, meaning is missing, wrong or incomplete".to_string(),
                )),
            },
        );
    }

    let state = format!("Exercise: {title}");
    // Судья целиком недоступен — не рубим контент, оставляем то, что прошло
    // детерминированную проверку шага 1 (best-effort).
    let Ok(result) = judge::ask(state, questions).await else {
        return true;
    };
    let threshold = judge::noul_threshold(result.provider);

    let mut i = 0usize;
    if let Some(arr) = ex.get_mut("productions").and_then(Value::as_array_mut) {
        arr.retain(|_| {
            let key = format!("p{i}");
            i += 1;
            match result.answers.get(&key).and_then(Answer::as_noul) {
                Some(p) => p >= threshold,
                // Судья не ответил конкретно на этот пункт — не топим его молчанием.
                None => true,
            }
        });
    }
    ex.get("productions").and_then(Value::as_array).map(|a| !a.is_empty()).unwrap_or(false)
}

// ---------- ai-talk ----------

/// Проверка на уровне упражнения целиком (нет списка пунктов внутри — либо годится
/// весь ai-talk, либо нет): role, situation непусты, минимум 2 goals и 2 hints.
fn validate_ai_talk(ex: &Value) -> bool {
    let non_empty_str = |key: &str| -> bool {
        ex.get(key).and_then(Value::as_str).map(|s| !s.trim().is_empty()).unwrap_or(false)
    };
    let count_non_empty = |key: &str| -> usize {
        ex.get(key)
            .and_then(Value::as_array)
            .map(|a| a.iter().filter(|v| v.as_str().map(|s| !s.trim().is_empty()).unwrap_or(false)).count())
            .unwrap_or(0)
    };

    non_empty_str("role") && non_empty_str("situation") && count_non_empty("goals") >= 2 && count_non_empty("hints") >= 2
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn ends_with_sentence_punct_checks_trailing_char() {
        assert!(ends_with_sentence_punct("Je suis ponctuel."));
        assert!(ends_with_sentence_punct("Ça va ?"));
        assert!(ends_with_sentence_punct("  Super !  "));
        assert!(!ends_with_sentence_punct(""));
        assert!(!ends_with_sentence_punct("   "));
        assert!(!ends_with_sentence_punct("Je suis ponctuel"));
    }

    #[test]
    fn normalize_apostrophes_replaces_typographic_quote_everywhere() {
        let mut v = json!({
            "exercises": [
                { "type": "ai-talk", "role": "L\u{2019}ami", "hints": ["Je m\u{2019}appelle Paul."] }
            ]
        });
        normalize_apostrophes(&mut v);
        assert_eq!(v["exercises"][0]["role"], "L'ami");
        assert_eq!(v["exercises"][0]["hints"][0], "Je m'appelle Paul.");
    }

    #[test]
    fn fold_diacritics_covers_common_french_accents() {
        assert_eq!(fold_diacritics("être élève çà où"), "etre eleve ca ou");
    }

    // ---------- substitution ----------

    #[test]
    fn substitution_item_survives_when_cue_is_in_answer() {
        let mut it = json!({ "cue": "ponctuel", "cueRu": "пунктуальный", "answers": ["Je suis ponctuel."] });
        assert!(repair_substitution_item(&mut it));
        assert_eq!(it["answers"], json!(["Je suis ponctuel."]));
    }

    #[test]
    fn substitution_item_survives_accent_insensitive_cue_match() {
        // cue "sérieux" (с акцентом) встречается в ответе "serieux" (без) — модель
        // иногда роняет диакритику в ответе, хотя пишет её в cue, и наоборот.
        let mut it = json!({ "cue": "sérieux", "answers": ["Je suis serieux."] });
        assert!(repair_substitution_item(&mut it));
    }

    #[test]
    fn substitution_item_dropped_when_cue_missing_from_answer() {
        let mut it = json!({ "cue": "motivé", "answers": ["Je suis fatigué."] });
        assert!(!repair_substitution_item(&mut it));
    }

    #[test]
    fn substitution_short_cue_skips_containment_check() {
        // Двухбуквенные служебные cue («un», «de») не обязаны входить дословно.
        let mut it = json!({ "cue": "un", "answers": ["C'est une élève."] });
        assert!(repair_substitution_item(&mut it));
    }

    #[test]
    fn substitution_item_dropped_when_all_answers_unpunctuated() {
        let mut it = json!({ "cue": "ponctuel", "answers": ["ponctuel"] });
        assert!(!repair_substitution_item(&mut it));
    }

    #[test]
    fn substitution_exercise_dropped_when_no_items_survive() {
        let mut ex = json!({
            "type": "substitution",
            "substitutions": [{ "cue": "motivé", "answers": ["Je suis fatigué."] }]
        });
        assert!(!repair_substitution(&mut ex));
    }

    // ---------- transformation ----------

    #[test]
    fn transformation_item_survives_when_answer_differs() {
        let mut it = json!({
            "source": "Je parle bien français.",
            "task": "négation",
            "answers": ["Je ne parle pas bien français."]
        });
        assert!(repair_transformation_item(&mut it));
    }

    #[test]
    fn transformation_item_dropped_when_answer_equals_source() {
        let mut it = json!({
            "source": "Je parle bien français.",
            "task": "négation",
            "answers": ["Je parle bien français."]
        });
        assert!(!repair_transformation_item(&mut it));
    }

    #[test]
    fn transformation_answer_equal_to_source_ignoring_accents_and_case_is_dropped() {
        let mut it = json!({
            "source": "Il a un casque.",
            "task": "question",
            "answers": ["IL A UN CASQUE."]
        });
        assert!(!repair_transformation_item(&mut it));
    }

    #[test]
    fn transformation_item_dropped_when_source_empty() {
        let mut it = json!({ "source": "", "task": "négation", "answers": ["Je ne sais pas."] });
        assert!(!repair_transformation_item(&mut it));
    }

    // ---------- meaning-to-form ----------

    #[test]
    fn production_item_survives_with_ru_and_valid_answer() {
        let mut it = json!({ "ru": "Я серьёзный.", "hint": "Je suis …", "answers": ["Je suis sérieux."] });
        assert!(repair_production_item(&mut it));
    }

    #[test]
    fn production_item_dropped_when_ru_missing() {
        let mut it = json!({ "ru": "", "answers": ["Je suis sérieux."] });
        assert!(!repair_production_item(&mut it));
    }

    #[test]
    fn production_item_dropped_when_no_valid_answers() {
        let mut it = json!({ "ru": "Я серьёзный.", "answers": ["sérieux"] });
        assert!(!repair_production_item(&mut it));
    }

    // ---------- ai-talk ----------

    #[test]
    fn ai_talk_valid_with_role_situation_two_goals_two_hints() {
        let ex = json!({
            "role": "коллега",
            "situation": "знакомство на работе",
            "goals": ["представиться", "сказать профессию"],
            "hints": ["Je m'appelle...", "Je suis..."]
        });
        assert!(validate_ai_talk(&ex));
    }

    #[test]
    fn ai_talk_invalid_with_one_goal() {
        let ex = json!({
            "role": "коллега",
            "situation": "знакомство на работе",
            "goals": ["представиться"],
            "hints": ["Je m'appelle...", "Je suis..."]
        });
        assert!(!validate_ai_talk(&ex));
    }

    #[test]
    fn ai_talk_invalid_without_role() {
        let ex = json!({
            "situation": "знакомство на работе",
            "goals": ["a", "b"],
            "hints": ["c", "d"]
        });
        assert!(!validate_ai_talk(&ex));
    }

    #[test]
    fn ai_talk_blank_strings_do_not_count_toward_minimums() {
        let ex = json!({
            "role": "коллега",
            "situation": "знакомство на работе",
            "goals": ["представиться", "   "],
            "hints": ["Je m'appelle...", "Je suis..."]
        });
        assert!(!validate_ai_talk(&ex));
    }

    // ---------- validate_and_repair_unit (без судьи: meaning-to-form отсутствует) ----------

    #[tokio::test]
    async fn drops_duplicate_ids_keeping_first_occurrence() {
        let mut unit = json!({
            "exercises": [
                { "id": "ex-1", "type": "theory", "content": "A" },
                { "id": "ex-1", "type": "theory", "content": "B" },
            ]
        });
        validate_and_repair_unit(&mut unit).await;
        let exercises = unit["exercises"].as_array().unwrap();
        assert_eq!(exercises.len(), 1);
        assert_eq!(exercises[0]["content"], "A");
    }

    #[tokio::test]
    async fn drops_substitution_exercise_left_with_zero_items_and_keeps_others() {
        let mut unit = json!({
            "exercises": [
                { "id": "ex-1", "type": "theory", "content": "тема" },
                {
                    "id": "ex-2",
                    "type": "substitution",
                    "frame": "Je suis motivé.",
                    "substitutions": [{ "cue": "motivé", "answers": ["ponctuel"] }]
                },
            ]
        });
        validate_and_repair_unit(&mut unit).await;
        let exercises = unit["exercises"].as_array().unwrap();
        assert_eq!(exercises.len(), 1);
        assert_eq!(exercises[0]["id"], "ex-1");
    }

    #[tokio::test]
    async fn normalizes_apostrophes_and_repairs_in_one_pass() {
        let mut unit = json!({
            "exercises": [{
                "id": "ex-1",
                "type": "substitution",
                "frame": "Je m\u{2019}appelle Paul.",
                "substitutions": [
                    { "cue": "motivé", "answers": ["Je suis motivé."] },
                    { "cue": "ponctuel", "answers": ["fatigué"] }
                ]
            }]
        });
        validate_and_repair_unit(&mut unit).await;
        let exercises = unit["exercises"].as_array().unwrap();
        assert_eq!(exercises.len(), 1);
        assert_eq!(exercises[0]["frame"], "Je m'appelle Paul.");
        let subs = exercises[0]["substitutions"].as_array().unwrap();
        assert_eq!(subs.len(), 1);
        assert_eq!(subs[0]["cue"], "motivé");
    }

    #[tokio::test]
    async fn missing_exercises_array_is_a_no_op() {
        let mut unit = json!({ "vocabulary": [] });
        validate_and_repair_unit(&mut unit).await;
        assert_eq!(unit, json!({ "vocabulary": [] }));
    }
}
