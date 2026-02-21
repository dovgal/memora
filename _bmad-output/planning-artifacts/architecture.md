---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-20T00:25:44+02:00'
inputDocuments:
  - /Users/dovgal/Project/my-bmad-project/_bmad-output/planning-artifacts/prd.md
---
# Architecture Decisions for Memora

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
- **Identity & Compliance:** Email/SSO auth with COPPA age screening and strict role isolation (Teacher vs. Student).
- **AI-Powered Creation:** Multimodal intake (OCR, Text) requiring asynchronous processing and user verification workflows.
- **Asynchronous Learning (PWA):** Client-side execution of study modes (Flashcards, Learn, Test) with offline persistence and deferred server sync.
- **AI Tutor (Q-Chat):** Context-aware conversational interfaces requiring RAG-like scoping to current study sets.
- **Synchronous Learning (Live Mode):** High-frequency pub/sub messaging for competitive real-time classrooms.
- **Analytics:** Aggregated and individual progress tracking.

**Non-Functional Requirements:**
- **Performance:** TTI < 2.0s (PWA requirement); Live Mode latency < 100ms; AI streaming < 15s.
- **Scalability:** Must handle 50 concurrent WebSocket connections initiating within 5 seconds per class without degradation.
- **Security:** TLS 1.3, AES-256 at rest, robust API rate limiting, and AI Guardrails (SLA < 0.1% false negatives for NSFW/Prompt Injection).
- **Accessibility:** WCAG 2.1 AA and full keyboard navigation support for Teacher interfaces.

**Scale & Complexity:**
- Primary domain: Hybrid Full-Stack Web App (PWA Frontend + Real-time/AI Backend)
- Complexity level: Medium-High
- Estimated architectural components: 4+ (Frontend Next.js App, Rust API/WS Server, Database, Cache/Queue)

### Technical Constraints & Dependencies
- **PWA Architecture:** Hard dependency on Service Workers and IndexedDB for offline functionality.
- **External AI Providers:** Dependence on third-party LLM APIs (OpenAI/Anthropic) dictates the need for resilient retry mechanisms and fallback strategies.
- **WebSockets:** Requires stable, long-lived TCP connections, necessitating specialized deployment infrastructure (e.g., bare metal or specialized PaaS, avoiding standard Serverless functions for this specific layer).

### Cross-Cutting Concerns Identified
- **Real-Time State Synchronization:** Reconciling local client state with server-authoritative Live Mode state.
- **Offline Data Conflict Resolution:** Merging offline study progress with the central database upon reconnection.
- **AI Orchestration & Guardrails:** Centralized middleware applied to all LLM interactions to enforce safety and context boundaries.
- **Data Isolation (EdTech):** Enforcing strict tenant (Class/Teacher) and user boundaries across all database queries.

## Starter Template Evaluation

### Primary Technology Domain

Hybrid Full-Stack (Next.js 15 Frontend + Rust/Axum Backend) based on project requirements analysis.

### Starter Options Considered

1. **Next.js 15 App Router Boilerplates:** Evaluated standard `npx create-next-app@latest` vs community boilerplates. Standard CLI is favored for 2026 to ensure the latest React 19/Next 15+ features without bloated legacy dependencies.
2. **Rust/Axum Boilerplates:** Evaluated `flaviodelgrosso/rust-axum-boilerplate` and `Riktastic/Axium`. Modern community boilerplates provide great structure (SQLx, structured logging, JWT), but often carry excess baggage. We will use a heavily architecture-guided manual setup mimicking production-ready Axum patterns.

### Selected Starter: Custom Hybrid (Create Next App + Cargo Workspace)

**Rationale for Selection:**
Memora's hybrid nature means a single monolithic starter won't fit. We will initialize two separate repositories/workspaces.
For the frontend, the official Next.js CLI guarantees the most stable PWA and RSC setup.
For the backend, we will scaffold a custom Rust workspace tailored specifically for our WebSocket Live Mode and AI Gateway needs, avoiding unused boilerplate features.

