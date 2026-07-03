//! Фоновая прегенерация вариантов упражнений.
//!
//! Идея: тяжёлая LLM-генерация уходит из интерактивного пути. Воркер периодически
//! смотрит, какие правила у пользователей будут due в ближайшие 24 часа, и заранее
//! кладёт по одному свежему варианту в `course_exercise_variants` (запас:
//! `used_at IS NULL`). `regenerate_variant` отдаёт запас мгновенно и помечает
//! использованным; при пустом запасе работает живая генерация, как раньше.
//!
//! Откуда воркер берёт эталон (контент упражнения):
//! - пользовательские курсы — из JSONB `custom_course_units.exercises`;
//! - встроенные курсы (контент только на фронтенде) — последний сохранённый вариант
//!   этого правила служит эталоном; до первого живого запроса запас не создаётся.
//!
//! Управление через env:
//! - `VARIANT_PREGEN=0` — выключить воркер;
//! - `VARIANT_PREGEN_INTERVAL_MIN` — период проходов (по умолчанию 60 минут);
//! - `VARIANT_PREGEN_BATCH` — максимум генераций за проход (по умолчанию 20),
//!   защищает квоту LLM-провайдера.

use std::time::Duration;

use sqlx::{PgPool, Row};

use crate::handlers::ai::{resolve_variant_format, try_build_variant, variant_prompt, verify_numeric_variant};
use crate::llm::{self, ChatMessage, ChatRequest, ResponseFormat, Task};

fn env_u64(key: &str, default: u64, min: u64, max: u64) -> u64 {
    std::env::var(key).ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(default)
        .clamp(min, max)
}

/// Название языка для промпта по коду курса.
fn language_name(code: &str) -> String {
    match code {
        "fr" | "" => "французский",
        "en" => "английский",
        "de" => "немецкий",
        "es" => "испанский",
        "ru" => "русский",
        other => other,
    }.to_string()
}

pub fn spawn(pool: PgPool) {
    if std::env::var("VARIANT_PREGEN").map(|v| v == "0").unwrap_or(false) {
        println!("variant-pregen: disabled (VARIANT_PREGEN=0)");
        return;
    }
    tokio::spawn(async move {
        let interval_min = env_u64("VARIANT_PREGEN_INTERVAL_MIN", 60, 5, 1440);
        // Первый проход — через 2 минуты после старта, чтобы не мешать раскатке.
        tokio::time::sleep(Duration::from_secs(120)).await;
        loop {
            match run_once(&pool).await {
                Ok(0) => {}
                Ok(n) => println!("variant-pregen: generated {} variant(s)", n),
                Err(e) => eprintln!("variant-pregen: pass failed: {}", e),
            }
            tokio::time::sleep(Duration::from_secs(interval_min * 60)).await;
        }
    });
}

/// Эталон и параметры генерации для одного правила.
struct PregenSeed {
    exercise: serde_json::Value,
    format: &'static str,
    rule_point: Option<String>,
    rule_trap: Option<String>,
    language: String,
    level: String,
}

/// Один проход: найти правила с due в ближайшие 24 часа без запаса и пополнить запас.
async fn run_once(pool: &PgPool) -> Result<u32, sqlx::Error> {
    let batch = env_u64("VARIANT_PREGEN_BATCH", 20, 1, 100) as u32;

    let candidates = sqlx::query(
        "SELECT DISTINCT r.user_id, r.course_id, r.unit_id, r.exercise_id
         FROM course_exercise_reviews r
         WHERE r.due <= NOW() + interval '24 hours'
           AND NOT EXISTS (
             SELECT 1 FROM course_exercise_variants v
             WHERE v.user_id = r.user_id AND v.course_id = r.course_id
               AND v.unit_id = r.unit_id AND v.exercise_id = r.exercise_id
               AND v.used_at IS NULL AND v.flagged = FALSE)
         LIMIT 150"
    )
    .fetch_all(pool)
    .await?;

    let mut generated: u32 = 0;
    for row in candidates {
        if generated >= batch { break; }
        let user_id: uuid::Uuid = row.get("user_id");
        let course_id: String = row.get("course_id");
        let unit_id: String = row.get("unit_id");
        let exercise_id: String = row.get("exercise_id");

        let Some(seed) = resolve_seed(pool, user_id, &course_id, &unit_id, &exercise_id).await else { continue };

        if pregenerate_one(pool, user_id, &course_id, &unit_id, &exercise_id, &seed).await {
            generated += 1;
            // Пауза между генерациями — не создавать всплеск нагрузки на провайдера.
            tokio::time::sleep(Duration::from_secs(3)).await;
        }
    }
    Ok(generated)
}

