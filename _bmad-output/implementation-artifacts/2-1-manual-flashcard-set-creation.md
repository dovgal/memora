# Story 2.1: Manual Flashcard Set Creation

Status: done

## Story

As a Student or Teacher,
I want to manually create a new study set with text and image flashcards,
So that I can digitize my specific learning materials.

## Acceptance Criteria

1. **Given** an authenticated user on the dashboard
   **When** they click "Create Set" and fill out the term/definition pairs
   **Then** the set and its cards are saved to the PostgreSQL database
2. **Given** a user creating a flashcard
   **When** they choose to upload an image for the term or definition
   **Then** the image is securely stored in the configured object storage (or local mock for now) and linked to the card
3. **Given** a user successfully creating a set
   **When** the save operation completes
   **Then** the user is redirected to the created set's overview page.

## Tasks / Subtasks

- [x] Create Set Form UI (memora-web)
  - [x] Build a `CreateSetForm` in `src/app/(dashboard)/create/page.tsx`.
  - [x] Implement a dynamic form array (React Hook Form + Zod) allowing users to add/remove flashcard rows (Term & Definition).
  - [x] Include title and description inputs for the overall Set.
- [x] Backend Create Endpoint (memora-api)
  - [x] Implement `POST /api/sets` to receive the complete Set + Flashcards payload.
  - [x] Ensure the endpoint is protected by `AuthenticatedUser`.
  - [x] Use a database transaction to insert the Set and all Flashcards atomically.
- [x] Set Overview Routing (memora-web)
  - [x] Update `src/app/set/[id]/page.tsx` (created in Story 1.5) to handle authenticated viewing, or create a distinct authenticated wrapper if necessary.
  - [x] Ensure upon successful creation, the frontend routes the user to `Router.push('/set/[new_id]')`.

## Dev Notes

- **Database:** Ensure you utilize the `sets` and `flashcards` tables that were initialized in Epic 1 Story 1.5. You will now be INSERTING into them. The `creator_id` MUST be extracted safely from the JWT via the Rust `AuthenticatedUser` extractor.
- **Transactions:** When saving a set with 50 cards, do not do 50 individual inserts without a transaction. Use PostgreSQL transactions (`pool.begin()`) in Rust to ensure data consistency.
- **Images:** Image upload is listed in AC2, but can be complex. Consider mocking the image URL upload initially or handling it directly as a base64 string if time is strictly constrained, before building a full S3 presigned-URL flow.

### Project Structure Notes

- Add frontend pages to `memora-web/src/app/(dashboard)/create/page.tsx`
- Add backend routes to `memora-api/src/handlers/sets.rs` (update existing module)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Manual Flashcard Set Creation]

## Dev Agent Record

### Agent Model Used

Antigravity Code Assistant

### Debug Log References

- Fixed Next.js build issues resolving TypeScript mismatches between `zod` defaults and `react-hook-form` Types. 
- Integrated `NextRequest` correctly for `next-auth` JWT proxy extraction.

### Completion Notes List

- Added `CreateSetRequest` and `CreateFlashcardRequest` schema DTOs to the Rust Backend and sync'd to Next.js types.
- Implemented `POST /api/sets` using `sqlx::Transaction` to ensure the parent Set and arbitrarily sized array of Flashcards are committed atomically.
- Created `src/app/(dashboard)/create/page.tsx`, a robust Next.js frontend client UI relying on `useFieldArray` to allow users to dynamically append and delete flashcards from the submission payload before saving.
- Set up a Next.js Proxy API Route `src/app/api/sets/route.ts` to seamlessly forward the JSON payload to the Rust API while appending the user's secure NextAuth `id_token`.

### File List

- `memora-api/src/domain/dtos/mod.rs`
- `memora-api/src/handlers/sets.rs`
- `memora-api/src/main.rs`
- `memora-web/src/types/schema.ts`
- `memora-web/src/app/api/sets/route.ts`
- `memora-web/src/app/(dashboard)/create/page.tsx`
