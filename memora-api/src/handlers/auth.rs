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