**Initialization Command:**

```bash
# Frontend
npx create-next-app@latest memora-web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# Backend
cargo new memora-api --bin && cd memora-api && cargo add axum tokio serde sqlx
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- Frontend: TypeScript (Strict mode), Node.js Runtime.
- Backend: Rust, Tokio async runtime.

**Styling Solution:**
- Tailwind CSS (Built-in Next.js configuration).

**Build Tooling:**
- Frontend: Turbopack (Next.js default for fast HMR).
- Backend: Cargo.

**Testing Framework:**
- Frontend: Vitest + Playwright (to be configured manually).
- Backend: Built-in `cargo test`.

**Code Organization:**
- Frontend: App Router structure inside the `src/app` directory.
- Backend: Workspace-based layout (e.g., `api`, `domain`, `infrastructure`, `live-ws`).

**Development Experience:**
- Frontend: Next.js dev server with hot reloading.
- Backend: `cargo watch` for rapid iterative development.

**Note:** Project initialization using this command should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Database Engine & ORM
- Authentication Flow (SSO + Role handling)
- WebSocket Implementation (Live Mode Protocol)

**Important Decisions (Shape Architecture):**
- Content Storage (Images for OCR/Flashcards)
- PWA state synchronization Strategy

**Deferred Decisions (Post-MVP):**
- LTI Integration Patterns
- Real-time Analytics processing pipeline (defer to basic aggregations for MVP)

### Data Architecture
- **Primary Database:** PostgreSQL 16+. Relational fits the strict EdTech schema (Users, Classes, Sets, Flashcards, Progress).
- **ORM (Backend):** SQLx (Rust). Provides compile-time checked queries without the overhead of heavy ORMs like Diesel, ensuring high macro performance.
- **Cache / PubSub:** Redis (via redis-rs). Crucial for fast token validation, OCR rate-limiting, and Pub/Sub message broker for WebSocket scaling across multiple Axum instances.
- **Blob Storage:** AWS S3 (or S3-compatible like Cloudflare R2). Needed for storing uploaded OCR homework photos and flashcard images.

### Authentication & Security
- **Auth Service:** NextAuth.js (Auth.js v5) on the Frontend for seamless Google/Microsoft SSO integration.
- **Backend Auth:** JWT (JSON Web Tokens) generated by the Frontend/NextAuth, passed as Bearer tokens to the Rust backend.
- **Security Middleware:** Axum middleware for JWT validation (using `jsonwebtoken` crate) and strictly enforcing RBAC (Student vs Teacher).

### API & Communication Patterns
- **Standard CRUD:** REST API via Axum. Predictable, standard, easily typed via OpenAPI/Swagger generation (`utoipa` crate).
- **Synchronous Live Mode:** WebSockets via `axum::extract::ws`. Uses Redis Pub/Sub to broadcast events (e.g., "next question", "team scored") to all connected clients in a specific Class Room.
- **AI Streaming:** Server-Sent Events (SSE) from the Rust Backend to Next.js Client. Essential for Q-Chat and chunked OCR generation so the user doesn't wait 15 seconds looking at a blank screen.

### Frontend Architecture
- **Framework:** Next.js 15 (App Router).
- **State Management (Client):** Zustand. Lightweight, avoids React Context hell, perfect for complex async state (Live Mode scores, Q-Chat history).
- **Data Fetching:** TanStack Query (React Query) v5. Handles aggressive client-side caching, loading states, and offline mutations (crucial for the PWA requirement).
- **Styling & Components:** Tailwind CSS + UI Library (e.g., shadcn/ui) for rapid, accessible (WCAG 2.1 AA) component development without compromising customizability.

### Infrastructure & Deployment
- **Frontend Hosting:** Vercel. Zero-config Next.js 15 support, global Edge network, handles static assets perfectly.
- **Backend Hosting:** Managed Container Service (e.g., AWS ECS, Render, or Fly.io). Must support long-lived TCP connections for WebSockets (Standard Serverless functions on Vercel cannot host WebSockets).
- **Database Hosting:** Managed PostgreSQL (e.g., Supabase, Neon, or AWS RDS).

### Decision Impact Analysis

**Implementation Sequence:**
1. Database Schema Design (SQLx migrations).
2. Backend JWT Middleware & NextAuth.js Integration.
3. Core CRUD APIs (Flashcards, Sets).
4. WebSocket Foundation & Redis Broker (Live Mode Stub).
5. External API Proxies (OpenAI integration with SSE).
6. PWA Offline Service Worker & TanStack Query persistence.

**Cross-Component Dependencies:**
- NextAuth.js secret must be securely shared with the Rust backend to decode and verify JWT signatures.
- Type definitions must remain in sync between Rust structs and TypeScript interfaces (requires a schema generation tool like `typeshare` or OpenAPI-to-TS).

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
4 areas where AI agents could make different choices (Naming, API Formats, State Updates, Error Handling) which would break the Next.js <-> Rust bridge.

### Naming Patterns

**Database Naming Conventions (PostgreSQL via SQLx):**
- **Tables & Columns:** Strict `snake_case` (e.g., `user_profiles`, `created_at`).
- **Foreign Keys:** Suffix `_id` (e.g., `teacher_id`).
- **Enums/Types:** PascalCase for Rust enums mapped to Postgres types (e.g., `UserRole::Teacher`).

**API Naming Conventions:**
- **Endpoints:** Strict plural, kebab-case (e.g., `GET /api/v1/study-sets`, `POST /api/v1/users/{id}/flashcards`).
- **Payloads (JSON):** The Rust backend **MUST** serialize/deserialize all JSON fields as `camelCase` to match JavaScript conventions native to Next.js. (Use `#[serde(rename_all = "camelCase")]` on all shared DTO structs).

