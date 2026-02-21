# Story 2.2: "Flashcards" Study Mode & Progress Tracking

Status: done

## Story

As a Learner,
I want to flip through cards and mark them as known or unknown,
So that I can quickly review material and track my mastery.

## Acceptance Criteria

1. **Given** a user viewing a study set
   **When** they enter "Flashcards" mode and swipe/click through the cards
   **Then** their known/unknown status for each card is recorded (FR18)
2. **Given** a user progressing through a flashcard session
   **When** they finish the set or exit
   **Then** the progress is persisted to the backend upon completion.
3. **Given** an authenticated user viewing a set they have studied
   **When** the set overview page loads
   **Then** the UI displays their individual mastery percentage for the current set.

## Tasks / Subtasks

- [x] Progress Database Schema (memora-api)
  - [x] Create a SQLx migration for `study_sessions` and `flashcard_progress` tables to track which cards a user knows.
- [x] Progress Tracking Endpoints (memora-api)
  - [x] Implement `POST /api/study/progress` to save the results of a study session (batch update of known/unknown cards).
  - [x] Implement `GET /api/sets/:id/progress` to fetch mastery statistics for the authenticated user.
- [x] Flashcards Study UI (memora-web)
  - [x] Build a new Next.js page `src/app/set/[id]/flashcards/page.tsx` dedicated to the study experience.
  - [x] Implement a full-screen or focused UI with a flippable 3D card component.
  - [x] Add controls/buttons for "Still Learning" (Unknown) and "Know" (Known).
  - [x] Manage local session state (current card index, accumulated scores) and submit to the backend on completion.
- [x] Mastery Visualization (memora-web)
  - [x] Update the set overview page `src/app/set/[id]/page.tsx` to visually display the progress ring or mastery percentage if the user is authenticated and has studied the set.

## Dev Notes

- **Data Model:** Consider how you want to track progress. A simple approach is a `user_id`, `flashcard_id`, `status` (known/learning), and `last_reviewed_at`.
- **Animations:** A core part of the "Flashcards" mode is the physical feel of flipping the card. Consider using CSS 3D transforms (`rotateY`) and Framer Motion or standard CSS transitions.
- **Batching:** When the user finishes studying 20 cards, send ONE API request to submit the 20 progress records, rather than 20 individual requests.

### Project Structure Notes

- Add frontend pages to `memora-web/src/app/set/[id]/flashcards/page.tsx`
- Add backend routes to `memora-api/src/handlers/study.rs` (new module)
- Add migrations to `memora-api/migrations`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.2: "Flashcards" Study Mode & Progress Tracking]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)

### Debug Log References
- `walkthrough.md` generated with full details on the React 3D animations and atomic SQL UPSERT architecture.
- Abstracted generic NextAuth router implementation into `lib/auth.ts` to satisfy Next.js 15 Server Component typing restrictions.

### Completion Notes List
- Successfully applied SQL migration for `flashcard_progress` utilizing `ON CONFLICT` strategy for user mastery updates.
- Refactored `authOptions` out of the Next.js edge route to ensure stable Webpack extraction for `SetPage`.
- Corrected Next.js 15 route typing where `params` is now strictly `Promise<{id: string}>`.

### File List
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/2-2-flashcards-study-mode-and-progress-tracking.md
- /Users/dovgal/Project/my-bmad-project/memora-api/migrations/20260221165852_create_progress_tables.sql
- /Users/dovgal/Project/my-bmad-project/memora-api/src/domain/dtos/mod.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/mod.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/handlers/study.rs
- /Users/dovgal/Project/my-bmad-project/memora-api/src/main.rs
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/api/auth/[...nextauth]/route.ts
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/api/sets/[id]/progress/route.ts
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/api/study/progress/route.ts
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/flashcards/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/lib/auth.ts
- /Users/dovgal/Project/my-bmad-project/memora-web/src/types/schema.ts
