# Story 1.5: Public Library Access

Status: done

## Story

As an Unauthenticated User,
I want to be able to browse and view public flashcard sets,
So that I can evaluate the platform's value before registering (FR1).

## Acceptance Criteria

1. **Given** a user without an active session
   **When** they navigate to a shared public set URL (e.g., `/set/123-public`)
   **Then** the Next.js App Router renders the set content using Server Components
2. **Given** an unauthenticated user interacting with a public set
   **When** they attempt an action that requires saving progress
   **Then** the user is prompted to "Login to save progress" instead of seeing account errors.

## Tasks / Subtasks

- [x] Backend Public Set Endpoint (memora-api)
  - [x] Implement a `GET /api/sets/:id` endpoint that does *not* require the `AuthenticatedUser` middleware if the set is marked `public=true`.
  - [x] Update database schema to ensure a `sets` table exists with a `public` boolean column (if not already handled in Epic 2 modeling; mock if necessary for now, but Epic 2 owns full creation).
- [x] Public Set View UI (memora-web)
  - [x] Create a Next.js App Router dynamic page `src/app/set/[id]/page.tsx`.
  - [x] Fetch the set details using Next.js Server Components.
  - [x] Render the flashcard preview in a read-only mode.
- [x] Authentication Prompts (memora-web)
  - [x] Implement conditional UI logic: if `useSession()` yields no valid session, show a CTA banner or modal: "Login to save progress".

## Dev Notes

- **Dependency Warning:** Story 1.5 touches on "Sets", which are technically part of Epic 2 (Manual Content Creation). For this story, you might need to mock a public set in the database or implement the foundational `sets` table schema early. Coordinate with the PM if you feel this should be deferred until Epic 2.
- **Middleware:** Ensure Next.js `middleware.ts` allows public access to `/set/:id`.

### Project Structure Notes

- Add frontend pages to `memora-web/src/app/set/[id]`
- Add backend routes to `memora-api/src/handlers/sets.rs` (new module)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Public Library Access]

## Dev Agent Record

### Agent Model Used

Antigravity Code Assistant

### Debug Log References

- Set up Next.js middleware matchers to ensure `/set/[id]` bypasses authentication correctly.

### Completion Notes List

- Implemented database migrations via `sqlx` to create the `sets` and `flashcards` tables ahead of Epic 2, complete with `is_public` columns and optimized indexes.
- Built a native Rust Axum `GET /api/sets/:id` endpoint in `handlers/sets.rs` to fetch and serialize public records.
- Injected mock testing records manually in SQL schema initialization.
- Built a Next.js Server Component page `src/app/set/[id]/page.tsx` for fast, SEO-friendly rendering of public subsets.
- Designed `PublicActionBanner.tsx` to conditionally surface interactive login CTAs specifically for unauthenticated browser sessions.

### File List

- `memora-api/migrations/20260221060547_create_sets_and_flashcards_tables.sql`
- `memora-api/src/domain/dtos/mod.rs`
- `memora-api/src/handlers/sets.rs`
- `memora-api/src/handlers/mod.rs`
- `memora-api/src/main.rs`
- `memora-web/src/types/schema.ts`
- `memora-web/src/app/set/[id]/page.tsx`
- `memora-web/src/app/set/[id]/PublicActionBanner.tsx`