**Code Naming Conventions:**
- **TS/React:** Components are `PascalCase` (`FlashcardDeck.tsx`), utilities/hooks are `camelCase` (`useLiveClass.ts`).
- **Rust:** Structs/Traits are `PascalCase` (`CreateSetRequest`), variables/functions/modules are `snake_case` (`fn broadcast_score()`).

### Format Patterns

**API Response Formats:**
All REST API responses must follow a strict wrapper envelope:
- **Success:** `{ "data": { ... }, "meta": { "pagination": ... } }`
- **Error:** `{ "error": { "code": "VALIDATION_FAILED", "message": "Human readable format", "details": [...] } }`

**Data Exchange Formats:**
- **Timestamps:** ISO 8601 strings in UTC (`2026-02-20T14:30:00Z`). Never use raw UNIX timestamps in JSON payloads.
- **IDs:** UUIDv4 strings for all external facing IDs to prevent enumeration attacks and simplify offline generation (PWA sync).

### Communication Patterns

**Event System Patterns (WebSockets):**
- **Event Names:** `namespace:action` using camelCase (e.g., `liveMode:studentJoined`, `qChat:typingStart`).
- **Payload:** Every event must include a `timestamp` and a unique `eventId` for idempotent processing.

**State Management Patterns (Frontend):**
- **Server State:** Handled exclusively by TanStack Query. Agents must NEVER store API responses in Zustand.
- **Client/Live State:** Handled by Zustand. Agents must use immutable updates (or Immer) and group related state into feature slices.

### Process Patterns

**Error Handling Patterns:**
- **Rust (Backend):** Use a custom `AppError` enum that implements `IntoResponse`. Never `unwrap()` or `panic!()` in route handlers. Map database constraints to standard 400/409 HTTP codes.
- **Next.js (Frontend):** Use `error.tsx` boundaries for page-level crashes. Use toast notifications for mutation errors caught by TanStack Query.

