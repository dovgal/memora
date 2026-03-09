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

pub async fn register(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let email = payload.email.to_lowercase();
    let password = payload.password;

    if email.is_empty() || password.len() < 6 {
        return Err((StatusCode::BAD_REQUEST, "Email required and password must be at least 6 characters".to_string()));
    }

    // Hash the password
    let hashed_password = hash(password, DEFAULT_COST)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to hash password: {}", e)))?;

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
            Err((StatusCode::CONFLICT, "User with this email already exists".to_string()))
        },
        Err(e) => {
            Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {}", e)))
        }
    }
}

pub async fn login(
    State(pool): State<PgPool>,
    Json(payload): Json<AuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let email = payload.email.to_lowercase();

    // Fetch user
    let user_record = sqlx::query!(
        "SELECT id, email, password_hash, role FROM users WHERE email = $1",
        email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    if let Some(user) = user_record {
        if let Some(hash) = user.password_hash {
            let is_valid = verify(&payload.password, &hash)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to verify password: {}", e)))?;

            if is_valid {
                let response = UserResponse {
                    id: user.id.to_string(),
                    email: user.email,
                    role: user.role,
                };
                return Ok((StatusCode::OK, Json(response)));
            }
        }
    }

    // Generic error for either not found or invalid password
    Err((StatusCode::UNAUTHORIZED, "Invalid email or password".to_string()))
}

pub async fn oauth_google(
    State(pool): State<PgPool>,
    headers: axum::http::HeaderMap,
    Json(payload): Json<crate::domain::dtos::GoogleAuthRequest>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    // 1. Validate Secret Header
    let expected_secret = std::env::var("NEXTAUTH_SECRET").unwrap_or_default();
    if expected_secret.is_empty() {
        return Err((StatusCode::INTERNAL_SERVER_ERROR, "Server misconfiguration: missing NEXTAUTH_SECRET".to_string()));
    }

    let auth_header = headers.get("x-backend-secret").and_then(|v| v.to_str().ok());
    if auth_header != Some(&expected_secret) {
        return Err((StatusCode::UNAUTHORIZED, "Invalid backend secret".to_string()));
    }

    let email = payload.email.to_lowercase();

    // 2. Check if user exists
    let existing_user = sqlx::query!(
        "SELECT id, email, role FROM users WHERE email = $1",
        email
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Database error: {}", e)))?;

    if let Some(user) = existing_user {
        let response = UserResponse {
            id: user.id.to_string(),
            email: user.email,
            role: user.role,
        };
        return Ok((StatusCode::OK, Json(response)));
    }

    // 3. User does not exist, create a new one without a password
    let mut tx = pool.begin().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

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
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create user: {}", e)));
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
        return Err((StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to create profile: {}", e)));
    }

    tx.commit().await.map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = UserResponse {
        id: user_id.to_string(),
        email,
        role: "student".to_string(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}
