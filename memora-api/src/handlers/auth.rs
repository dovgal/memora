use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::dtos::{AuthRequest, UserResponse};
use super::errors::ApiError;

/// Проверка email по списку allowlist (чистая логика — для тестов).
/// Пустой список = allowlist отключён (регистрация открыта).
fn email_in_allowlist(list: &str, email: &str) -> bool {
    if list.trim().is_empty() {
        return true; // не настроен — открыто (обратная совместимость)
    }
    let email = email.trim().to_lowercase();
    list.split(',')
        .map(|e| e.trim().to_lowercase())
        .filter(|e| !e.is_empty())
        .any(|allowed| allowed == email)
}

/// Разрешена ли регистрация этого email. `REGISTRATION_ALLOWLIST` — email через запятую;
/// если задан, создание аккаунтов (и по паролю, и через Google SSO) разрешено только им.
/// Если не задан — регистрация открыта (не ломаем существующий деплой).
fn registration_allowed(email: &str) -> bool {
    let list = std::env::var("REGISTRATION_ALLOWLIST").unwrap_or_default();
    email_in_allowlist(&list, email)
}

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let email = payload.email.to_lowercase();
    let password = payload.password;

    if email.is_empty() || password.len() < 6 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Email required and password must be at least 6 characters"));
    }

    if !registration_allowed(&email) {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Registration is restricted on this instance"));
    }

    // Hash the password
    let hashed_password = hash(password, DEFAULT_COST)
        .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {e}")))?;

    // Insert user
    let user_id = Uuid::new_v4();
    let result = sqlx::query!(
        "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)",
        user_id,
        email,
        hashed_password
    )
    .execute(&pool)
    .await;

    match result {
        Ok(_) => {
            let response = UserResponse {
                id: user_id.to_string(),
                email,
                role: "student".to_string(),
            };
            Ok((StatusCode::CREATED, Json(response)))
        },
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            Err(ApiError::response(StatusCode::CONFLICT, "User with this email already exists"))
        },
        Err(e) => {
            Err(ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {e}")))
        }
    }
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let email = payload.email.to_lowercase();

    // Fetch user
    let user_record = sqlx::query!(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}")))?;

    if let Some(user) = user_record
        && let Some(hash) = user.password_hash {
            let is_valid = verify(&payload.password, &hash)
                .map_err(|e| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to verify password: {e}")))?;

            if is_valid {
                let response = UserResponse {
                    id: user.id.to_string(),
                    email: user.email,
                    role: user.role,
                };
                return Ok((StatusCode::OK, Json(response)));
            }
        }

    // Generic error for either not found or invalid password
    Err(ApiError::response(StatusCode::UNAUTHORIZED, "Invalid email or password"))
}

pub async fn oauth_google(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<crate::domain::dtos::GoogleAuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    // 1. Validate Secret Header
    let expected_secret = std::env::var("NEXTAUTH_SECRET").unwrap_or_default();
    if expected_secret.is_empty() {
        return Err(ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, "Server misconfiguration: missing NEXTAUTH_SECRET"));
    }

    let auth_header = headers.get("x-backend-secret").and_then(|v| v.to_str().ok());
    if auth_header != Some(&expected_secret) {
        return Err(ApiError::response(StatusCode::UNAUTHORIZED, "Invalid backend secret"));
    }

    let email = payload.email.to_lowercase();

    // 2. Check if user exists
    let existing_user = sqlx::query!(
        "SELECT id, email, role FROM users WHERE email = $1",
        email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {e}")))?;

    if let Some(user) = existing_user {
        let response = UserResponse {
            id: user.id.to_string(),
            email: user.email,
            role: user.role,
        };
        return Ok((StatusCode::OK, Json(response)));
    }

    // 3. User does not exist — это регистрация нового аккаунта через Google SSO,
    // поэтому здесь тоже действует allowlist (иначе любой Google-аккаунт создаётся).
    // Уже существующие пользователи возвращаются выше и не блокируются.
    if !registration_allowed(&email) {
        return Err(ApiError::response(StatusCode::FORBIDDEN, "Registration is restricted on this instance"));
    }

    let mut tx = pool.begin().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_id = Uuid::new_v4();
    let insert_user_result = sqlx::query!(
        "INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4)",
        user_id,
        email,
        None::<String>,
        "student"
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = insert_user_result {
        let _ = tx.rollback().await;
        return Err(ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {e}")));
    }

    let insert_profile_result = sqlx::query!(
        "INSERT INTO user_profiles (user_id, first_name, last_name, avatar_url) VALUES ($1, $2, $3, $4)",
        user_id,
        payload.first_name,
        payload.last_name,
        payload.avatar_url
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = insert_profile_result {
        let _ = tx.rollback().await;
        return Err(ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create profile: {e}")));
    }

    tx.commit().await.map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = UserResponse {
        id: user_id.to_string(),
        email,
        role: "student".to_string(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

#[cfg(test)]
mod tests {
    use super::email_in_allowlist;

    #[test]
    fn empty_allowlist_is_open() {
        assert!(email_in_allowlist("", "anyone@example.com"));
        assert!(email_in_allowlist("   ", "anyone@example.com"));
    }

    #[test]
    fn allowlist_matches_case_and_space_insensitively() {
        let list = " Mom@Family.com , kid@family.com ";
        assert!(email_in_allowlist(list, "mom@family.com"));
        assert!(email_in_allowlist(list, "KID@FAMILY.COM"));
        assert!(email_in_allowlist(list, "  kid@family.com  "));
    }

    #[test]
    fn allowlist_rejects_outsiders() {
        let list = "mom@family.com,kid@family.com";
        assert!(!email_in_allowlist(list, "stranger@evil.com"));
        assert!(!email_in_allowlist(list, ""));
    }
}
