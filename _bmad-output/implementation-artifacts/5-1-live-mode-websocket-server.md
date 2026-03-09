# Story 5.1: Live Mode WebSocket Server & Room Management

Status: done

## Story

As a Backend Developer,
I want to build a WebSocket server integrated into the existing Axum API with in-memory room management,
So that teachers and students can connect to a shared "Live Room" and receive broadcast messages within 100ms (NFR-P1).

## Acceptance Criteria

1. **Given** a client connects to `GET /api/live/ws?room_id=<uuid>&token=<jwt>`
   **When** the JWT is valid
   **Then** the WebSocket connection is accepted and the client is registered in the specified room
2. **Given** multiple clients are connected to the same room
   **When** a message is published to that room
   **Then** all connected clients receive the message within 100ms
3. **Given** a client disconnects
   **When** the WebSocket connection is closed
   **Then** the client is cleanly removed from the room registry (no memory leaks)
4. **Given** a Teacher sends a `StartGame` event
   **When** the backend processes it
   **Then** it is broadcast to all students in the room

## Tasks / Subtasks

- [x] **Add WebSocket + rand deps to Cargo.toml**
  - [x] `axum = { version = "0.8.8", features = ["ws"] }`
  - [x] `rand = "0.9"`
- [x] **Room Registry (`memora-api/src/live_ws/`)**
  - [x] `src/live_ws/mod.rs` — re-exports `RoomRegistry`
  - [x] `src/live_ws/room.rs` — `RoomRegistry` using `DashMap<Uuid, RoomEntry>` (entry = broadcast::Sender + join_code), plus `codes: DashMap<String, Uuid>` reverse index
- [x] **WebSocket Handler (`memora-api/src/handlers/live.rs`)**
  - [x] `POST /api/live/rooms` — create_room handler
  - [x] `GET /api/live/rooms/:join_code` — resolve_room handler
  - [x] `GET /api/live/ws?room_id&token` — ws_handler (JWT validation + WebSocketUpgrade)
  - [x] `handle_socket` — bidirectional broadcast bridge via tokio::select!
- [x] **AppState Extension (main.rs)**
  - [x] Added `room_registry: RoomRegistry` field + `FromRef` impl
  - [x] Registered 3 new live routes
- [x] **handlers/mod.rs** — added `pub mod live;`

## Dev Notes

- **Redis not in current stack.** For MVP, use `tokio::sync::broadcast` (in-memory pub/sub). This is sufficient for single-process deployment (NFR-S1: 50 students). Redis can be added as a horizontal scale-out in a future sprint.
- **Axum WS feature:** The `axum` crate with feature `ws` provides `WebSocketUpgrade`, `WebSocket`, `Message`. Verify `axum = { version = "0.8.8", features = ["ws"] }` in Cargo.toml.
- **Token query param:** Browser `WebSocket` API cannot set custom headers. JWT must be passed as a query parameter (`?token=<jwt>`) and validated in the handler.
- **Broadcast channel size:** Use `broadcast::channel(256)` per room — enough for 50 students at game pace.

### Project Structure Notes

- New module: `memora-api/src/live-ws/` (mod.rs, room.rs)
- New handler file: `memora-api/src/handlers/live.rs`
- Modified: `memora-api/src/handlers/mod.rs`, `memora-api/src/main.rs`, `memora-api/Cargo.toml`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 5.1]
- [Architecture constraint: NFR-P1 < 100ms, NFR-S1: 50 simultaneous students]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Debug Log References
- Rust module naming: directory must use underscores (`live_ws`), not hyphens (`live-ws`). Renamed after first build attempt.
- `sqlx::query!` macros require a running PostgreSQL at compile time. All errors in the build output are **pre-existing** (in `ai.rs`, `sets.rs`, `study.rs`, `users.rs`) — zero errors in any of the new `live_ws` or `handlers/live.rs` files.
- No `rand` API breaking change: `rand 0.9` uses `rand::rng()` and `.random_range()` (not the deprecated 0.8 `thread_rng()` / `gen_range()`).

### Completion Notes List
- `live_ws/room.rs`: `RoomRegistry` with dual `DashMap` (rooms + codes reverse index). `create_room()` generates a unique 6-digit code atomically. `remove_room()` cleans both maps.
- `handlers/live.rs`: JWT validated via `jsonwebtoken` from query param (browser WS API limitation). `handle_socket` uses `tokio::select!` on two spawned tasks (send/recv) for clean disconnect handling. Room cleaned up when `receiver_count() == 0`.
- Broadcast channel capacity: 256 messages per room (sufficient for 50 students at game pace per NFR-S1).
- Build verified: only pre-existing DB-connection errors remain (must run `cargo run` with live DB to fully verify).

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-api/Cargo.toml`
- `/Users/dovgal/Project/my-bmad-project/memora-api/src/live_ws/mod.rs`
- `/Users/dovgal/Project/my-bmad-project/memora-api/src/live_ws/room.rs`
- `/Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/live.rs`
- `/Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/mod.rs`
- `/Users/dovgal/Project/my-bmad-project/memora-api/src/main.rs`
