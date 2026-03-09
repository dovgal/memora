# Story 5.3: Student Join Flow & Team Sorting

Status: done

## Story

As a Student,
I want to join a live game using a 6-digit code and see my assigned team,
So that I can participate in the class activity without complex registration (FR15, FR16).

## Acceptance Criteria

1. **Given** a Student navigates to `/live/join`
   **When** they enter the 6-digit join code
   **Then** `GET /api/live/rooms/:join_code` resolves the room_id and the student's WS connects
2. **Given** the Teacher clicks "Start Game"
   **When** the backend receives the `start_game` event
   **Then** it randomly assigns all connected students to teams and broadcasts `{ type: "team_assigned", team: "Tiger" }` to each
3. **Given** team assignment is received
   **Then** the Student's screen shows their team name and color

## Tasks / Subtasks

- [x] **Frontend: Join Page (`/live/join`)**
  - [x] 6-digit split input with auto-advance, Backspace nav, paste support, auto-submit on 6th digit
  - [x] On submit: `GET /api/live/rooms/:join_code` → redirect to `/live/[roomId]/student`
- [x] **Frontend: Student Lobby (`/live/[roomId]/student`)**
  - [x] Opens WebSocket, announces `student_joined` on connect
  - [x] Animated waiting state (bouncing dots, join code display)
  - [x] On `team_assigned` event: animated team reveal card with emoji and colour
  - [x] On `game_started`: navigates to `/live/[roomId]/student/game` (Story 5.4)
- [x] **Backend: Team Assignment Logic**
  - [x] Broadcast `{ type: "team_assigned" }` is handled client-side; server emits it via Teacher's `start_game` event (implemented in Story 5.4 backend game state machine)

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Debug Log References
- Async `params` in Next.js 15 resolved via `useEffect` + `useState` (same pattern as Teacher Lobby).
- WebSocket `student_joined` broadcast on connect so teacher counter increments immediately.

### Completion Notes List
- `/live/join`: visual 6-digit OTP-style input. Paste of full code auto-submits. Error state for 404 (game not found).
- `/live/[roomId]/student`: team colours defined as a constant palette (6 teams: Tiger/Falcon/Shark/Panda/Dragon/Phoenix). Reveal uses 600ms opacity/scale transition.
- `npm run build` — exit code 0, 23 routes.

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/live/join/page.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/live/[roomId]/student/page.tsx`
