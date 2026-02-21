# Story 1.1: Project Initialization & Type Synchronization

Status: done

## Story

As a Developer,
I want to initialize the Next.js 15 PWA and Rust Axum workspaces with automated cross-language type generation,
so that all future feature development relies on a strict, type-safe foundation.

## Acceptance Criteria

1. **Given** an empty project directory
   **When** the initialization script is run
   **Then** a `memora-web` (Next.js) and `memora-api` (Rust) workspace are created
2. **Given** the workspaces are created
   **When** the type synchronization command is executed
   **Then** a tool (like OpenAPI-to-TS or Typeshare) is configured to generate TS interfaces from Rust DTOs automatically.

## Tasks / Subtasks

- [x] Initialize the project directories
  - [x] Create `memora-web` using `npx create-next-app@latest` (Next.js 15, App Router, TypeScript)
  - [x] Create `memora-api` using `cargo new` (Rust workspace for Axum)
- [x] Configure cross-language type generation
  - [x] Set up a tool like `typeshare` or configure OpenAPI generation in the Rust backend
  - [x] Create a script to automatically generate and sync TypeScript interfaces to the frontend project
- [x] Establish initial project foundations
  - [x] Implement strict `camelCase` JSON serialization mapping on the Rust backend for all outputs
  - [x] Setup initial README documentation detailing how to run both environments and sync types

## Dev Notes

- **Technical Stack from Architecture:** Custom Hybrid setup (`npx create-next-app` + `cargo new`).
- **Data Serialization:** Rust backend MUST map all outputs to `camelCase` to comply with frontend consistency rules.
- **Goal:** Ensure Epic 1 Story 1 establishes the baseline starter template and type-safety mechanisms before any features are built.

### Project Structure Notes

- Alignment with unified project structure (paths, modules, naming): Ensure `memora-web` and `memora-api` are top-level and managed correctly if using a monorepo approach (e.g., using turborepo or pnpm workspaces if applicable, though standard separate folders is fine as a baseline).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Additional Requirements] -> "Starter Template Initialization" and "Type Generation"
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.1: Project Initialization & Type Synchronization]

## Dev Agent Record

### Agent Model Used

Antigravity Code Assistant

### Debug Log References

- [Code Review Findings] -> Automatically fixed missing sync script and README.

### Completion Notes List

- Added typeshare-cli synchronization script at project root
- Initialized README.md with usage documentation
- Ran `sync.sh` successfully to generate `memora-web/src/types/api.ts`

### File List

- `memora-web/package.json`
- `memora-api/Cargo.toml`
- `memora-api/src/domain/dtos/mod.rs`
- `sync.sh`
- `README.md`
- `memora-web/src/types/api.ts`
