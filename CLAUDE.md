# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobSync is a self-hosted, single-user job search management app built with Next.js 15 (App Router), React 19, and Prisma (SQLite). It tracks job applications, tasks, activities, resumes, and includes AI-powered resume review/job matching via Ollama, OpenAI, or DeepSeek. There is no authentication — the app serves a single local user.

## Running the App

The primary way to run JobSync is via Docker. Running with `npm run dev` directly requires manual setup (see below).

### Docker (recommended)

```bash
docker compose up          # Build and start the app on port 3000
docker compose up --build  # Rebuild after code changes
docker compose down        # Stop the app
```

Docker automatically handles database migrations, seeding, and environment configuration. The SQLite database is persisted at `./jobsyncdb/data/dev.db` via a volume mount.

### Local Development (without Docker)

Running outside Docker requires these prerequisites:

1. Copy `.env.example` to `.env` and set `DATABASE_URL=file:./dev.db`
2. `npm install`
3. `npx prisma generate`
4. `npx prisma migrate dev` to create the database and apply migrations
5. `npm run seed` to seed initial data

Then start the dev server:

```bash
npm run dev  # Dev server on port 3000 (requires prerequisites above)
```

## Commands

### Safe to run without Docker or database

```bash
npm run lint         # ESLint
npm test             # Jest unit tests (fully mocked, no database needed)
npm run test:watch   # Jest watch mode
```

### Require local setup or running Docker container

```bash
npm run dev          # Dev server (requires local prerequisites, see above)
npm run build        # Production build (requires npx prisma generate first)
npm run seed         # Seed database with initial data
npm run test:e2e     # Playwright E2E tests (see Testing section warning)
```

**Run a single unit test:**
```bash
npx jest __tests__/job.actions.spec.ts
```

**Run a single E2E test:**
```bash
npx playwright test e2e/tasks.spec.ts
```

**Prisma commands:**
```bash
npx prisma generate              # Regenerate client after schema changes
npx prisma migrate dev --name X  # Create and apply migration
```

## Architecture

### App Structure (Next.js App Router)

- `src/app/dashboard/` - Main routes: myjobs, tasks, activities, profile, settings, admin, developer
- `src/app/api/` - API routes for AI endpoints, jobs export, profile/resume

### Data Layer

- **Server Actions** (`src/actions/*.actions.ts`) - All data mutations. Each domain has its own file (job, task, activity, profile, company, etc.). These use `"use server"` and call Prisma directly.
- **Prisma schema** (`prisma/schema.prisma`) - SQLite database. Key models: User, Job, Task, Activity, Resume, Profile, Company, JobTitle, Location, JobSource, JobStatus, ActivityType.
- **Prisma singleton** (`src/lib/db.ts`) - Single Prisma client instance.

### Component Patterns

- **Server Components** are the default (async, direct data fetching).
- **Client Components** use `"use client"` directive for interactivity/hooks.
- **UI primitives** in `src/components/ui/` are Shadcn/ui (Radix UI + Tailwind).
- **Feature components** organized by domain: `src/components/myjobs/`, `src/components/activities/`, `src/components/dashboard/`, `src/components/profile/`, etc.

### Validation

Zod schemas in `src/models/*.schema.ts` handle form and API validation. Models/interfaces live in `src/models/*.model.ts`.

### User

Single-user app with no authentication. `getCurrentUser()` in `src/utils/user.utils.ts` returns the first (and only) user from the database via `prisma.user.findFirst()`.

### AI Integration

- Providers configured in `src/lib/ai/providers.ts` (Ollama default, OpenAI, DeepSeek)
- System prompts in `src/lib/ai/prompts/`
- Rate limiting: 5 requests/min per user (`src/lib/ai/rate-limiter.ts`)
- API routes: `src/app/api/ai/resume/review/` and `src/app/api/ai/resume/match/`

### Import Alias

`@/` maps to `src/` (configured in tsconfig.json).

## Testing

- **Unit tests** (`__tests__/*.spec.{ts,tsx}`) - Jest + React Testing Library. All dependencies (Prisma, next/navigation) are fully mocked. These tests are safe to run at any time and do not touch any database. Mocks are in `__mocks__/`. The jest config (`jest.config.ts`) excludes the `e2e/` directory.

- **E2E tests** (`e2e/*.spec.ts`) - Playwright. Configured to auto-start a dev server on port 3001 (separate from Docker on 3000). Tests run against Chromium only.
  - E2E tests use a **separate test database** at `prisma/test-e2e.db` (not `jobsyncdb/`). The database is created on first run via `playwright.config.ts` and data is cleared/reseeded via `e2e/global-setup.ts` on each run.
  - E2E tests require `npx prisma generate` to have been run at least once.

## Environment Setup

Copy `.env.example` to `.env`. Docker Compose reads variables from this file.

Key variables:
- `DATABASE_URL` - SQLite path. Docker overrides this to `file:/data/dev.db`. For local (non-Docker) development, set to `file:./dev.db`.
- `USER_EMAIL` - Email for the single local user (default: admin@example.com)
- `TZ` - Timezone (important for activity time tracking)
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `OLLAMA_BASE_URL` - AI provider config (all optional)
