# Architecture Overview

This document gives a concise architecture map for the repository.

## High-level

- Single repository monorepo-style layout with a clear client/server/shared split.
- Frontend (`client/`) is a Vite + React application using Tailwind and Radix UI components.
- Backend (`server/`) is Node + Express + tRPC; business logic, auth, and integratons live here.
- `shared/` contains TypeScript types and small helpers used by both sides.
- Drizzle ORM manages the database schema and SQL migrations in `drizzle/`.

## Data flow

1. User interacts with the React frontend.
2. Frontend calls tRPC endpoints (`client/src/lib/trpc.ts`) or conventional REST/webhook endpoints.
3. Server routers (defined in `server/routers.ts`) dispatch to business logic in `server/_core`.
4. Server persists and queries via Drizzle ORM and `server/db.ts` (or similar DB layer).
5. Integrations (Stripe, OpenAI, S3, email) are invoked from server-side code.

## Key modules

- `client/src/main.tsx` — frontend entry
- `client/src/pages/*` & `client/src/components/*` — UI and pages
- `client/src/lib/trpc.ts` — tRPC hook/wiring
- `server/_core/index.ts` — server bootstrap & dev watch
- `server/routers.ts` — registers API endpoints
- `server/webhooks.ts` — payment/webhook handlers
- `drizzle/schema.ts` & `drizzle/migrations/` — DB schema & migrations

## Authentication

- Passport-based OAuth strategies live in `server/` (passport/google, passport/facebook).
- JWT handling and `JWT_SECRET` usage appear in server auth helper files.

## Recommendations for contributors

- Follow `tsconfig.json` paths for imports (`@/*` and `@shared/*`).
- Keep shared types in `shared/` to avoid duplication.
- Add DB migrations to `drizzle/migrations/` and test them locally.
- Run `pnpm run check` before opening PRs.
