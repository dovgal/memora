use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
    pub role: Option<String>,
}

#[derive(Debug)]
pub struct AuthenticatedUser(pub Claims);

impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get("Authorization")
            .and_then(|value| value.to_str().ok())
            .filter(|value| value.starts_with("Bearer "))
            .map(|value| &value[7..]);

        let token = match auth_header {
            Some(token) => token,
            None => return Err(AuthError::MissingToken),
        };

        let secret = env::var("NEXTAUTH_SECRET")
            .map_err(|_| AuthError::ConfigurationError)?;

        let validation = Validation::default();
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(secret.as_bytes()),
            &validation,
        )
        .map_err(|_| AuthError::InvalidToken)?;

        Ok(AuthenticatedUser(token_data.claims))
    }
}

#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
    ConfigurationError,
    #[allow(dead_code)]
    Forbidden,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid authorization token"),
            AuthError::ConfigurationError => (StatusCode::INTERNAL_SERVER_ERROR, "Server configuration error"),
            AuthError::Forbidden => (StatusCode::FORBIDDEN, "Insufficient permissions"),
        };
        
        // Output camelCase JSON errors as per requirements
        let body = Json(serde_json::json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

#[allow(dead_code)]
pub struct RequireTeacher(pub Claims);

impl<S> FromRequestParts<S> for RequireTeacher
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let AuthenticatedUser(claims) = AuthenticatedUser::from_request_parts(parts, state).await?;
        
        match claims.role.as_deref() {
            Some("teacher") => Ok(RequireTeacher(claims)),
            _ => Err(AuthError::Forbidden),
        }
    }
}

#[allow(dead_code)]
pub struct RequireStudent(pub Claims);

impl<S> FromRequestParts<S> for RequireStudent
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let AuthenticatedUser(claims) = AuthenticatedUser::from_request_parts(parts, state).await?;
        
        match claims.role.as_deref() {
            Some("student") => Ok(RequireStudent(claims)),
            _ => Err(AuthError::Forbidden),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test]
    async fn test_valid_token() {
        unsafe { env::set_var("NEXTAUTH_SECRET", "test-secret") };

        let claims = Claims {
            sub: "mock-user-id".to_owned(),
            role: Some("student".to_owned()),
            exp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs() as usize
                + 3600,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret("test-secret".as_bytes()),
        )
        .unwrap();

        let req = Request::builder()
            .header("Authorization", format!("Bearer {}", token))
            .body(())
            .unwrap();
        
        let (mut parts, _) = req.into_parts();

        let result = AuthenticatedUser::from_request_parts(&mut parts, &()).await;
        
        assert!(result.is_ok());
        let auth_user = result.unwrap();
        assert_eq!(auth_user.0.sub, "mock-user-id");
        assert_eq!(auth_user.0.role, Some("student".to_string()));
    }

    #[tokio::test]
    async fn test_missing_token() {
        let req = Request::builder().body(()).unwrap();
        let (mut parts, _) = req.into_parts();

        let result = AuthenticatedUser::from_request_parts(&mut parts, &()).await;
        
        assert!(result.is_err());
        match result.unwrap_err() {
            AuthError::MissingToken => (),
            _ => panic!("Expected MissingToken error"),
        }
    }
}

pub struct OptionalAuthenticatedUser(pub Option<Claims>);

impl<S> FromRequestParts<S> for OptionalAuthenticatedUser
where
    S: Send + Sync,
{
    type Rejection = std::convert::Infallible;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_result = AuthenticatedUser::from_request_parts(parts, state).await;
        match auth_result {
            Ok(AuthenticatedUser(claims)) => Ok(OptionalAuthenticatedUser(Some(claims))),
            Err(_) => Ok(OptionalAuthenticatedUser(None)),
        }
    }
}
