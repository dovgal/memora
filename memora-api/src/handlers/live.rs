use crate::live_ws::RoomRegistry;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Query, State,
    },
    http::StatusCode,
    response::{IntoResponse, Json},
};
use futures::{sink::SinkExt, stream::StreamExt};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use uuid::Uuid;

// ─── DTOs ────────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct CreateRoomResponse {
    #[serde(rename = "roomId")]
    pub room_id: Uuid,
    #[serde(rename = "joinCode")]
    pub join_code: String,
}

#[derive(Serialize)]
pub struct ResolveRoomResponse {
    #[serde(rename = "roomId")]
    pub room_id: Uuid,
}

#[derive(Deserialize)]
pub struct WsQuery {
    pub room_id: Uuid,
    pub token: String,
}

#[derive(Deserialize)]
pub struct JoinCodePath {
    pub join_code: String,
}

/// Minimal JWT claims — we only need to confirm the token is valid & get user_id.
#[derive(Deserialize)]
struct Claims {
    sub: String,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn validate_token(token: &str) -> Option<String> {
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev_secret".to_string());
    let key = DecodingKey::from_secret(secret.as_bytes());
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = false; // flex for dev; tighten in prod

    decode::<Claims>(token, &key, &validation)
        .ok()
        .map(|data| data.claims.sub)
}

// ─── Handlers ────────────────────────────────────────────────────────────────

/// POST /api/live/rooms — create a new live room, return room_id + 6-digit join code.
pub async fn create_room(
    State(registry): State<RoomRegistry>,
) -> impl IntoResponse {
    let (room_id, join_code, _sender) = registry.create_room();
    Json(CreateRoomResponse { room_id, join_code })
}

/// GET /api/live/rooms/:join_code — resolve a join code to a room_id.
pub async fn resolve_room(
    State(registry): State<RoomRegistry>,
    axum::extract::Path(JoinCodePath { join_code }): axum::extract::Path<JoinCodePath>,
) -> impl IntoResponse {
    match registry.resolve_join_code(&join_code) {
        Some(room_id) => Ok(Json(ResolveRoomResponse { room_id })),
        None => Err((StatusCode::NOT_FOUND, "Room not found")),
    }
}

/// GET /api/live/ws?room_id=<uuid>&token=<jwt> — WebSocket upgrade endpoint.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Query(params): Query<WsQuery>,
    State(registry): State<RoomRegistry>,
) -> impl IntoResponse {
    // Validate JWT before upgrading
    if validate_token(&params.token).is_none() {
        return (StatusCode::UNAUTHORIZED, "Invalid token").into_response();
    }

    let sender = match registry.get_sender(&params.room_id) {
        Some(s) => s,
        None => {
            return (StatusCode::NOT_FOUND, "Room not found").into_response();
        }
    };

    let room_id = params.room_id;
    ws.on_upgrade(move |socket| handle_socket(socket, sender, registry, room_id))
}

/// Bidirectional WebSocket bridge: forward incoming WS messages to the room broadcast,
/// and forward incoming broadcast messages to this WS client.
async fn handle_socket(
    socket: WebSocket,
    sender: tokio::sync::broadcast::Sender<String>,
    registry: RoomRegistry,
    room_id: Uuid,
) {
    let mut receiver = sender.subscribe();
    let (mut ws_tx, mut ws_rx) = socket.split();

    // Task 1: broadcast → WS client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = receiver.recv().await {
            if ws_tx.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Task 2: WS client → broadcast
    let sender_clone = sender.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = ws_rx.next().await {
            if let Message::Text(text) = msg {
                // broadcast to all room members (including sender — clients can filter)
                let _ = sender_clone.send(text.to_string());
            }
        }
    });

    // Wait for either task to finish (client disconnect or error)
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }

    // Clean up room if no subscribers remain
    if sender.receiver_count() == 0 {
        registry.remove_room(&room_id);
    }
}
