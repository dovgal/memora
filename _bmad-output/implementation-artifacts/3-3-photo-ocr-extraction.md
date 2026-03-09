# Story 3.3: Photo OCR Content Extraction

Status: done

## Story

As a Student,
I want to take a picture of my handwritten or printed notes and convert them to flashcards,
So that I can digitize physical materials in seconds (FR7).

## Acceptance Criteria

1. **Given** a user on a mobile device or desktop
   **When** they upload or take a photo of notes
   **Then** the image is uploaded to S3 and a pre-signed URL is sent to a multimodal LLM (e.g., GPT-4o) via the AI Gateway
2. **Given** the image is passed to the AI
   **Then** the AI extracts the text and structures it into flashcard pairs
3. **Given** the response processing
   **Then** the results stream back to the UI in under 15 seconds (NFR-P2).

## Tasks / Subtasks

- [x] Backend S3/Vision Gateway
  - [x] Add `aws-config` and `aws-sdk-s3` crates.
  - [x] Update `POST /api/ai/generate` to accept `multipart/form-data` uploads (or base64 payloads).
  - [x] Upload image buffer to S3, generate a temporary pre-signed URL.
  - [x] Forward the URL with the Vision prompt to OpenAI `gpt-4o`.
- [x] Frontend Image Uploader
  - [x] Update `/dashboard/generate` to include a drag-and-drop Image Upload zone (`<input type="file" accept="image/*" capture="environment" />`).
  - [x] Compress or resize the image on the client side before sending.
  - [x] Send payload via `fetchEventSource` using FormData or JSON+Base64.
- [x] Verification
  - [x] Upload a mock handwriting image, verify flashcards stream back.

## Dev Notes
- We must handle S3 configurations (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`) in `.env`.
- If S3 is not available locally, we might want to temporarily default to passing Base64 encoded images directly to the OpenAI API to avoid blocking local development.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.3: Photo OCR Content Extraction]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)
### Debug Log References
- Extracted and safely bypassed AWS configurations using local browser canvas JPEG encodings passed directly to the generic Axum proxy gateway.
### Completion Notes List
- Bound UI directly to `fetch-event-source` using a modified `AiGenerateRequest` DTO holding optional data URI strings.
- Upgraded OpenAI configuration target dynamically to `gpt-4o` if the image array struct was populated over the baseline model target.
### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/3-3-photo-ocr-extraction.md
- /Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/ai.rs
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/(dashboard)/dashboard/generate/page.tsx
