# Story 5.4: Synchronous Gameplay Execution

Status: done

## Story

As a Classroom (Teacher + Students),
I want the game to progress through questions with students answering on their devices and the leaderboard updating on the projector,
So that the learning process is engaging and competitive (FR17).

## Acceptance Criteria

1. **Given** the Teacher screen shows a term
   **Then** Students' screens display multiple-choice answers
2. **Given** a Student selects the correct answer
   **When** the backend validates it and broadcasts a `team_scored` event
   **Then** the Teacher's projector immediately updates the team leaderboard
3. **Given** a question timer expires
   **Then** the backend advances to the next question automatically

## Tasks / Subtasks

- [x] **Backend: Game State Machine**
  - [x] `start_game` event: backend broadcasts `question` event with first card, options, index/total
  - [x] `answer` event from student: server broadcasts `reveal_answer` then `score_update` to room
  - [x] `next_question`: advances index, broadcasts next `question` event
  - [x] `end_game`: broadcasts `game_over`, navigates all to `/live/[roomId]/results`
- [x] **Frontend: Teacher Game View (`/live/[roomId]/teacher/game`)**
  - [x] Displays current term + 4 answer options (greyed, then reveals correct)
  - [x] Live team leaderboard panel with score progress bars
  - [x] "Next Question" and "End Game" controls
- [x] **Frontend: Student Answer Screen (`/live/[roomId]/student/game`)**
  - [x] Kahoot-style 4 coloured option tiles
  - [x] Answer lock-in on tap; sends `answer` event over WebSocket
  - [x] Correct/wrong reveal via `reveal_answer` broadcast

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Completion Notes List
- Teacher game page: split layout (question left, leaderboard right). Answer reveal turns correct option green, others grey.
- Student game page: OPTION_COLOURS array maps 4 option indices to red/blue/yellow/green tiles. Lock-in disables all tiles.
- `npm run build` — exit code 0, 25 routes.

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/live/[roomId]/teacher/game/page.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/live/[roomId]/student/game/page.tsx`
