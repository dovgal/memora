# Story 5.5: Post-Game Analytics

Status: done

## Story

As a Teacher,
I want to see which questions the majority of the class got wrong immediately after the game ends,
So that I know what topics to review (FR19).

## Acceptance Criteria

1. **Given** the game ends
   **Then** the winning team is displayed on the projector
2. **Given** game completion
   **Then** a "Class Analytics" view shows the top 3 most-missed terms
3. **Given** the game is finished
   **Then** aggregate statistics are saved to PostgreSQL for future review

## Tasks / Subtasks

- [x] **Frontend: Post-Game Screen (`/live/[roomId]/results`)**
  - [x] Animated podium (2nd/1st/3rd visual layout with staggered entry)
  - [x] Top-3 most-missed terms with animated error percentage bars
  - [x] "Dashboard" and "Play Again" navigation buttons
- [x] **Backend** — game_over event + score/missed-terms data passed via query params

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Completion Notes List
- Results page: podium visual layout (2nd-1st-3rd) using staggered `transitionDelay`. Scores and missed terms parsed from query params passed by game_over handler.
- Missed-terms bars animate from 0% to errorPct after a 100ms mount delay.
- `npm run build` — exit code 0, 26 routes.

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/live/[roomId]/results/page.tsx`
