# Story 2.3: "Learn" & "Test" Evaluation Modes

Status: done

## Story

As a Learner,
I want to study via spaced repetition (Learn) and take simulated exams (Test),
So that I can deeply memorize concepts and validate my readiness.

## Acceptance Criteria

1. **Given** a study set with at least 4 flashcards
   **When** the user selects "Learn" mode
   **Then** the system presents multiple-choice or typed-answer questions based on an SR (spaced repetition) algorithm.
2. **Given** a study set with at least 4 flashcards
   **When** the user selects "Test" mode
   **Then** a fixed set of questions is generated, graded at the end, and the final score is recorded.

## Tasks / Subtasks

- [x] Question Generation Logic (memora-web)
  - [x] Implement utility to generate multiple-choice distractors (wrong answers) from the current set's other flashcards.
- [x] Learn Mode UI (memora-web)
  - [x] Create Next.js page `src/app/set/[id]/learn/page.tsx`.
  - [x] Implement an algorithm to prioritize studying 'unknown' cards over 'known' cards based on `FlashcardProgress`.
  - [x] Support Multiple Choice questions.
  - [x] Support Typed questions (optional fallback or stage 2).
  - [x] Submit progress to backend (`POST /api/study/progress`).
- [x] Test Mode UI (memora-web)
  - [x] Create Next.js page `src/app/set/[id]/test/page.tsx`.
  - [x] Generate a test configuration (e.g., 20 questions: 10 multiple choice, 10 true/false).
  - [x] Present all questions and grade them upon submission.
  - [x] Display a final score and review of incorrect answers.
- [x] Integration
  - [x] Enable the "Learn" and "Test" buttons on the `set/[id]` page instead of showing "Coming Soon".

## Dev Notes

- **Learn Algorithm (Lightweight SR):** For the "Learn" mode, a simple Leitner box or status-weighted random draw is sufficient for the first iteration. Favor cards where `is_known == false`.
- **Distractors:** For multiple-choice questions, randomly pick 3 other definitions from the *same set* to act as wrong answers. If the set has fewer than 4 cards, multiple choice might not work well (fallback to True/False or Typed).
- **Test Mode State:** "Test" mode typically doesn't update the individual card SR progress in the same way "Learn" mode does, but it might record a final "Test Score". For now, focus on the UI and grading logic.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.3: "Learn" & "Test" Evaluation Modes]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)

### Debug Log References
- Generated `src/lib/studyUtils.ts` exporting functions for dynamically shifting multiple choice configurations and priority looping.

### Completion Notes List
- Evaluated and integrated a Random Sorting and prioritization SR algorithm to display unmastered cards up front in the `LearnModePage`.
- Included mixed-type checking (MCQ & True/False boolean comparison) during the static exam simulator iteration in `TestModePage` resolving edge responses securely.
- Successfully built via `npm run build` validating type safety in Next.js Server Components against updated 15.0 rules.

### File List
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/2-3-learn-and-test-evaluation-modes.md
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/learn/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/set/[id]/test/page.tsx
- /Users/dovgal/Project/my-bmad-project/memora-web/src/lib/studyUtils.ts
