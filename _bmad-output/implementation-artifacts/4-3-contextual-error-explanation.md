# Story 4.3: Contextual Error Explanation

Status: done

## Story

As a Learner,
I want Q-Chat to automatically explain why I got a question wrong during "Learn" mode,
So that I can understand my mistakes immediately without asking manually (FR13).

## Acceptance Criteria

1. **Given** a user in "Learn" mode
   **When** they submit an incorrect answer
   **Then** the UI shows a "Why is this wrong?" button alongside the correct answer reveal
2. **Given** the user clicks "Why is this wrong?"
   **When** the Q-Chat panel opens
   **Then** a pre-filled prompt is automatically sent: "I answered [user_answer] but the correct answer is [correct_answer]. Why is this wrong?"
3. **Given** the automated prompt is sent
   **Then** Q-Chat opens the SSE connection to the backend and streams an explanation comparing the wrong answer to the correct definition from the set
   **And** the explanation is grounded strictly in the current set's content (guardrails from Story 4.1 apply)

## Tasks / Subtasks

- [x] **Frontend: "Why is this wrong?" Button (memora-web)**
  - [x] Created `src/components/QChat/WhyWrongButton.tsx` with `HelpCircle` icon; composes a contextual prompt from `term`, `correctAnswer`, and `userAnswer`
  - [x] In `src/app/set/[id]/learn/page.tsx`, reveals `WhyWrongButton` + a "Next" button after an incorrect answer
  - [x] Wrong answers no longer auto-advance; correct answers still auto-advance after 1.2s
- [x] **Frontend: Auto-Prompt Trigger (memora-web)**
  - [x] Created `src/components/QChat/QChatContext.tsx` — `QChatProvider` mounts `QChatPanel` and exposes `autoSend()` via React Context
  - [x] `WhyWrongButton` calls `useQChat().autoSend(message)` on click (500ms delay inside `QChatPanel.autoSend()`)
- [x] **Verification**
  - [x] `npm run build` passed — exit code 0, 20 routes compiled

## Dev Notes

- **Dependency on Story 4.2:** `QChatPanel` and `useChatStream` hook must be built first.
- **No new backend endpoint needed:** This story only adds UI logic on the frontend. The existing `POST /api/ai/qchat/:set_id` with guardrails (4.1) handles all prompts identically — the "Why wrong" message is just a specially formatted user message.
- **UX:** The "Why is this wrong?" button should appear alongside the "Next Card" button in the incorrect-answer state. Use a secondary action style (outlined, less prominent than "Next Card") to avoid cognitive overload.
- **Auto-send UX:** Consider a 500ms delay before auto-sending to give the user a chance to cancel // modify the message if they want.

### Project Structure Notes

- New file:
  - `memora-web/src/components/QChat/WhyWrongButton.tsx`
- Modified files:
  - `memora-web/src/app/set/[id]/learn/page.tsx` — add `WhyWrongButton` on incorrect answer reveal
  - `memora-web/src/components/QChat/QChatPanel.tsx` — expose `autoSend` mechanism (ref/context)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.3: Contextual Error Explanation]
- [FR13 – Q-Chat explains mistakes based on current set context]
- [Dependency: Story 4.2 – Q-Chat Interface (ready-for-dev)]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Debug Log References
- Used `QChatContext` (React Context) rather than Zustand to avoid adding a new dependency; `QChatProvider` wraps the learn page and exposes `autoSend()` via `useQChat()` hook.
- Wrong answers no longer auto-advance — this intentionally gives the user time to interact with Q-Chat or read the correct answer before proceeding.

### Completion Notes List
- Created `QChatContext.tsx`: `QChatProvider` wraps children + mounts `QChatPanel`, exposing `autoSend()` via context.
- Created `WhyWrongButton.tsx`: composes prompt `"I answered X but the correct answer is Y. Explain..."` and calls `autoSend()`.
- Rewrote `learn/page.tsx`: wraps all content in `<QChatProvider setId={id}>`, adds `isWrongAnswer` state, shows `WhyWrongButton` + manual "Next" button on wrong answers.
- Updated `index.ts` barrel to export `QChatProvider`, `useQChat`, `WhyWrongButton`.
- `npm run build` passed — exit code 0.

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/components/QChat/QChatContext.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/components/QChat/WhyWrongButton.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/components/QChat/index.ts`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/learn/page.tsx`
