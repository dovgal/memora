use axum::{
    extract::{State, Json},
    http::StatusCode,
    response::{sse::{Event, Sse}},
};
use futures::stream::Stream;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::{convert::Infallible, env, sync::Arc};
use std::time::Duration;
use governor::{Quota, RateLimiter};
use std::num::NonZeroU32;

use crate::middleware::{auth::AuthenticatedUser, rate_limiter::AppRateLimiter};

#[derive(Deserialize)]
pub struct AiGenerateRequest {
    pub prompt: String,
    // Add other fields as needed, e.g., image_url for multimodal
}

#[derive(Serialize)]
pub struct AiGatewayError {
    pub error: String,
}

// Structs mapping to OpenAPI's expected req/res for typical completions
#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    stream: bool,
}

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize, Debug)]
struct OpenAiStreamChunk {
    choices: Vec<OpenAiChoice>,
}

#[derive(Deserialize, Debug)]
struct OpenAiChoice {
    delta: OpenAiDelta,
    finish_reason: Option<String>,
}

#[derive(Deserialize, Debug)]
struct OpenAiDelta {
    content: Option<String>,
}

pub async fn generate_flashcards_stream(
    State(rate_limiter): State<AppRateLimiter>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(payload): Json<AiGenerateRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, (StatusCode, Json<AiGatewayError>)> {
    
    // 1. Enforce Rate Limits
    let user_uuid = match uuid::Uuid::parse_str(&user.sub) {
        Ok(uid) => uid,
        Err(_) => return Err((StatusCode::UNAUTHORIZED, Json(AiGatewayError { error: "Invalid User UUID".to_string() })))
    };

    // Grab or initialize the user's rate limiter bucket (5 tokens per minute)
    let user_limiter = rate_limiter.entry(user_uuid).or_insert_with(|| {
        Arc::new(RateLimiter::direct(Quota::per_minute(NonZeroU32::new(5).unwrap())))
    });

    if user_limiter.check().is_err() {
        return Err((
            StatusCode::TOO_MANY_REQUESTS, 
            Json(AiGatewayError { error: "Rate limit exceeded. Try again in a minute.".to_string() })
        ));
    }

    // 2. Fetch API Key
    let api_key = match env::var("OPENAI_API_KEY") {
        Ok(k) => k,
        Err(_) => return Err((StatusCode::INTERNAL_SERVER_ERROR, Json(AiGatewayError { error: "OpenAI API Key not configured".to_string() })))
    };

    // 3. Construct Request to OpenAI
    let client = Client::new();
    let openai_body = OpenAiRequest {
        model: "gpt-4o-mini".to_string(), // Or gpt-4o for multimodal
        messages: vec![
            OpenAiMessage {
                role: "system".to_string(),
                content: "You are Memora's core flashcard generation engine. Output ONLY raw JSON. You must extract key knowledge from the provided text into a JSON array of objects, where each object has a 'term' string and a 'definition' string. Do not include markdown blocks like ```json.".to_string(),
            },
            OpenAiMessage {
                role: "user".to_string(),
                content: payload.prompt,
            }
        ],
        stream: true,
    };

    let response = match client.post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&openai_body)
        .send()
        .await 
    {
        Ok(res) => res,
        Err(e) => return Err((StatusCode::BAD_GATEWAY, Json(AiGatewayError { error: format!("Upstream AI Provider Error: {}", e) })))
    };

    if !response.status().is_success() {
        return Err((StatusCode::BAD_GATEWAY, Json(AiGatewayError { error: format!("OpenAI rejected request: {}", response.status()) })));
    }

    // 4. Map the upstream chunk stream to Axum SSE Events
    let mut byte_stream = response.bytes_stream();

    let stream = async_stream::stream! {
        while let Some(chunk_result) = futures::StreamExt::next(&mut byte_stream).await {
            let result: Result<bytes::Bytes, reqwest::Error> = chunk_result;
            match result {
                Ok(b) => {
                    // OpenAI stream chunks look like "data: {...}\n\n"
                    let chunk_str = String::from_utf8_lossy(&b);
                    let lines: Vec<&str> = chunk_str.split('\n').collect();

                    for line in lines {
                        if line.starts_with("data: ") {
                            let json_str = &line[6..];
                            
                            if json_str.trim() == "[DONE]" {
                                yield Ok::<_, Infallible>(Event::default().event("done").data("[DONE]"));
                                break;
                            }

                            // Try to extract just the token delta to stream it cleanly to Next.js
                            if let Ok(parsed) = serde_json::from_str::<OpenAiStreamChunk>(json_str) {
                                if let Some(choice) = parsed.choices.first() {
                                    if let Some(content) = &choice.delta.content {
                                        yield Ok::<_, Infallible>(Event::default().data(content.clone()));
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Error reading from stream: {}", e);
                    yield Ok::<_, Infallible>(Event::default().event("error").data("Stream connection dropped"));
                    break;
                }
            }
        }
    };

    Ok(Sse::new(stream).keep_alive(axum::response::sse::KeepAlive::new().interval(Duration::from_secs(15)).text("keep-alive")))
}
