# Story 3.1: AI Gateway & SSE Streaming Infrastructure

Status: done

## Story

As a Backend Developer,
I want to establish a secure, rate-limited AI Gateway using Server-Sent Events (SSE),
So that I can stream completions from OpenAI/Anthropic to the Next.js client without risking API key exposure or timeouts.

## Acceptance Criteria

1. **Given** an authenticated user requesting AI generation
   **When** the Next.js client opens an SSE connection to the Rust backend
   **Then** the backend proxies the request to the LLM provider
2. **Given** the provider responds via stream
   **Then** the backend streams the JSON chunks back to the client as they arrive (NFR-P2)
3. **Given** a user making repeated requests
   **Then** the backend enforces strict rate-limits (e.g., max 5 requests per minute per user).

## Tasks / Subtasks

- [x] Rust Backend Setup
  - [x] Add `reqwest` and `async-stream` crates.
  - [x] Set up `OPENAI_API_KEY` (or equivalent) in `.env` and `config.rs`.
- [x] Backend Rate Limiting
  - [x] Implement an in-memory rate-limiter (e.g. `dashmap` or `governor` crate) mapping `user_id` to token buckets.
  - [x] Add rate-limit validation to the AI handler.
- [x] Backend SSE Handler
  - [x] Create `POST /ai/generate` pointing to a new AI handler.
  - [x] Accept a JSON body with the prompt/context.
  - [x] Proxy request to OpenAI API using `reqwest` streaming.
  - [x] Parse provider stream and yield `axum::response::sse::Event` back to the client.
  - [x] Wire up the router to use the authentication middleware.
- [x] Next.js Client Proxy (Optional but recommended for strict CORS / Auth header propagation if EventSource doesn't support headers)
  - [x] Expose `POST /api/ai/generate` Next.js proxy route to relay the stream from Rust to the frontend using the HTTP/2 stream API, OR use `@microsoft/fetch-event-source` on the frontend directly to the Rust backend to send Bearer tokens.

## Dev Notes
- For Next.js to communicate with SSE endpoints requiring JWT Authorization headers, standard browser `EventSource` is insufficient because it does not support custom headers. We should use the `@microsoft/fetch-event-source` package in the frontend, which wraps `fetch` and supports headers, allowing direct streaming from the Rust API while preserving JWT auth.
- Rate limiting can be achieved via `governor` crate in Rust for a robust token-bucket algorithm per `user_id`.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.1: AI Gateway & SSE Streaming Infrastructure]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)
### Debug Log References
- Handled the tricky typing boundaries inside `async_stream` yielding required `Ok::<_, Infallible>` responses explicitly bounding to `bytes::Bytes` buffer maps instead.
### Completion Notes List
- Successfully mapped HTTP endpoint into `async_stream` returning generic JSON delta mappings mimicking standard completion proxies.
- Handled CORS binding implicitly allowing the `@microsoft/fetch-event-source` implementation native access into Rust without Next.js proxy rewrites.
### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/3-1-ai-gateway-sse-infrastructure.md
- /Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/ai.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/mod.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/main.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/middleware/mod.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/middleware/rate_limiter.rs
