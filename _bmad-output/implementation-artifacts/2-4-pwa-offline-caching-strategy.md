# Story 2.4: PWA Offline Caching Strategy

Status: done

## Story

As a Mobile User,
I want my recently viewed study sets to be available without an internet connection,
So that I can study during a commute or in areas with poor reception (FR10).

## Acceptance Criteria

1. **Given** the Next.js PWA is installed on a user's device
   **When** they view a study set while online
   **Then** the Service Worker caches the JSON payload and associated images via IndexedDB/Cache API
2. **Given** the Next.js PWA is installed on a user's device
   **When** they switch to offline mode
   **Then** the user can fully load and view the previously cached set.

## Tasks / Subtasks

- [x] PWA Configuration (memora-web)
  - [x] Add `next-pwa` or Serwist to the Next.js project.
  - [x] Configure `manifest.json` and meta tags for installability.
- [x] Service Worker Implementation (memora-web)
  - [x] Setup runtime caching strategies (e.g., StaleWhileRevalidate) for API routes like `/api/sets/:id`.
  - [x] Setup caching for static assets (fonts, icons, JS bundles).
- [x] Offline Indicator UI (memora-web)
  - [x] Add a global listener for the `offline` and `online` window events.
  - [x] Display a small non-intrusive toast or banner when the user is operating offline.

## Dev Notes

- **Caching Strategy:** We want to cache the API responses for the sets the user actually visits. A Cache-First or Stale-While-Revalidate strategy on `/api/sets/*` and `/api/user/*` is ideal.
- **Library Choice:** `next-pwa` is a popular choice for Next.js 13/14, but Serwist is the modern, actively maintained successor that works well with Next.js 15 App Router. I will evaluate which one provides the most stable integration.
- **Testing Offline:** This is notoriously tricky to test in dev mode. Verify production builds (`npm run build && npm start`) and use the Chrome Network tab's "Offline" toggle to test.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.4: PWA Offline Caching Strategy]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)

### Debug Log References
- Addressed multiple Next.js 15 App Router typings (`Promise<{ id: string }>`) inside `learn`, `test`, and `flashcard` components to comply with runtime async rules.
- Suppressed the Next 16 Turbopack build flag since Serwist webpack injections trigger verification issues.

### Completion Notes List
- Successfully swapped unmaintained `next-pwa` module targets for the newer `@serwist/next` API.
- Implemented `NetworkFirst` class instances to wrap `/api/sets/*` and `/api/user/*`.
- Built the `OfflineBanner.tsx` ambient overlay bound to `window.addEventListener('offline')` injecting it globally inside `RootLayout`.

### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/2-4-pwa-offline-caching-strategy.md
- /Users/dovgal/Project/my-bmad-project/memora-web/next.config.ts
- /Users/dovgal/Project/my-bmad-project/memora-web/package.json
- /Users/dovgal/Project/my-bmad-project/memora-web/public/manifest.json
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/layout.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/flashcards/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/learn/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/test/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/sw.ts
- /Users/dovgal/Project/my-bmad-project/memora-web/src/components/OfflineBanner.tsx
