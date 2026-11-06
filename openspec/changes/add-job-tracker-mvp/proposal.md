# Proposal

## Why

Job hunting across spreadsheets, bookmarks, and email threads loses track of where each application stands and hides basic signals (am I getting interviews? how long do companies sit on applications?). A lean, single-user tracker that runs locally or on a free tier fixes this with near-zero setup and no enterprise overhead.

## What Changes

- New greenfield Next.js (App Router) app with Server Actions, Prisma, SQLite (local) / Supabase Postgres (free-tier hosted), Tailwind + shadcn/ui.
- Data model: `Company`, `Job`, `Interview` with straightforward 1-to-many relations.
- **Dashboard view** (`/`): three stat tiles — Total Applied, Active Interviews, Ghosted/Rejected — plus two analytics figures (Application → Interview conversion rate, average days in Applied).
- **Kanban view** (`/board`): four columns (Wishlist → Applied → Interviewing → Offer/Rejected), drag-and-drop plus a click-to-move menu, optimistic local state with rollback on failure.
- **Job form** (modal, used from board and dashboard): add/edit Company, Title, URL, Date Applied, Salary, Status, Notes.
- Pure TypeScript analytics functions, unit-tested.
- Deployment: `npm` scripts for local, a `Dockerfile` for local container, and a free Vercel + Supabase path. `.env.example` documented.
- Optional single-password gate (`APP_PASSWORD`) so a public Vercel URL isn't open to the world.
- `README.md` doubling as the project spec.

**Out of scope**: multi-user accounts, RBAC, multi-tenancy, audit logging, email/calendar integrations, interview-management UI (the `Interview` table exists in the schema but has no MVP screens), file uploads, mobile apps.

## Capabilities

### New Capabilities
- `job-records`: Creating, editing, deleting, and validating job entries and their companies, including status-transition timestamp bookkeeping.
- `pipeline-board`: The Kanban board — column mapping, moving jobs between stages, and local state behavior during moves.
- `application-analytics`: Dashboard metrics and derived analytics (counts, ghosted rule, conversion rate, average days in Applied).

### Modified Capabilities
_None — greenfield project._

## Impact

- New codebase at repo root (`app/`, `components/`, `lib/`, `prisma/`).
- Dependencies: `next`, `react`, `prisma`/`@prisma/client`, `tailwindcss`, shadcn/ui (Radix), `@dnd-kit/core`, `zod`, `vitest`.
- External services (optional): Vercel Hobby, Supabase free tier.
