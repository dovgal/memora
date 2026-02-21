# Story 1.3: SSO Registration & COPPA Screening

Status: done

## Story

As a New User,
I want to sign up using my Google or Microsoft account and verify my age,
So that I can access the platform legally without creating new passwords.

## Acceptance Criteria

1. **Given** a user on the registration page
   **When** they click "Sign in with Google/Microsoft"
   **Then** NextAuth handles the OAuth flow successfully
2. **Given** a user who has just authenticated via OAuth
   **When** they are a new user signing up for the first time
   **Then** they are prompted for their Date of Birth
3. **Given** a user entering their Date of Birth
   **When** the Date of Birth indicates they are under 13
   **Then** the system enforces the COPPA parental consent flow or restricts data collection (NFR-SEC1).

## Tasks / Subtasks

- [x] Frontend OAuth Configuration (memora-web)
  - [x] Add Google and/or Microsoft OAuth providers to `[...nextauth]/route.ts`
  - [x] Create a Login page (`src/app/login/page.tsx`) with SSO buttons
- [x] Age Verification & COPPA Flow (memora-web)
  - [x] Intercept first-time logins using a NextAuth callback or middleware
  - [x] Create an onboarding page (`src/app/onboarding/page.tsx`) to collect Date of Birth
  - [x] Implement local validation logic to check if user is < 13 years old
  - [x] Display a "Parental Consent Required" restrictive state for under-13 users
- [x] Backend User Association (memora-api)
  - [x] Ensure NextAuth syncs the OAuth user email to the `users` PostgreSQL table
  - [x] Create an API endpoint (`POST /api/users/onboarding`) to save the Date of Birth to `user_profiles`

## Dev Notes

- **COPPA Implementation:** For this initial story, the COPPA flow can be a simple hard-block or restrictive state page. We just need to legally prevent collection of PII from children without parental consent.
- **NextAuth Integration:** You will need to use mock OAuth providers if you do not have actual Google/Microsoft client IDs in `.env.local`. For implementation/testing, you can add a raw Credentials override or use a mocked OAuth setup so the backend can be tested.
- Keep the `memora-api` return types strictly `camelCase` (from Story 1.1) when returning any auth success/failure JSON.

### Project Structure Notes

- Add frontend pages to `memora-web/src/app/(auth)/login` and `memora-web/src/app/(auth)/onboarding`
- Add backend endpoint to `memora-api/src/handlers/users.rs`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: SSO Registration & COPPA Screening]

## Dev Agent Record

### Agent Model Used

Antigravity Code Assistant

### Debug Log References

- Fixed `useSession` SSR rendering errors by injecting a `<SessionProvider>` wrapper at the root `layout.tsx`.

### Completion Notes List

- Added Google/Github NextAuth providers
- Handled Next.js intercept middleware via `<SessionProvider>` checking the newly attached `needsOnboarding` flag
- Designed the `/login` aesthetic screen with dynamic blobs
- Implemented COPPA compliant `/onboarding` Date of Birth verification
- Implemented Rust `/api/users/onboarding` endpoint with mapped auth JWTs, updating the new user to PostgreSQL tables

### File List
- `memora-web/src/app/api/auth/[...nextauth]/route.ts`
- `memora-web/src/app/(auth)/login/page.tsx`
- `memora-web/src/app/(auth)/onboarding/page.tsx`
- `memora-web/src/middleware.ts`
- `memora-web/src/app/layout.tsx`
- `memora-web/src/components/AppProvider.tsx`
- `memora-api/src/domain/dtos/mod.rs`
- `memora-api/src/handlers/mod.rs`
- `memora-api/src/handlers/users.rs`
- `memora-api/src/main.rs`
