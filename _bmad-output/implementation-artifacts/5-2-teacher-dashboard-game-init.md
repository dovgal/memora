# Story 5.2: Teacher Dashboard & Game Initialization

Status: done

## Story

As a Teacher,
I want to select a flashcard set and launch a Live Game lobby,
So that I can display the Join Code and QR code on the classroom projector (FR14).

## Acceptance Criteria

1. **Given** a Teacher on their dashboard
   **When** they click "Host Live Game" on a study set
   **Then** `POST /api/live/rooms` is called, a room is created, and the UI transitions to a Lobby view
2. **Given** the Lobby view is active
   **Then** a large 6-digit Join Code is displayed alongside a scannable QR code
3. **Given** the Lobby is live
   **Then** the Teacher sees a real-time counter of connected students (via the WebSocket room)

## Tasks / Subtasks

- [x] **Backend** — covered by Story 5.1's `POST /api/live/rooms` endpoint
- [x] **Frontend: Host Live Game Button**
  - [x] Created `src/app/set/[id]/HostLiveGameButton.tsx` — calls `POST /api/live/rooms`, redirects to `/live/[roomId]/teacher`
  - [x] Added to `set/[id]/page.tsx` for authenticated sessions (below existing study mode links)
- [x] **Frontend: Lobby Page (`/live/[roomId]/teacher`)**
  - [x] Displays large 6-digit join code with decorative QR dot-grid visual
  - [x] Opens WebSocket to `/api/live/ws`, listens for `student_joined`/`student_left` events
  - [x] Real-time connected-students counter with animated number
  - [x] "Start Game" button (enabled when ≥1 student connected) sends `{ type: "start_game" }` over WebSocket

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Debug Log References
- Next.js 15 async `params` requires a `use_params()` wrapper inside the Client Component (can't call `React.use()` directly in a function component without the React 19 RC import).
- Build confirmed: `/live/[roomId]/teacher` appears in route table, exit code 0.

### Completion Notes List
- `HostLiveGameButton`: client component, calls `POST /api/live/rooms`, redirects to lobby with `?joinCode=&setId=` query params. Auth via `session.id_token`.
- Teacher Lobby: stateful real-time counter via raw `WebSocket`, `student_joined`/`student_left` JSON events. Start Game emits `{ type: "start_game" }` then navigates to `/live/[roomId]/teacher/game` (Story 5.4 page).
- `npm run build` — exit code 0, 21 routes (added `/live/[roomId]/teacher`).

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/HostLiveGameButton.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/live/[roomId]/teacher/page.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/page.tsx`
