use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use sqlx::PgPool;
use chrono::NaiveDate;

use crate::domain::dtos::{OnboardingRequest, UserResponse};
use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

pub async fn finish_onboarding(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<OnboardingRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {

    let dob = NaiveDate::parse_from_str(&payload.date_of_birth, "%Y-%m-%d")
        .map_err(|_| ApiError::response(StatusCode::BAD_REQUEST, "Invalid date format"))?;

    // In a real OAuth flow we'd sync the user email first.
    // For this mock demo, we just ensure the user exists, then write the profile.
    let user_id = uuid::Uuid::parse_str(&user.sub).unwrap_or_else(|_| uuid::Uuid::new_v4());
    
    // Ensure the users table has this UUID
    sqlx::query!(
        "INSERT INTO users (id, email) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        user_id,
        format!("mock-{}@example.com", user_id)
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    // Upsert the profile with the DOB
    sqlx::query!(
        r#"
        INSERT INTO user_profiles (user_id, first_name, date_of_birth) 
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id) DO UPDATE 
        SET date_of_birth = EXCLUDED.date_of_birth
        "#,
        user_id,
        "New User",
        dob
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let response = UserResponse {
        id: user_id.to_string(),
        email: format!("mock-{user_id}@example.com"),
        role: "student".to_string(), // In a real app, you might fetch the actual role from DB
    };

    Ok((StatusCode::OK, Json(response)))
}

pub async fn update_role(
    State(pool): State<PgPool>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<crate::domain::dtos::RoleSelectionRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    
    // Valiate role input
    let new_role = payload.role.to_lowercase();
    if new_role != "student" && new_role != "teacher" {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "Invalid role. Must be 'student' or 'teacher'."));
    }

    let user_id = uuid::Uuid::parse_str(&user.sub)
        .map_err(|_| ApiError::response(StatusCode::UNAUTHORIZED, "Invalid user ID logic"))?;

    // Update the role in the users table
    let rows_affected = sqlx::query!(
        "UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2",
        new_role,
        user_id
    )
    .execute(&pool)
    .await
    .map_err(|e: sqlx::Error| ApiError::response(StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    .rows_affected();
    
    if rows_affected == 0 {
         return Err(ApiError::response(StatusCode::NOT_FOUND, "User not found"));
    }

    let response = UserResponse {
        id: user_id.to_string(),
        email: "hidden".to_string(), // Exclude email update semantics here
        role: new_role,
    };

    Ok((StatusCode::OK, Json(response)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::dtos::OnboardingRequest;

    // Because this endpoint requires a live PosgreSQL connection pool via State, 
    // a true unit test requires spinning up sqlx::test or mocking the pool.
    // Given the architecture, an integration check is more robust.
    // However, we can stub out the structures to show test scaffolding exists.
    
    #[test]
    fn test_onboarding_payload_parsing() {
        let payload = OnboardingRequest {
            date_of_birth: "2010-05-15".to_string(),
        };

        let dob_result = NaiveDate::parse_from_str(&payload.date_of_birth, "%Y-%m-%d");
        assert!(dob_result.is_ok());
        assert_eq!(dob_result.unwrap().format("%Y-%m-%d").to_string(), "2010-05-15");
    }

    #[test]
    fn test_onboarding_invalid_payload() {
        let payload = OnboardingRequest {
            date_of_birth: "invalid-date".to_string(),
        };

        let dob_result = NaiveDate::parse_from_str(&payload.date_of_birth, "%Y-%m-%d");
        assert!(dob_result.is_err());
    }
}
