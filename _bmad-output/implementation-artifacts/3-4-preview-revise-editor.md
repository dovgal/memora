# Story 3.4: "Preview & Revise" Generation Editor

Status: done

## Story

As a Content Creator,
I want to review and edit the AI-generated flashcards before saving them permanently,
So that I can correct any AI hallucinations or OCR mistakes (FR8).

## Acceptance Criteria

1. **Given** the AI has finished streaming generated cards
   **When** the user views the results
   **Then** they are presented with an editable list of the term/definition pairs
2. **Given** the edit view
   **Then** they can modify text, delete incorrect cards, or add missing ones manually
3. **Given** the user is satisfied with the set
   **When** they click "Save to Library"
   **Then** the cards are permanently committed to the PostgreSQL database alongside a Title and Description.

## Tasks / Subtasks

- [x] Editable Card UI
  - [x] Update `/dashboard/generate` to render the `generatedCards` in an editable format (inputs/textareas) once generation is complete.
  - [x] Add "Delete Card" functionality to remove mis-generated or unwanted cards.
  - [x] Add "Add Card" functionality to append manual pairs.
- [x] Save to Library Hook-up
  - [x] Add a way for the user to specify a Title and Description for the generated set.
  - [x] Connect the "Save as New Set" button to the `POST /api/sets` endpoint.
  - [x] Redirect the user to the newly created set's study page upon success.
- [x] Verification
  - [x] Complete the generative flow, modify a card, and hit Save. Verify it appears in the database and redirects properly.

## Dev Notes
- We already have the backend endpoint `POST /api/sets` ready from Epic 1 Story 1.3 `Create Set REST API` which expects a JSON payload of `{ title, description, cards }`. 
- State management for `generatedCards` is currently a simple array in React state. We just need to wire `onChange` handlers for the index-based updates.

### References
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.4: "Preview & Revise" Generation Editor]

## Dev Agent Record

### Agent Model Used
Antigravity (Gemini Experimental)
### Debug Log References
- Addressed `CreateSetRequest` type matching on frontend REST `fetch` call matching the struct schema logic explicitly.
### Completion Notes List
- Generated interactive Input/Textarea bindings for `term` and `definition` keys.
- Hooked `POST` logic successfully intercepting the returning Db object ID mapping back into standard Client router loops.
### File List
- /Users/dovgal/.gemini/antigravity/brain/51b6f74d-56a2-4212-9b2c-dbfc83191b5a/task.md
- /Users/dovgal/Project/my-bmad-project/_bmad-output/implementation-artifacts/3-4-preview-revise-editor.md
- /Users/dovgal/Project/my-bmad-project/memora-web/src/app/(dashboard)/dashboard/generate/page.tsx
