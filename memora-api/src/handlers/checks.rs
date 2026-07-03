// Детерминированные проверки ответов, требующие сервера.
// Symbolic — CAS-эквивалентность через memora-math (SymPy): «2(x+1)» ≡ «2x+2».

use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};

use crate::middleware::auth::AuthenticatedUser;
use super::errors::ApiError;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolicCheckRequest {
    /// Каноническое выражение из упражнения.
    pub expected: String,
    /// Ответ учащегося.
    pub given: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolicCheckResponse {
    pub correct: bool,
}

/// POST /api/check/symbolic — эквивалентность выражений (без LLM, только CAS).
pub async fn check_symbolic(
    AuthenticatedUser(_user): AuthenticatedUser,
    Json(payload): Json<SymbolicCheckRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ApiError>)> {
    let expected = payload.expected.trim();
    let given = payload.given.trim();
    if expected.is_empty() || given.is_empty()
        || expected.chars().count() > 200 || given.chars().count() > 200 {
        return Err(ApiError::response(StatusCode::BAD_REQUEST, "expected and given must be 1..200 chars"));
    }

    if !crate::mathsvc::configured() {
        return Err(ApiError::response(
            StatusCode::SERVICE_UNAVAILABLE,
            "Symbolic checking is not configured (MATH_SERVICE_URL)",
        ));
    }

    match crate::mathsvc::check_equivalence(expected, given).await {
        Ok(correct) => Ok((StatusCode::OK, Json(SymbolicCheckResponse { correct }))),
        // Невалидное выражение ученика — это «неверно», а не 500.
        Err(e) if e.contains("400") => Ok((StatusCode::OK, Json(SymbolicCheckResponse { correct: false }))),
        Err(e) => Err(ApiError::response(StatusCode::BAD_GATEWAY, e)),
    }
}
