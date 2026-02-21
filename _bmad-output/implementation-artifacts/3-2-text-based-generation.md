# Story 3.2: Text-Based Flashcard Generation

Status: in-progress

## Story

As a Student or Teacher,
I want to paste a block of text (like a lecture transcript) and have the AI extract key terms,
So that I don't have to manually pull out facts and definitions (FR6).

## Acceptance Criteria

1. **Given** a user on the "Generate with AI" screen
   **When** they paste text and click "Generate"
   **Then** the text is sent to the Rust AI Gateway with a strict JSON-schema system prompt
2. **Given** the response is streaming back
   **Then** the UI displays an animated skeleton-loading state
   **And** the parsed term/definition pairs appear sequentially as they are generated.

## Tasks / Subtasks

- [x] Frontend Generation Route
  - [x] Create `src/app/generate/page.tsx` for the "Generate with AI" screen.
  - [x] Add a text area for pasting transcripts and a "Generate" submit button.
- [x] SSE Stream Consumption
  - [x] Integrate `@microsoft/fetch-event-source`.
  - [x] Connect to `http://localhost:8000/api/ai/generate` sending the `Authorization: Bearer <token>` header.
- [x] UI State Management
  - [x] Create a local state to accumulate the JSON string stream.
  - [x] Render skeleton loaders while waiting for chunks.
  - [x] Pass the accumulated JSON array to a preview component (or render directly on the page) as it is parsed.

## Dev Notes
- Since the AI stream chunks will be raw JSON tokens, the frontend will need to safely accumulate and parse them as they arrive.
- The UI should feel very responsive. As complete JSON objects (term/definition pairs) are parsed from the stream buffer, they should immediately appear on screen.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.2: Text-Based Flashcard Generation]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)
### Debug Log References
- Extracted and safely corrected NextAuth interface typing by replacing hardcoded `accessToken` references mapped incorrectly with our explicit `id_token` payload containing the Rust JWT. 
### Completion Notes List
- Bound UI directly to `fetch-event-source` mapping intermediate token logic to trigger aggressive UI renders on Array mapping.
### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/3-2-text-based-generation.md
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/(dashboard)/dashboard/student/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/(dashboard)/dashboard/teacher/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/(dashboard)/dashboard/generate/page.tsx
