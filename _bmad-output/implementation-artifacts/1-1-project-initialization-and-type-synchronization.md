# Story 1.1: Project Initialization & Type Synchronization

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to initialize the Next.js 15 PWA and Rust Axum workspaces with automated cross-language type generation,
so that all future feature development relies on a strict, type-safe foundation.

## Acceptance Criteria

1. **Given** an empty project directory
   **When** the initialization script is run
   **Then** a `memora-web` (Next.js) and `memora-api` (Rust) workspace are created
2. **And** a tool (like OpenAPI-to-TS or Typeshare) is configured to generate TS interfaces from Rust DTOs automatically.
3. **And** initial CI/CD configuration (e.g. GitHub Actions) is considered/stubbed as per Readiness Report best practices.

## Tasks / Subtasks

- [x] Initialize Frontend (Next.js 15 App Router)
  - [x] Execute `npx create-next-app@latest memora-web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`
  - [x] Setup core directories (`components/ui`, `lib/store`, `types`)
- [x] Initialize Backend (Rust / Axum)
  - [x] Execute `cargo new memora-api --bin && cd memora-api && cargo add axum tokio serde sqlx`
  - [x] Setup workspace layout (`api-core`, `live-ws`, `domain`, `infrastructure`)
- [x] Type Synchronization Setup
  - [x] Choose and integrate type generation (e.g., `typeshare` CLI or `utoipa` + `openapi-typescript`)
  - [x] Create a synchronized build script or Makefile to auto-generate TS interfaces from Rust DTOs
- [x] JSON Payload Standardization
  - [x] Ensure Rust structs are configured with `#[serde(rename_all = "camelCase")]` to match JS conventions

## Dev Notes

- **Technical Stack**: Next.js 15, React 19, TailwindCSS, Rust, Axum, SQLx, Tokio.
- **Critical Requirement**: All REST API responses must serialize/deserialize as `camelCase` to map seamlessly to frontend TypeScript `camelCase` constraints.
- **Architectural Reference**: The backend acts as an API and WebSocket broker. Next.js handles PWA offline capabilities.

### Project Structure Notes

- **Dual-Repo Structure**: The project must have a clear `memora-web/` and `memora-api/` split at the root level of work.
- **Alias Usage**: Next.js must securely use `@/*` to map back to `src/*` to prevent deep relative imports.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Starter-Template-Evaluation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns-&-Consistency-Rules]
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.1]

## Dev Agent Record

### Agent Model Used



### Debug Log References

### Completion Notes List

- ✅ Next.js 15 App Route web frontend scaffolded (`create-next-app` applied with Tailwind/TypeScript)
- ✅ Rust API backend scaffolded (Tokio, Axum, SQLX, Serde) with initial workspace directories mapped out (`api-core`, `live-ws`, `domain`, `infrastructure`)
- ✅ Typeshare CLI installed via Cargo globally
- ✅ Makefile provided to run `make types` which synchronizes Rust DTOs with Next.js TS configurations.
- ✅ Correct `camelCase` Serde attribute verified by validating that `created_at` in Rust successfully converts to `createdAt` in TypeScript interfaces.

### File List

- `memora-web/*` (Created)
- `memora-api/*` (Created)
- `memora-api/src/domain/dtos/mod.rs` (Added)
- `memora-web/src/types/schema.ts` (Added)
- `Makefile` (Added)

