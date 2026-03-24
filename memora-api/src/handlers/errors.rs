use serde::Serialize;
use axum::Json;
use axum::http::StatusCode;

#[derive(Serialize)]
pub struct ApiError {
    pub error: String,
}

impl ApiError {
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            error: message.into(),
        }
    }

    pub fn response(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<Self>) {
        (status, Json(Self::new(message)))
    }
}
