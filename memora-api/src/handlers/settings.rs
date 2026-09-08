//! Настройки человека: язык приложения и всё, что позже переедет из браузера.

use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;
use serde_json::json;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

type ApiResult<T> = Result<T, (StatusCode, Json<ApiError>)>;

fn uid(sub: &str) -> ApiResult<Uuid> {
    Uuid::parse_str(sub).map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user id"))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<ApiError>) {
    ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
}

/// Ключи, которые разрешено хранить. Список закрытый: иначе таблица настроек
/// со временем превращается в свалку, куда пишет кто угодно и что угодно.
const ALLOWED: [&str; 1] = ["language"];

/// Языки приложения. Незнакомый код молча не принимаем: пустой перевод
/// показал бы человеку наполовину русское меню.
const LANGUAGES: [&str; 3] = ["ru", "fr", "en"];

#[derive(Deserialize)]
pub struct PutSettingsRequest {
    /// Только те ключи, что меняют. Прочие остаются как были.
    #[serde(flatten)]
    pub values: HashMap<String, String>,
}

/// GET /api/settings — все настройки человека одним ответом.
pub async fn get_settings(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    let rows = sqlx::query("SELECT key, value FROM user_settings WHERE user_id = $1")
        .bind(user_id)
        .fetch_all(&pool)
        .await
        .map_err(db_err)?;

    let mut out = serde_json::Map::new();
    for r in &rows {
        out.insert(r.get::<String, _>("key"), json!(r.get::<String, _>("value")));
    }
    Ok((StatusCode::OK, Json(serde_json::Value::Object(out))))
}

/// PUT /api/settings — сохранить одну или несколько настроек.
pub async fn put_settings(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<PutSettingsRequest>,
) -> ApiResult<impl IntoResponse> {
    let user_id = uid(&user.sub)?;
    if payload.values.is_empty() {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Нечего сохранять"));
    }

    for (key, value) in &payload.values {
        if !ALLOWED.contains(&key.as_str()) {
            return Err(ApiError::response(StatusCode::BAD_REQUEST, format!("Неизвестная настройка: {key}")));
        }
        if key == "language" && !LANGUAGES.contains(&value.as_str()) {
            return Err(ApiError::response(
                StatusCode::BAD_REQUEST,
                format!("Язык может быть только одним из: {}", LANGUAGES.join(", ")),
            ));
        }
        sqlx::query(
            "INSERT INTO user_settings (user_id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (user_id, key) DO UPDATE SET value = $3, updated_at = NOW()",
        )
        .bind(user_id)
        .bind(key)
        .bind(value)
        .execute(&pool)
        .await
        .map_err(db_err)?;
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_settings_are_accepted() {
        assert!(ALLOWED.contains(&"language"));
        assert!(!ALLOWED.contains(&"whatever"));
    }

    #[test]
    fn only_the_three_languages_are_accepted() {
        for l in ["ru", "fr", "en"] {
            assert!(LANGUAGES.contains(&l));
        }
        // Незнакомый язык оставил бы меню наполовину непереведённым.
        assert!(!LANGUAGES.contains(&"de"));
    }
}
