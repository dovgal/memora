# Story 2.5: Offline Progress Synchronization

Status: done

## Story

As an Offline Learner,
I want to complete study sessions without internet and have my progress saved,
So that my mastery data isn't lost when my connection drops (FR11).

## Acceptance Criteria

1. **Given** a user studying in offline mode
   **When** they complete a "Flashcards", "Learn", or "Test" session
   **Then** the mutation is recorded in a local offline queue
2. **Given** the Next.js PWA has locally queued mutations
   **When** the device regains network connectivity
   **Then** the Service Worker automatically syncs all queued progress mutations to the Rust backend.

## Tasks / Subtasks

- [x] Background Sync Configuration (memora-web)
  - [x] Import `BackgroundSyncPlugin` and `NetworkOnly` from `serwist` in the Service Worker (`src/app/sw.ts`).
  - [x] Instantiate the Background Sync plugin with a 24-hour retention policy.
  - [x] Add a `runtimeCaching` rule to intercept `POST` requests to `/api/study/progress`.
  - [x] Assign the `NetworkOnly` handler with the Background Sync plugin to this rule.
- [x] UI Resilience (memora-web)
  - [x] Update study modes (`Flashcards`, `Learn`, `Test`) to gracefully handle failed `fetch` requests during submission.
  - [x] Ensure the component doesn't crash throwing uncaught promise rejections when offline (Serwist BackgroundSync handles the retry, but the initial fetch might return a 502/Failed to fetch locally or Serwist handles it transparently). _Note: Serwist BackgroundSync intercepts the request, let's ensure the UI treats a queued request as a "success" or handles the offline error silently._
- [x] Verification
  - [x] Compile the application (`npm run build`).
  - [x] Simulate going offline in the browser, submitting a study session, and observing the IndexedDB queue (`workbox-background-sync`).
  - [x] Reconnect to the network and ensure the queued request is dispatched to the backend.

## Dev Notes
- For Next.js/Serwist, `BackgroundSyncPlugin` is the canonical way to handle queued mutations without completely rewriting the app to use TanStack Query's offline mutation queue. This satisfies the user's core intent (offline resilience) with much less overhead, leveraging our existing Serwist setup.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.5: Offline Progress Synchronization]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)

### Debug Log References
- Next 16 Build passed indicating Serwist global typings imported correctly.

### Completion Notes List
- Injected `BackgroundSyncPlugin('study-progress-queue')` into `sw.ts` mapping to POST requests against `/api/study/progress`.
- Updated `flashcards`, `learn`, and `test` study mode submit functions to swallow standard `fetch` exceptions securely if `navigator.onLine === false`.
- Fully linked `test` scores to the database.

### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/2-5-offline-progress-synchronization.md
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/flashcards/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/learn/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/test/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/sw.ts
