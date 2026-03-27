# Laptop Store

A full-stack TypeScript e-commerce example (Vite + React frontend, Node backend).

## Overview

- Frontend: Vite + React (client/)
- Backend: Node + Express + tRPC (server/)
- Shared types & utilities: shared/
- Database: Drizzle ORM with SQL migrations (drizzle/)

## Key features

- tRPC-powered API
- Drizzle ORM migrations and schema
- Passport OAuth and JWT auth utilities
- Stripe payments, OpenAI integration, and email templates
- Tailwind CSS and Radix UI components

## Requirements

- Node.js 18+ (or current LTS)
- pnpm (recommended) or npm
- MySQL-compatible database (configured via env)

## Quickstart

1. Install dependencies

```bash
pnpm install
# or
npm install
```

2. Create environment variables (example `.env`)

```
# Database
DATABASE_URL=mysql://user:pass@localhost:3306/dbname

# Auth / OAuth
JWT_SECRET=replace_with_secret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=

# AWS / S3 (if used)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET=

# Stripe / OpenAI
STRIPE_SECRET=
OPENAI_API_KEY=

# Other
NODE_ENV=development
```

3. Run local development (server is started by `dev` script which watches server code)

```bash
pnpm dev
# or
npm run dev
```

4. Typecheck and tests

```bash
pnpm run check
pnpm test
```

5. Build for production

```bash
pnpm run build
```

## Database

- Migrations and schema are in `drizzle/`.
- Use the included scripts in `package.json`:
  - `db:migrate` (runs `migrate.ts`)
  - `db:push` / `db:generate` via `drizzle-kit`.

## Project layout

- `client/` — Vite React application, pages and components.
- `server/` — Node code, API routers, auth, webhooks, and server core logic.
- `shared/` — Shared types and utilities used by both client & server.
- `drizzle/` — Schema, relations, migrations.

## Notable files

- `package.json` — scripts and dependencies
- `tsconfig.json` — TypeScript configuration and path aliases
- `vite.config.ts` — Frontend build config
- `server/_core/index.ts` — Backend entry (dev/server startup)
- `server/routers.ts` — API router setup
- `client/src/lib/trpc.ts` — tRPC client wiring

## Tests & linting

- Tests: `vitest` (run with `pnpm test`).
- Formatting: `prettier --write .` (run with `pnpm run format`).
- Typecheck: `pnpm run check`.

## Deployment notes

- The `build` script runs `vite build` for the frontend and `esbuild` for server bundling into `dist/`.
- Ensure environment variables are set in the hosting environment.
- Run migrations before starting the built server.

## Contributing

See the contributing guide in `docs/CONTRIBUTING.md`.

## License

MIT
