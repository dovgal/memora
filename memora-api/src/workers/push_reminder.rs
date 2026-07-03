//! Ежедневное push-напоминание о повторениях.
//!
//! Логика: раз в ~20 минут воркер смотрит все подписки; если у пользователя
//! в его локальном времени (tz_offset_min подписки) наступил час напоминания,
//! есть просроченные повторения и он СЕГОДНЯ ещё не занимался — отправляем
//! пустой push (текст показывает service worker). Одно напоминание на
//! устройство в день (last_reminded_at).
//!
//! Управление:
//! - выключен, пока не заданы VAPID-ключи (pushsvc::configured);
//! - `PUSH_REMINDER_HOUR` — локальный час напоминания (по умолчанию 18).

use std::time::Duration;

use sqlx::{PgPool, Row};

use crate::pushsvc::{self, PushOutcome};

fn reminder_hour() -> u32 {
    std::env::var("PUSH_REMINDER_HOUR").ok()
        .and_then(|v| v.parse::<u32>().ok())
        .unwrap_or(18)
        .clamp(0, 23)
}

pub fn spawn(pool: PgPool) {
    if !pushsvc::configured() {
        println!("push-reminder: disabled (VAPID keys are not set)");
        return;
    }
    tokio::spawn(async move {
        // Первый проход — через 3 минуты после старта.
        tokio::time::sleep(Duration::from_secs(180)).await;
        loop {
            match run_once(&pool).await {
                Ok(0) => {}
                Ok(n) => println!("push-reminder: sent {n} reminder(s)"),
                Err(e) => eprintln!("push-reminder: pass failed: {e}"),
            }
            tokio::time::sleep(Duration::from_secs(20 * 60)).await;
        }
    });
}

async fn run_once(pool: &PgPool) -> Result<u32, sqlx::Error> {
    let hour = reminder_hour();

    // Кандидаты: подписки, у которых в локальном времени сейчас час напоминания,
    // сегодня (локально) ещё не напоминали, у пользователя есть просроченные
    // повторения и НЕТ занятий за сегодня.
    let rows = sqlx::query(
        "SELECT s.endpoint
         FROM push_subscriptions s
         WHERE EXTRACT(HOUR FROM (NOW() + (s.tz_offset_min || ' minutes')::interval)) = $1
           AND (s.last_reminded_at IS NULL
                OR (s.last_reminded_at + (s.tz_offset_min || ' minutes')::interval)::date
                 < (NOW() + (s.tz_offset_min || ' minutes')::interval)::date)
           AND EXISTS (
             SELECT 1 FROM course_exercise_reviews r
             WHERE r.user_id = s.user_id AND r.due <= NOW())
           AND NOT EXISTS (
             SELECT 1 FROM course_review_logs l
             WHERE l.user_id = s.user_id
               AND (l.review_time + (s.tz_offset_min || ' minutes')::interval)::date
                 = (NOW() + (s.tz_offset_min || ' minutes')::interval)::date)
         LIMIT 100"
    )
    .bind(hour as f64)
    .fetch_all(pool)
    .await?;

    let mut sent = 0u32;
    for row in rows {
        let endpoint: String = row.get("endpoint");
        match pushsvc::send_empty(&endpoint).await {
            PushOutcome::Sent => {
                sent += 1;
                let _ = sqlx::query("UPDATE push_subscriptions SET last_reminded_at = NOW() WHERE endpoint = $1")
                    .bind(&endpoint)
                    .execute(pool)
                    .await;
            }
            PushOutcome::Gone => {
                // Подписка умерла (переустановили PWA и т.п.) — чистим.
                let _ = sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = $1")
                    .bind(&endpoint)
                    .execute(pool)
                    .await;
            }
            PushOutcome::Failed(e) => eprintln!("push-reminder: send failed for {endpoint}: {e}"),
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    Ok(sent)
}