/// Определяет эталон правила. None — вариант этому правилу не положен
/// (нет разметки, неподдерживаемый тип, ещё нет бутстрапа для встроенного курса).
async fn resolve_seed(
    pool: &PgPool,
    user_id: uuid::Uuid,
    course_id: &str,
    unit_id: &str,
    exercise_id: &str,
) -> Option<PregenSeed> {
    if let Ok(course_uuid) = uuid::Uuid::parse_str(course_id) {
        // Пользовательский курс: эталон из JSONB юнита.
        let unit_uuid = uuid::Uuid::parse_str(unit_id).ok()?;
        let row = sqlx::query(
            "SELECT c.language, c.level, u.exercises
             FROM custom_course_units u JOIN custom_courses c ON c.id = u.course_id
             WHERE u.id = $1 AND u.course_id = $2"
        )
        .bind(unit_uuid)
        .bind(course_uuid)
        .fetch_optional(pool)
        .await
        .ok()??;

        let exercises: serde_json::Value = row.get("exercises");
        let ex = exercises.as_array()?
            .iter()
            .find(|e| e.get("id").and_then(|i| i.as_str()) == Some(exercise_id))?
            .clone();

        // Политика — та же, что у клиента (CoachSession): error-hunt всегда,
        // остальные поддерживаемые типы — только при разметке правилом;
        // variantPolicy.regenerateOnRepeat явно включает/выключает.
        let ex_type = ex.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let policy = ex.get("variantPolicy");
        let regen = policy.and_then(|p| p.get("regenerateOnRepeat")).and_then(|b| b.as_bool());
        let rule = ex.get("rule");
        let has_rule = rule.map(|r|
            r.get("skill").and_then(|s| s.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
            || r.get("point").and_then(|s| s.as_str()).map(|s| !s.is_empty()).unwrap_or(false)
        ).unwrap_or(false);
        let wants = regen == Some(true)
            || (regen != Some(false) && (ex_type == "error-hunt" || has_rule));
        if !wants { return None; }

        let requested = policy.and_then(|p| p.get("format")).and_then(|f| f.as_str())
            .unwrap_or(if ex_type == "error-hunt" { "error-hunt" } else { "preserve" });
        let format = resolve_variant_format(Some(requested), ex_type)?;
        // numeric — только с CAS-верификацией (memora-math).
        if format == "numeric" && !crate::mathsvc::configured() { return None; }

        let language_code: String = row.get("language");
        let level: String = row.get("level");
        Some(PregenSeed {
            format,
            rule_point: rule.and_then(|r| r.get("point")).and_then(|s| s.as_str()).map(str::to_string),
            rule_trap: rule.and_then(|r| r.get("trap")).and_then(|s| s.as_str()).map(str::to_string),
            language: language_name(&language_code),
            level: if level.trim().is_empty() { "A1".to_string() } else { level },
            exercise: ex,
        })
    } else {
        // Встроенный курс: контента на сервере нет — эталоном служит последний
        // сохранённый вариант этого правила (появляется после первого живого запроса).
        let row = sqlx::query(
            "SELECT payload::text AS payload, format, rule_key
             FROM course_exercise_variants
             WHERE user_id = $1 AND course_id = $2 AND unit_id = $3 AND exercise_id = $4
               AND flagged = FALSE
             ORDER BY created_at DESC LIMIT 1"
        )
        .bind(user_id)
        .bind(course_id)
        .bind(unit_id)
        .bind(exercise_id)
        .fetch_optional(pool)
        .await
        .ok()??;

        let payload: String = row.get("payload");
        let exercise: serde_json::Value = serde_json::from_str(&payload).ok()?;
        let format_stored: String = row.get("format");
        let format = resolve_variant_format(Some("preserve"), &format_stored)
            .unwrap_or("error-hunt");
        Some(PregenSeed {
            format,
            rule_point: row.try_get::<Option<String>, _>("rule_key").ok().flatten(),
            rule_trap: None,
            language: "французский".to_string(),
            level: "A2".to_string(),
            exercise,
        })
    }
}

/// Генерирует и сохраняет один вариант в запас. true — вариант создан.
async fn pregenerate_one(
    pool: &PgPool,
    user_id: uuid::Uuid,
    course_id: &str,
    unit_id: &str,
    exercise_id: &str,
    seed: &PregenSeed,
) -> bool {
    // Анти-повтор: последние подписи этого правила.
    let avoid_norm: Vec<String> = sqlx::query(
        "SELECT sentence FROM course_exercise_variants
         WHERE user_id = $1 AND course_id = $2 AND unit_id = $3 AND exercise_id = $4
         ORDER BY created_at DESC LIMIT 10"
    )
    .bind(user_id)
    .bind(course_id)
    .bind(unit_id)
    .bind(exercise_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default()
    .iter()
    .filter_map(|r| r.try_get::<Option<String>, _>("sentence").ok().flatten())
    .map(|s| s.split_whitespace().collect::<Vec<_>>().join(" ").to_lowercase())
    .collect();

    let avoid_block = if avoid_norm.is_empty() { "—".to_string() } else {
        avoid_norm.iter().take(8).map(|s| format!("«{}»", s)).collect::<Vec<_>>().join("; ")
    };
    let rule_point = seed.rule_point.clone().unwrap_or_else(|| "выведи правило из эталонного упражнения".to_string());
    let rule_trap = seed.rule_trap.clone().unwrap_or_else(|| "—".to_string());
    let seed_title = seed.exercise.get("title").and_then(|t| t.as_str()).unwrap_or("Упражнение").to_string();
    let seed_json: String = serde_json::to_string(&seed.exercise).unwrap_or_default().chars().take(4000).collect();

    let (system, schema) = variant_prompt(
        seed.format, &seed.exercise, &rule_point, &rule_trap, &seed.level, &seed.language, &avoid_block,
    );
    let user_msg = format!("Эталонное упражнение (JSON): {seed_json}. Сгенерируй вариант сейчас.");

    // Фоновому проходу достаточно 2 попыток — следующий проход доберёт.
    for _ in 0..2 {
        let content = match llm::chat_text(ChatRequest {
            task: Task::Generation,
            messages: vec![ChatMessage::system(system.clone()), ChatMessage::user(user_msg.clone())],
            max_tokens: 1200,
            format: ResponseFormat::JsonSchema(schema.clone()),
        }).await {
            Ok(c) => c,
            Err(e) => {
                eprintln!("variant-pregen: llm error for {}/{}: {}", course_id, exercise_id, e);
                return false;
            }
        };
        if let Some((variant, signature)) = try_build_variant(seed.format, &content, exercise_id, &seed_title, &avoid_norm) {
            if !verify_numeric_variant(seed.format, &variant).await {
                continue; // арифметика не сошлась с CAS — следующая попытка
            }
            let payload_text = serde_json::to_string(&variant).unwrap_or_else(|_| "{}".to_string());
            let inserted = sqlx::query(
                "INSERT INTO course_exercise_variants
                    (user_id, course_id, unit_id, exercise_id, rule_key, format, payload, sentence, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pregen')"
            )
            .bind(user_id)
            .bind(course_id)
            .bind(unit_id)
            .bind(exercise_id)
            .bind(&seed.rule_point)
            .bind(seed.format)
            .bind(&payload_text)
            .bind(&signature)
            .execute(pool)
            .await;
            return inserted.is_ok();
        }
    }
    false
}