### Enforcement Guidelines

**All AI Agents MUST:**
- Use `serde` rename rules in Rust to guarantee `camelCase` JSON.
- Never use relative imports deeper than one level in TS; always use the `@/` alias (e.g., `@/components/ui/button`).
- Validate all incoming API data. (Frontend: Zod, Backend: Validate crate / manual checks).

### Pattern Examples

**Good Examples:**
```rust
// Backend API Model clearly aliased to camelCase for JS
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    pub id: Uuid,
    pub first_name: String,
    pub created_at: DateTime<Utc>,
}
```

**Anti-Patterns:**
Returning raw Database structs to the frontend without a DTO layer, resulting in `first_name` leaking into the React application, forcing the TS agent to mix camelCase and snake_case in UI components.

## Project Structure & Boundaries

### Complete Project Directory Structure

**Monorepo Root (or Dual-Repo structure):**
```text
memora-project/
├── memora-web/                 # Next.js 15 PWA
│   ├── src/
│   │   ├── app/                # App Router (Pages & Layouts)
│   │   │   ├── (auth)/         # Login/Registration routes
│   │   │   ├── dashboard/      # Teacher/Student main views
│   │   │   ├── set/[id]/       # Flashcard Set Viewer/Editor
│   │   │   ├── live/[id]/      # Live Mode interface
│   │   │   └── api/auth/       # NextAuth.js handlers
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn UI primitives
│   │   │   ├── forms/          # Zod-validated forms
│   │   │   └── features/       # Domain-specific (e.g., FlashcardDeck)
│   │   ├── lib/
│   │   │   ├── store/          # Zustand slices
│   │   │   ├── query/          # TanStack Query keys/hooks
│   │   │   └── api/            # Typed Axios/Fetch clients
│   │   ├── types/              # TS interfaces (sync with Rust DTOs)
│   │   └── worker/             # Service Worker (PWA offline sync)
│   └── public/
│       └── manifest.json
└── memora-api/                 # Rust Axum Backend
    ├── Cargo.toml              # Workspace root
    ├── api-core/               # Main REST HTTP Server
    │   └── src/
    │       ├── handlers/       # HTTP route controllers
    │       ├── routes.rs       # Axum Router definitions
    │       └── middleware/     # JWT Auth, Rate limiting
    ├── live-ws/                # WebSocket Server (Live Mode)
    │   └── src/
    │       ├── broker.rs       # Redis Pub/Sub integration
    │       ├── connection.rs   # WS connection lifecycle
    │       └── rooms.rs        # Classroom state management
    ├── domain/                 # Core Business Logic & Types
    │   └── src/
    │       ├── models/         # Database structs
    │       ├── dtos/           # camelCase Request/Response structs
    │       └── errors.rs       # AppError definitions
    ├── infrastructure/         # External Integrations
    │   └── src/
    │       ├── db/             # SQLx PostgreSQL queries
    │       ├── ai/             # OpenAI/Anthropic SSE clients
    │       └── storage/        # S3 Blob Storage client
    └── migrations/             # SQLx database migrations
```

### Architectural Boundaries

**API Boundaries:**
- **External API:**  handles all standard CRUD (Create Set, Get Progress) over HTTPS.
- **WebSocket Boundary:**  handles real-time upgrades (). Strict boundary: WS server only receives JWTs for handshake, never performs heavy DB mutations directly, delegates to  via Redis or internal HTTP if needed to save state.
- **AI Gateway:**  acts as a proxy. Clients NEVER call LLMs directly. The Rust backend injects the prompt, adds safety guardrails, and returns SSE (Server-Sent Events) to the client.

**Component Boundaries (Frontend):**
- **Server Components (RSC):** Used for fetching public sets and dashboard shells (SEO + fast initial load).
- **Client Components:** Used for interactive elements (Zustand, Forms, Live Mode, Q-Chat). Data passed from RSC to Client via props to minimize JS bundle.

