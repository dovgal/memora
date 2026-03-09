# Story 4.2: Q-Chat Interface & Conversation History

Status: done

## Story

As a Learner,
I want a chat interface next to my flashcards that remembers our conversation,
So that I can ask follow-up questions about the material seamlessly (FR12).

## Acceptance Criteria

1. **Given** a user studying a set
   **When** they open the Q-Chat sidebar/panel
   **Then** they see a familiar chat interface (message bubbles, typing indicator)
2. **Given** a previous conversation exists for this set
   **When** the user reopens Q-Chat
   **Then** the previous conversation history for this specific session is loaded
3. **Given** the user types a message and submits
   **When** the request reaches the backend
   **Then** the response streams back via SSE and renders token-by-token in the chat UI

## Tasks / Subtasks

- [x] **Frontend: Q-Chat UI Component (memora-web)**
  - [x] Create `src/components/QChat/QChatPanel.tsx` — slide-in 380px panel with message bubbles, typing indicator, text input + send button
  - [x] Create `src/components/QChat/useChatStream.ts` hook — wraps `@microsoft/fetch-event-source` for SSE streaming
  - [x] Create `src/components/QChat/index.ts` barrel export
  - [x] Create `src/app/set/[id]/QChatWrapper.tsx` client wrapper
  - [x] Integrated `QChatPanel` into `src/app/set/[id]/page.tsx` (authenticated users only)
- [x] **Conversation History (Frontend State)**
  - [x] Stored in `localStorage` keyed by `set_id`, trimmed to last 50 messages
  - [x] Full `messages: ChatMessage[]` array sent on each request (matches 4.1 DTO)
- [x] **Typing Indicator & Streaming UX**
  - [x] Empty assistant bubble shown immediately; chunks appended via `setMessages`
  - [x] `TypingIndicator` component shown when waiting for first chunk
  - [x] `autoSend(msg)` exposed via `useImperativeHandle` ref for Story 4.3

## Dev Notes

- **Dependency on Story 4.1:** `POST /api/ai/qchat/:set_id` must be live. Story 4.1 is already implemented.
- **SSE pattern:** Reuse `@microsoft/fetch-event-source` already used in Story 3.2. Same Authorization header pattern applies.
- **No new backend endpoint required** unless persistent server-side history is desired. For MVP, client-side state is sufficient.
- **UX:** The panel should not take over the entire screen on desktop — use a 350px side panel. On mobile, it can be a bottom sheet.

### Project Structure Notes

- New files:
  - `memora-web/src/components/QChat/QChatPanel.tsx`
  - `memora-web/src/components/QChat/useChatStream.ts`
  - `memora-web/src/components/QChat/index.ts` (barrel export)
- Modified files:
  - `memora-web/src/app/set/[id]/layout.tsx` (or per-study-mode page) — inject `QChatPanel`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Q-Chat Interface & Conversation History]
- [FR12 – Q-Chat dialogue within set context]
- [Dependency: Story 4.1 – Q-Chat Guardrails Backend (done)]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini 2.5 Pro)

### Debug Log References
- Resolved Server vs. Client Component boundary: `page.tsx` is a Server Component, so `QChatPanel` (which uses hooks) is mounted via a thin `QChatWrapper.tsx` client wrapper.
- Used `forwardRef` + `useImperativeHandle` to expose `autoSend()` for Story 4.3 integration.

### Completion Notes List
- Built `useChatStream` hook with `fetchEventSource`, appending SSE chunks to the live assistant message and persisting history to `localStorage` (max 50 messages, keyed by `set_id`).
- `QChatPanel` is a fixed-positioned 380px side panel with animated slide-in, user/AI message bubbles, typing indicator (animated dots), and a clear-history button.
- Floating `MessageCircle` toggle button (bottom-right, indigo) shown only for authenticated sessions.
- `npm run build` passed with exit code 0 (all 20 routes compiled).

### File List
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/types/schema.ts`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/components/QChat/useChatStream.ts`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/components/QChat/QChatPanel.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/components/QChat/index.ts`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/QChatWrapper.tsx`
- `/Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/page.tsx`
