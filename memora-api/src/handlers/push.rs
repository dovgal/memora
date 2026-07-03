// Push-подписки: регистрация из PWA, отписка, тестовая отправка.
// Отправкой напоминаний занимается воркер workers::push_reminder.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use crate::pushsvc::{self, PushOutcome};
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user token"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}"))
}

/// GET /api/push/public-key — VAPID-ключ для pushManager.subscribe.
pub async fn get_public_key(
    AuthenticatedUser(_user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    match pushsvc::public_key() {
        Some(key) => Ok((StatusCode::OK, Json(serde_json::json!({ "publicKey": key })))),
        None => Err(ApiError::response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Push is not configured (VAPID_PUBLIC_KEY)",
        )),
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeRequest {
    pub endpoint: String,
    pub p256dh: String,
    pub auth: String,
    /// Смещение часового пояса клиента (минуты к востоку от UTC) — для часа напоминания.
    pub tz_offset_min: Option<i32>,
}

/// POST /api/push/subscribe — сохранить/обновить подписку устройства.
pub async fn subscribe(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<SubscribeRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if payload.endpoint.trim().is_empty() || payload.endpoint.len() > 2000 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Invalid endpoint"));
    }
    let tz = payload.tz_offset_min.unwrap_or(0).clamp(-840, 840);

    sqlx::query(
        "INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, tz_offset_min)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (endpoint) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            p256dh = EXCLUDED.p256dh,
            auth = EXCLUDED.auth,
            tz_offset_min = EXCLUDED.tz_offset_min"
    )
    .bind(payload.endpoint.trim())
    .bind(user_id)
    .bind(&payload.p256dh)
    .bind(&payload.auth)
    .bind(tz)
    .execute(&pool)
    .await
    .map_err(db_err)?;

    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnsubscribeRequest {
    pub endpoint: String,
}

/// POST /api/push/unsubscribe — удалить подписку устройства.
pub async fn unsubscribe(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<UnsubscribeRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2")
        .bind(payload.endpoint.trim())
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(db_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestPushResponse {
    pub sent: u32,
    pub failed: u32,
}

/// POST /api/push/test — тестовое уведомление на все устройства пользователя
/// (ручная проверка сквозного пути: VAPID → push-сервис → SW → уведомление).
pub async fn send_test(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if !pushsvc::configured() {
        return Err(ApiError::response(StatusCode::SERVICE_UNAVAILABLE, "Push is not configured"));
    }

    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT endpoint FROM push_subscriptions WHERE user_id = $1"
    )
    .bind(user_id)
    .fetch_all(&pool)
    .await
    .map_err(db_err)?;

    if rows.is_empty() {
        return Err(ApiError::response(StatusCode::NOT_FOUND, "No push subscriptions for this user"));
    }

    let mut sent = 0u32;
    let mut failed = 0u32;
    for (endpoint,) in rows {
        match pushsvc::send_empty(&endpoint).await {
            PushOutcome::Sent => sent += 1,
            PushOutcome::Gone => {
                failed += 1;
                let _ = sqlx::query("DELETE FROM push_subscriptions WHERE endpoint = $1")
                    .bind(&endpoint)
                    .execute(&pool)
                    .await;
            }
            PushOutcome::Failed(e) => {
                failed += 1;
                eprintln!("push test failed for {endpoint}: {e}");
            }
        }
    }

    Ok((StatusCode::OK, Json(TestPushResponse { sent, failed })))
}