### Requirements to Structure Mapping

**Feature/Epic Mapping:**
- **Live Mode MVP:**
  - Frontend: , 
  - Backend: 
- **AI OCR Generation:**
  - Frontend: , 
  - Backend:  and 
- **Offline PWA Study:**
  - Frontend:  (Service Worker caching logic) and 

### Integration Points

**Internal Communication:**
- **Frontend -> Backend:** Typed REST calls (protected by NextAuth JWT) and WS connections.
- **Micro-service State (Rust):** `api-core` and `live-ws` communicate via Redis Pub/Sub (e.g., when a Teacher updates a set via REST, it broadcasts an invalidate event to active WS rooms).

**External Integrations:**
- PostgreSQL (Primary Data)
- Redis (Session cache & Pub/Sub)
- OpenAI API (Generative AI & OCR parsing)
- Auth Providers (Google/Microsoft via NextAuth)

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
The hybrid architecture (Next.js 15 PWA + Rust Axum WebSocket/REST Backend) is highly compatible for this use case. Offloading heavy real-time connections to Rust prevents Node.js Event Loop blocking, while Next.js handles the complex PWA routing and caching gracefully.

**Pattern Consistency:**
Strict JSON format rules ( for network boundaries, native cases internally) ensure no conflict between TS agents and Rust agents. Database naming conventions are fully aligned with SQLx expectations.

**Structure Alignment:**
The dual-repo structure inside a logical monorepo provides clear boundaries. Frontend agents will not accidentally mutate backend logic, and the HTTP/WS protocols act as a strict contract.

### Requirements Coverage Validation ✅

**Epic/Feature Coverage:**
- **Live Mode:** Fully supported by the dedicated  Axum sub-crate and Redis Pub/Sub.
- **AI Tutor (Q-Chat):** Supported via server-sent events (SSE) proxied through the Rust  module.
- **Offline PWA:** Supported by Next.js  and TanStack Query caching.

**Functional Requirements Coverage:**
All 19 core functional requirements from the PRD have mapped structural homes in the directories defined.

**Non-Functional Requirements Coverage:**
- **TTI < 2.0s:** Supported by Next.js RSCs.
- **Latency < 100ms:** Supported by Axum WebSockets.
- **AI Streaming < 15s:** Supported by SSE.

### Implementation Readiness Validation ✅

**Decision Completeness:**
Critical decisions (DB, Auth, WS, File Storage, State Management) are documented with exact technologies and versions.

**Structure Completeness:**
The directory tree is explicitly defined down to the core service and middleware levels.

**Pattern Completeness:**
Error handling, JSON normalization, and event naming formats are strictly defined.

### Gap Analysis Results

**Important Gaps (To be handled during Epic creation):**
- *OpenAPI / Type Generation:* We need a strict tool (e.g.,  or ) to physically ensure the TypeScript types in  exactly match the Rust DTOs in . (Priority: High, before Sprint 1 coding).
- *End-to-End Testing:* Playwright is defined, but the strategy for mocking the Rust WebSocket server during Next.js UI tests needs definition.

### Validation Issues Addressed
*No blocking critical issues found. The architecture securely covers the MVP scope defined in the PRD.*

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**✅ Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** High

**Key Strengths:**
- Resilient performance under peak classroom loads (Rust WS).
- Rapid, modern UI development speed (Next.js 15).
- Clear, un-entangled module boundaries.

**Areas for Future Enhancement:**
- Moving to a fully automated monorepo tool (like Turborepo) if shared TS/Rust tooling becomes available.
- Real-time analytics queueing (Kafka/RabbitMQ) when scaling post-MVP.

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to this document for all architectural questions

**First Implementation Priority:**
Initialize the dual-project structure using the CLI commands defined in Section: Starter Template Evaluation.
