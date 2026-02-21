# Memora

Welcome to the Memora project. This repository contains the complete codebase for the Memora application.

## Project Structure

This project uses a custom hybrid workspace architecture:

- **`memora-web/`**: The Next.js 15 PWA frontend (React, Tailwind CSS).
- **`memora-api/`**: The Rust backend using the Axum web framework and SQLx.

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or higher)
- Rust (latest stable) & Cargo
- PostgreSQL
- `typeshare-cli` (installed automatically by the sync script if missing)

## Development Workflow

### 1. Generating Types (Crucial First Step)

Because the Next.js frontend relies on strict TypeScript interfaces generated from the Rust backend Data Transfer Objects (DTOs), you **must** synchronize the types whenever backend structures change.

Run the sync script from the root of the project:

```bash
./sync.sh
```

This will run `typeshare` and write the generated interfaces to `memora-web/src/types/api.ts`.

### 2. Running the Backend (Memora API)

Navigate to the API directory and run the Cargo development server:

```bash
cd memora-api
cargo run
```

### 3. Running the Frontend (Memora Web)

In a separate terminal, navigate to the web directory and start the Next.js development server:

```bash
cd memora-web
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

## Architecture Notes

- **Data Serialization**: The Rust backend is configured to use strict `camelCase` for all JSON serializations via `#[serde(rename_all = "camelCase")]` bridging the Rust snake_case to JS camelCase.
- **Type Safety**: Rust structs annotated with `#[typeshare]` are automatically synchronized to TypeScript, providing an end-to-end type-safe implementation.
