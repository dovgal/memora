# Story 1.4: Role Selection & Dashboard Routing

Status: done

## Story

As an Authenticated User,
I want to select my role (Student or Teacher) and be routed appropriately,
So that I have access to the correct features (FR3).

## Acceptance Criteria

1. **Given** a newly registered user completing COPPA screening
   **When** they select their account type (Student/Teacher)
   **Then** their role is permanently saved to the database via the Rust API
2. **Given** a user with a saved role
   **When** they attempt to access their dashboard
   **Then** Teachers are routed to `/dashboard/teacher` while Students are routed to `/dashboard/student`
3. **Given** a user with a Student role
   **When** they attempt to access a `/dashboard/teacher` route
   **Then** role-based access control (RBAC) middleware prevents them from accessing the route and redirects them.

## Tasks / Subtasks

- [x] Role Selection UI (memora-web)
  - [x] Create a Role Selection page (`src/app/role-selection/page.tsx`) presented to users immediately after COPPA onboarding.
  - [x] Create visually distinct cards/buttons for "Student" and "Teacher".
- [x] Backend Role Update (memora-api)
  - [x] Update `users_profiles` or `users` table to include a `role` column (already present).
  - [x] Create an API endpoint (`PATCH /api/users/role`) to save the user's selected role.
- [x] RBAC Middleware & Routing (memora-web & memora-api)
  - [x] Update NextAuth JWT callbacks to include the selected `role` and enforce `needsRoleSelection`.
  - [x] Update Next.js `middleware.ts` to enforce RBAC:
    - Block Students from `/dashboard/teacher/*`
    - Seamlessly route `/dashboard` to the correct sub-dashboard based on role.
  - [x] Enhance Rust auth middleware (`src/middleware/auth.rs`) to validate roles for protected API routes (`RequireTeacher` / `RequireStudent` extractors).

## Dev Notes

- **Database Changes:** You may need to add a migration to add a `role` column to `users` or `user_profiles` if one doesn't exist yet! Enum types (`student`, `teacher`) are preferred in PostgreSQL.
- **Middleware Complexity:** Be careful with Next.js middleware redirect loops. When updating the token from the Role Selection page, you must refresh the NextAuth session so the middleware picks up the new `role`.
- **Rust Auth:** Consider using Axum's `FromRequestParts` to extend the existing `AuthenticatedUser` to specifically check for roles, e.g., `pub struct TeacherUser;`.

### Project Structure Notes

- Add frontend pages to `memora-web/src/app/(auth)/role-selection`
- Update `memora-web/src/middleware.ts`
- Update `memora-api/src/handlers/users.rs`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Role Selection & Dashboard Routing]

## Dev Agent Record

### Agent Model Used

Antigravity Code Assistant

### Debug Log References

- Handled custom API route building to proxy requests and safely map JWTs without client exposure.

### Completion Notes List

- Implemented `/role-selection` modern UI UI.
- Rewrote Nextjs `middleware.ts` to seamlessly handle `needsRoleSelection` NextAuth flags, acting as a strict gating mechanism prior to `/dashboard` routing.
- Built explicit Router redirects blocking `student` tokens from accessing `/dashboard/teacher` paths.
- Setup `PATCH /api/users/role` on the Rust `sqlx` backend to push Role updates to local db.
- Scaffolded `/dashboard/teacher` and `/dashboard/student` index pages.  
- Expanded `memora-api/src/middleware/auth.rs` logic to introduce declarative `RequireTeacher` and `RequireStudent` extractors.

### File List
- `memora-web/src/app/(auth)/role-selection/page.tsx`
- `memora-web/src/app/(dashboard)/dashboard/student/page.tsx`
- `memora-web/src/app/(dashboard)/dashboard/teacher/page.tsx`
- `memora-web/src/app/api/auth/[...nextauth]/route.ts`
- `memora-web/src/app/api/users/role/route.ts`
- `memora-web/src/middleware.ts`
- `memora-api/src/domain/dtos/mod.rs`
- `memora-api/src/handlers/users.rs`
- `memora-api/src/main.rs`
- `memora-api/src/middleware/auth.rs`
