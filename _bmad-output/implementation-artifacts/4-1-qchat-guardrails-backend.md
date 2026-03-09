# Story 4.1: Q-Chat Guardrails & Context Injection (Backend)

Status: done

## Story

As a Backend Developer,
I want to build a middleware layer that injects the current flashcard set into the LLM prompt and enforces safety guardrails,
So that the AI acts strictly as an educational tutor and cannot be hijacked (NFR-SEC3).

## Acceptance Criteria

1. **Given** a chat message from the Next.js client
   **When** the Rust backend receives the request
   **Then** it fetches the referenced study set from PostgreSQL and appends it to the system prompt (Context Injection)
2. **Given** the user's prompt
   **Then** it runs a lightweight validation (or uses a dedicated moderation model) to block NSFW or prompt injection attempts
3. **Given** a safe, contextualized prompt
   **Then** it is forwarded to the LLM via the SSE Gateway.

## Tasks / Subtasks

- [x] Route Setup
  - [x] Create `POST /api/ai/qchat/:set_id` endpoint in Axum.
  - [x] Define the request payload to accept an array of previous messages for conversation history.
- [x] Context Injection
  - [x] Query the database for the `set_id` to retrieve all flashcards.
  - [x] Format the flashcards into a string and inject it into the `system` role prompt of the OpenAI request.
- [x] Guardrails
  - [x] Implement a lightweight check (e.g., using OpenAI's moderation endpoint or strict system prompt instructions) to refuse answering off-topic or inappropriate questions.
- [x] Verification
  - [x] Test the endpoint with a valid question about the set.
  - [x] Test the endpoint with an off-topic question to verify guardrails.

## Dev Notes
- We can reuse the existing `async_stream` pattern from `/api/ai/generate` to stream the Q-Chat response back via SSE.
- We need to handle Conversation History, so the payload from the frontend should be `Vec<OpenAiMessage>` instead of a single `prompt` string.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.1: Q-Chat Guardrails & Context Injection (Backend)]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)
### Debug Log References
- Addressed `Axum` path capturing bug where `:set_id` was strictly upgraded to `{set_id}` matching `tower_router` backwards compatibility parameters.
### Completion Notes List
- Injected `QChatRequest` and `ChatMessage` DTO structures into `src/domain/dtos/mod.rs` enforcing seamless Typescript integration mapping.
- Intercepted contextual SQL parameters formatting them dynamically into strict SSE Guardrails isolating `gpt-4o-mini` from off-topic injection logic cleanly.
### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/4-1-qchat-guardrails-backend.md
- /Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/ai.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/main.rs
