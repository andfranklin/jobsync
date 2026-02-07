# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

JobSync is a self-hosted job search management app built with Next.js 15 (App Router), React 19, Prisma (SQLite), and NextAuth v5. It tracks job applications, tasks, activities, resumes, and includes AI-powered resume review/job matching via Ollama, OpenAI, or DeepSeek.

## Commands

```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Jest unit tests
npm run test:watch   # Jest watch mode
npm run test:e2e     # Playwright E2E tests (needs dev server running or auto-starts it)
npm run seed         # Seed database with initial data
```

**Run a single unit test:**
```bash
npx jest __tests__/job.actions.spec.ts
```

**Run a single E2E test:**
```bash
npx playwright test e2e/signin.spec.ts
```

**Prisma commands:**
```bash
npx prisma generate              # Regenerate client after schema changes
npx prisma migrate dev --name X  # Create and apply migration
```

## Architecture

### App Structure (Next.js App Router)

- `src/app/(auth)/` - Auth pages (signin)
- `src/app/dashboard/` - Protected routes: myjobs, tasks, activities, profile, settings, admin, developer
- `src/app/api/` - API routes for auth, AI endpoints, jobs export, profile/resume
- `src/middleware.ts` - Route protection; guards `/dashboard` and `/dashboard/*`

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

### Auth

NextAuth v5 (beta) with Credentials provider. Config split across:
- `src/auth.ts` - Provider setup with bcrypt password comparison
- `src/auth.config.ts` - Callbacks for JWT/session
- `src/middleware.ts` - Route matcher

`getCurrentUser()` helper in `src/utils/user.utils.ts` retrieves the authenticated user.

### AI Integration

- Providers configured in `src/lib/ai/providers.ts` (Ollama default, OpenAI, DeepSeek)
- System prompts in `src/lib/ai/prompts/`
- Rate limiting: 5 requests/min per user (`src/lib/ai/rate-limiter.ts`)
- API routes: `src/app/api/ai/resume/review/` and `src/app/api/ai/resume/match/`

### Import Alias

`@/` maps to `src/` (configured in tsconfig.json).

## Testing

- **Unit tests** (`__tests__/*.spec.{ts,tsx}`) - Jest + React Testing Library. Mocks for NextAuth and next/navigation are in `__mocks__/`. The jest config (`jest.config.ts`) excludes the `e2e/` directory.
- **E2E tests** (`e2e/*.spec.ts`) - Playwright. Configured to auto-start dev server. Tests run against Chromium, Firefox, and WebKit.

## Environment Setup

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` - SQLite path (default: `file:./dev.db`)
- `USER_EMAIL` / `USER_PASSWORD` - Default user credentials for seeding
- `TZ` - Timezone (important for activity time tracking)
- `AUTH_SECRET` - Generate with `openssl rand -base64 33`
- `NEXTAUTH_URL` - App URL (http://localhost:3000)
- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `OLLAMA_BASE_URL` - AI provider config (all optional)
