# Design

## Context

- Greenfield: the repo holds only `openspec/`. No existing code, conventions, or specs to reconcile.
- Single user, local-first or free tier. Motivation: see `proposal.md` → Why. Behavior contract: see `specs/job-records`, `specs/pipeline-board`, `specs/application-analytics`.
- Sections 1–4 below are written to be lifted verbatim into `README.md` (each task group fills its README section).

## Goals / Non-Goals

**Goals:**
- `git clone && npm run setup && npm run dev` works in under 2 minutes with zero external accounts.
- One data-access path (Server Actions + Prisma), no separate API layer, no client-side data library.
- Analytics are pure functions over plain job objects — trivially unit-testable.

**Non-Goals:**
- Accounts, sessions, RBAC, tenancy, audit logs, rate limiting.
- Migration history (`prisma migrate`) — `prisma db push` is enough for a one-person schema.
- Interview CRUD UI (table exists for later), charts, search, CSV import/export.

---

## 1. Architectural Simplicity & Tech Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router), TypeScript, Server Components + Server Actions | One process, one deploy, no API boilerplate |
| DB (local) | SQLite file via Prisma | Zero install, file lives in `prisma/dev.db` |
| DB (hosted) | Supabase Postgres free tier via Prisma | Vercel's filesystem is ephemeral — SQLite can't persist there |
| UI | TailwindCSS + shadcn/ui (Radix: Dialog, DropdownMenu, AlertDialog, Select, Sonner toast) | Copy-in components, no runtime UI dependency |
| Drag & drop | `@dnd-kit/core` | Small, accessible, works with touch |
| Validation | `zod` (shared by form + Server Action) | One schema, both sides |
| Tests | `vitest` (analytics + status transitions only) | Fast, no browser needed |

### Directory layout

```
app/
  layout.tsx              # SiteHeader (nav + Add job) and <Toaster/>
  page.tsx                # Dashboard (Server Component)
  board/page.tsx          # Kanban (Server Component → <Board/> client)
  actions.ts              # "use server": saveJob, moveJob, deleteJob
components/
  SiteHeader.tsx          # nav + global Add job (reads company names)
  NavLinks.tsx
  board/Board.tsx         # client: DndContext + optimistic state
  board/Column.tsx
  board/JobCard.tsx       # card + "Move to…" DropdownMenu
  job-form/JobFormDialog.tsx
  job-form/AddJobButton.tsx
  dashboard/StatTile.tsx
  ui/                     # shadcn generated
lib/
  db.ts                   # PrismaClient singleton (better-sqlite3 adapter)
  jobs.ts                 # writes: upsertJob, setJobStatus, removeJob, company reuse
  queries.ts              # reads: board jobs, company names, dashboard facts
  types.ts                # JobDTO passed to client components
  status.ts               # STATUSES, COLUMNS, applyStatusChange()
  analytics.ts            # pure metric functions
  validation.ts           # zod jobInput schema
  config.ts               # GHOST_AFTER_DAYS parsing
proxy.ts                  # optional Basic auth (Next 16)
prisma/schema.prisma
prisma7.config.ts         # Prisma 7 CLI config: schema path + DATABASE_URL
generated/prisma/         # Prisma client output (gitignored)
tests/                    # vitest: status, validation, analytics
```

### Data schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"   // gitignored; import from "@/generated/prisma/client"
}

datasource db {
  provider = "sqlite"   // switch to "postgresql" for Supabase (see §4)
  // Prisma 7: no url here — it lives in prisma7.config.ts (datasource.url = env DATABASE_URL)
}

model Company {
  id        String   @id @default(cuid())
  name      String   @unique   // stored trimmed; matched case-insensitively in app code
  jobs      Job[]
  createdAt DateTime @default(now())
}

model Job {
  id               String      @id @default(cuid())
  title            String
  url              String?
  salary           String?     // free text: "120–140k", "€55k + equity"
  notes            String?
  status           String      @default("WISHLIST") // WISHLIST|APPLIED|INTERVIEWING|OFFER|REJECTED
  dateApplied      DateTime?
  statusChangedAt  DateTime    @default(now())
  leftAppliedAt    DateTime?   // first exit from APPLIED — never overwritten
  firstInterviewAt DateTime?   // first entry to INTERVIEWING — never overwritten
  companyId        String
  company          Company     @relation(fields: [companyId], references: [id])
  interviews       Interview[]
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  @@index([status])
}

model Interview {
  id          String   @id @default(cuid())
  jobId       String
  job         Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  scheduledAt DateTime
  kind        String?  // "phone", "technical", "onsite"…
  notes       String?
  createdAt   DateTime @default(now())
}
```

Relationships: `Company 1—* Job 1—* Interview`. Deleting a Job cascades Interviews; Companies are never auto-deleted.

**Decision — `status` as `String`, not a Prisma `enum`:** keeps the schema identical across SQLite and Postgres. The allowed set is enforced by `zod` and a TS union. *Alternative:* native enum — rejected, provider-specific behavior isn't worth it here.

**Decision — three timestamp columns instead of a status-history table:** the two analytics only need "first left Applied" and "ever interviewed". *Alternative:* `StatusChange` log table — more flexible, but more writes, joins, and code for no MVP benefit. Easy to add later.

### Status rules (`lib/status.ts`)

```ts
export const STATUSES = ["WISHLIST", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;
export type Status = (typeof STATUSES)[number];

export const COLUMNS = [
  { id: "wishlist",     title: "Wishlist",         statuses: ["WISHLIST"],          dropStatus: "WISHLIST" },
  { id: "applied",      title: "Applied",          statuses: ["APPLIED"],           dropStatus: "APPLIED" },
  { id: "interviewing", title: "Interviewing",     statuses: ["INTERVIEWING"],      dropStatus: "INTERVIEWING" },
  { id: "closed",       title: "Offer / Rejected", statuses: ["OFFER", "REJECTED"], dropStatus: "OFFER" },
] as const;

type Stamps = { status: Status; dateApplied: Date | null; leftAppliedAt: Date | null; firstInterviewAt: Date | null };

/** Pure: returns the DB patch for a status change. Used by both saveJob and moveJob. */
export function applyStatusChange(job: Stamps, next: Status, now = new Date()) {
  if (job.status === next) return {};
  const patch: Partial<Stamps> & { statusChangedAt: Date; status: Status } = { status: next, statusChangedAt: now };
  if (next !== "WISHLIST" && !job.dateApplied) patch.dateApplied = startOfDay(now);
  if (job.status === "APPLIED" && !job.leftAppliedAt) patch.leftAppliedAt = now;
  if (next === "INTERVIEWING" && !job.firstInterviewAt) patch.firstInterviewAt = now;
  return patch;
}
```

Edge case: a job created directly as `INTERVIEWING` (skipping Applied) gets `dateApplied` + `firstInterviewAt` but no `leftAppliedAt` → counts toward conversion, excluded from avg-days. Correct by spec.

---

## 2. Core MVP Feature Specification

### Server Actions (`app/actions.ts`)

| Action | Input | Behavior | Returns |
|---|---|---|---|
| `saveJob(formData)` | zod `jobInput` (+ optional `id`) | Upsert company by trimmed, case-insensitive name → create/update job → `applyStatusChange` if status changed → `revalidatePath("/")` + `("/board")` | `{ ok: true, job }` or `{ ok: false, fieldErrors }` |
| `moveJob(id, status)` | `id: string`, `status: Status` | Load job → `applyStatusChange` → update → revalidate | `{ ok: true }`; **throws** on failure (triggers rollback) |
| `deleteJob(id)` | `id` | Delete job (interviews cascade) → revalidate | `{ ok: true }` |

Company matching: SQLite `=` is case-sensitive and Prisma's `mode: "insensitive"` is Postgres-only, so look up with `findFirst` over a normalized comparison done in app code: fetch `where: { name: { equals: trimmed } }`, else scan `findMany({ select: { id, name } })` for `name.toLowerCase() === trimmed.toLowerCase()`. Fine at personal scale (tens of companies).

### 2a. Dashboard View (`/`)

- Server Component. One query: `prisma.job.findMany({ select: { status, dateApplied, statusChangedAt, leftAppliedAt, firstInterviewAt } })` → `computeDashboard(jobs, now, ghostDays)` (§3).
- Layout: `grid grid-cols-1 sm:grid-cols-3 gap-4` of `StatTile` (label, big number). Below: a second row with two smaller tiles — "Applied → Interview" (`30.0%`) and "Avg days in Applied" (`7.0`), `—` when null.
- Empty state (0 jobs): tiles show `0`, plus a card "No jobs yet" with an **Add job** button opening `JobFormDialog`.
- No client JS beyond the dialog trigger. Always fresh because actions call `revalidatePath("/")`.

### 2b. Kanban View (`/board`)

- `board/page.tsx` (server) loads all jobs with `company.name`, ordered `statusChangedAt desc`, passes plain serializable objects (dates as ISO strings) to `<Board initialJobs={…} ghostDays={…} />`.
- `Board` (client) renders four `Column`s from `COLUMNS`. Each column filters jobs by `col.statuses`; the closed column sorts `OFFER` before `REJECTED`, then by `statusChangedAt desc`.
- `JobCard`: company (bold), title, `Nd` in stage (`daysBetween(statusChangedAt, now)`), badge `Offer` / `Rejected` / `Ghosted` (via `isGhosted`). Click → edit dialog. `⋯` button → `DropdownMenu` "Move to…" with the other four statuses (click-to-move; keyboard/touch fallback).
- Drag: `DndContext` with `PointerSensor` (`activationConstraint: { distance: 6 }` so clicks still open the card) and `KeyboardSensor`. `onDragEnd`: resolve target column → if it's `closed`, open a tiny AlertDialog "Offer or Rejected?" (default Offer) → `move(id, status)`. Same column → no-op.

**Local state update on column change (optimistic + rollback):**

```tsx
"use client";
const [jobs, setJobs] = useState(initialJobs);
useEffect(() => setJobs(initialJobs), [initialJobs]); // re-sync after revalidatePath

async function move(id: string, next: Status) {
  const prev = jobs;                                   // 1. snapshot
  const job = prev.find(j => j.id === id);
  if (!job || job.status === next) return;
  setJobs(prev.map(j => j.id === id                    // 2. optimistic: card jumps now
    ? { ...j, status: next, statusChangedAt: new Date().toISOString() }
    : j));
  try {
    await moveJob(id, next);                           // 3. persist (server action)
    // 4. success: revalidatePath re-renders the server page → new initialJobs → effect re-syncs
  } catch {
    setJobs(prev);                                     // 5. rollback to snapshot
    toast.error("Move not saved — check the database connection.");
  }
}
```

*Why `useState` + snapshot over `useOptimistic`:* `useOptimistic` drops the optimistic value the moment the transition settles; drag-and-drop libraries expect stable state between drop and re-render, and an explicit snapshot makes the rollback path obvious. Either works; this one is easier to read and test.

### 2c. Job Form View (`JobFormDialog`)

- shadcn `Dialog`, used from dashboard ("Add job"), board header ("Add job"), column "+" (pre-sets status), and card click (edit, pre-filled).
- Fields:

| Field | Control | Rule |
|---|---|---|
| Company | `Input` + `<datalist>` of existing company names | required, trimmed, 1–100 chars |
| Title | `Input` | required, 1–150 chars |
| URL | `Input type=url` | optional; `z.string().url()` restricted to http/https |
| Date Applied | `Input type=date` | optional; auto-filled server-side when status ≥ APPLIED |
| Salary | `Input` | optional free text, ≤ 100 chars |
| Status | `Select` (5 statuses) | default `WISHLIST` or column's status |
| Notes | `Textarea` | optional, ≤ 5000 chars |

- Submit: `<form action={…}>` calling `saveJob` via `useActionState`; pending state disables the Save button. `fieldErrors` render under each field; dialog stays open on error, closes + `toast.success("Saved")` on success.
- Edit mode adds a **Delete** button → `AlertDialog` confirm → `deleteJob`.
- Same zod `jobInput` schema runs client-side (on blur/submit) and in the action — server is authoritative.

### Optional password gate (`proxy.ts`)

```ts
export function proxy(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  const [, b64] = (req.headers.get("authorization") ?? "").split(" ");
  const [, given] = atob(b64 ?? "").split(":");
  if (given === pw) return NextResponse.next();
  return new NextResponse("Auth required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="jobsy"' } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
```

Covers Server Actions too (they POST to the page route). Username is ignored.

---

## 3. Local Analytics Logic (`lib/analytics.ts`)

```ts
import type { Status } from "./status";

export type JobFacts = {
  status: Status;
  dateApplied: Date | null;
  statusChangedAt: Date;
  leftAppliedAt: Date | null;
  firstInterviewAt: Date | null;
};

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

export const daysBetween = (from: Date, to: Date) =>
  Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);

export const isGhosted = (j: JobFacts, now: Date, ghostDays = 30) =>
  j.status === "APPLIED" && daysBetween(j.statusChangedAt, now) >= ghostDays;

/** % of applied jobs that ever reached INTERVIEWING. null when nothing applied. */
export function applicationToInterviewRate(jobs: JobFacts[]): number | null {
  const applied = jobs.filter(j => j.dateApplied !== null);
  if (applied.length === 0) return null;
  const interviewed = applied.filter(j => j.firstInterviewAt !== null).length;
  return round1((interviewed / applied.length) * 100);
}

/** Mean days from dateApplied to first exit from APPLIED. null when no job has exited. */
export function averageDaysInApplied(jobs: JobFacts[]): number | null {
  const spans = jobs
    .filter(j => j.dateApplied && j.leftAppliedAt)
    .map(j => daysBetween(j.dateApplied!, j.leftAppliedAt!));
  if (spans.length === 0) return null;
  return round1(spans.reduce((a, b) => a + b, 0) / spans.length);
}

export function computeDashboard(jobs: JobFacts[], now = new Date(), ghostDays = 30) {
  return {
    totalApplied:     jobs.filter(j => j.dateApplied !== null).length,
    activeInterviews: jobs.filter(j => j.status === "INTERVIEWING").length,
    ghostedOrRejected:
      jobs.filter(j => j.status === "REJECTED").length +
      jobs.filter(j => isGhosted(j, now, ghostDays)).length,
    conversionRate:   applicationToInterviewRate(jobs),
    avgDaysInApplied: averageDaysInApplied(jobs),
  };
}
```

Notes:
- `dateApplied` is a calendar date (midnight) while `leftAppliedAt` is a timestamp → fractional days. Rounded to one decimal; acceptable.
- A user-edited `dateApplied` later than `leftAppliedAt` yields a negative span; `daysBetween` clamps to 0.
- Tests (`tests/analytics.test.ts`) mirror every scenario in `specs/application-analytics/spec.md`.

---

## 4. 1-Click Deployment Setup

### `.env.example`

```bash
# ── Database ──────────────────────────────────────────────
# Local (SQLite, default). Path is relative to the project root (Prisma 7).
DATABASE_URL="file:./prisma/dev.db"

# Hosted (Supabase Postgres). Use the *pooled* connection string (port 6543) here…
# DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
# …and the *direct* one (port 5432) here. Only needed with provider = "postgresql".
# DIRECT_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres"

# ── App ───────────────────────────────────────────────────
# Leave empty for no login (fine locally). SET THIS on any public deployment.
APP_PASSWORD=""

# Days an APPLIED job can sit unchanged before it counts as "ghosted".
GHOST_AFTER_DAYS="30"
```

### `package.json` scripts

```json
{
  "scripts": {
    "setup":     "npm install && cp -n .env.example .env; prisma db push && prisma generate",
    "dev":       "next dev",
    "build":     "prisma generate && next build",
    "start":     "next start",
    "lint":      "eslint",
    "db:push":   "prisma db push && prisma generate",
    "db:studio": "prisma studio --url \"file://$PWD/prisma/dev.db\"",
    "test":      "vitest run --passWithNoTests",
    "vercel-build": "prisma db push && prisma generate && next build"
  }
}
```

Prisma 7: `db push` no longer runs `generate`, so the scripts chain both explicitly. `prisma7.config.ts` loads `.env` via `import "dotenv/config"`, because Prisma no longer reads `.env` on its own. `db:studio` passes an absolute `file://` URL because Prisma Studio 7.10.1 picks the database type from the text before `://`, so it rejects the relative `file:./prisma/dev.db` that the app and `db push` accept. On Supabase, run plain `prisma studio`.

### Option A — Local, npm (fastest)

```bash
git clone <repo> jobsy && cd jobsy
npm run setup     # installs, creates .env, creates prisma/dev.db
npm run dev       # http://localhost:3000
```

Backup = copy `prisma/dev.db`.

### Option B — Local, Docker

`Dockerfile`:

```dockerfile
# Local, single-container Jobsy with SQLite persisted in a volume at /data.
FROM node:24-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# lib/db.ts requires DATABASE_URL at import time; nothing connects during the build.
ENV DATABASE_URL="file:/data/jobsy.db"
RUN npm run build

FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production DATABASE_URL="file:/data/jobsy.db"
COPY --from=build /app ./
VOLUME /data
EXPOSE 3000
# Create/upgrade the schema in the volume, then serve. The Prisma client was generated at build time.
CMD ["sh", "-c", "npx prisma db push && npm start"]
```

```bash
docker build -t jobsy .
docker run -d -p 3000:3000 -v jobsy-data:/data --name jobsy jobsy
```

Data persists in the `jobsy-data` volume across rebuilds.

### Option C — Free hosted: Vercel + Supabase

1. **Supabase** → New project (free) → *Connect* → copy the pooled (6543) and direct (5432) URIs.
2. Switch to Postgres and commit:
   - `prisma/schema.prisma`: `provider = "postgresql"`.
   - `prisma7.config.ts`: `datasource.url = process.env.DIRECT_URL ?? process.env.DATABASE_URL`, so the CLI (`db push`) uses the direct connection.
   - `lib/db.ts`: use `@prisma/adapter-pg` with the pooled `DATABASE_URL` instead of the SQLite adapter.
3. **Vercel** → Import the Git repo → Environment Variables: `DATABASE_URL`, `DIRECT_URL`, `APP_PASSWORD` (**required** — the URL is public), `GHOST_AFTER_DAYS`.
4. Build Command: `npm run vercel-build`. Deploy.

To go back to local SQLite, revert step 2. (Task 2.1 can make `lib/db.ts` choose the adapter from the `DATABASE_URL` scheme, which turns this step into a one-line schema edit.)

---

## Risks / Trade-offs

- [Provider switch is a manual schema edit] → Documented in §4 Option C; one 3-line change. A two-file setup was rejected as model duplication.
- [`prisma db push` on every Vercel build can drop columns on destructive schema changes] → Prisma refuses data-loss pushes without `--accept-data-loss`; build fails loudly instead. Adopt `prisma migrate` if the schema ever gets risky.
- [Supabase free projects pause after ~1 week idle] → First request after a pause fails; un-pause from the Supabase dashboard. Acceptable for personal use.
- [Basic auth is minimal] → Over HTTPS (Vercel default) it's adequate for one person; not intended as real account security.
- [Prisma / Next major-version drift] → **Recorded at scaffold (task 1.1, 2026-11-05):**
  - **Next.js 16.4.5 / React 19.3.0** → use `proxy.ts` (not `middleware.ts`). The scaffold enables `cacheComponents: true`, so the dashboard and board pages must read data dynamically (e.g. inside `<Suspense>`, or by calling `connection()` before the Prisma query) so they never serve stale numbers. Check `node_modules/next/dist/docs/` before writing Next APIs.
  - **Prisma: pin `prisma@7.10.1` + `@prisma/client@7.10.1`.** npm's `latest` tag for the `prisma` CLI currently points to `8.0.0-rc.30`, so a bare `npm i prisma` would pull a release candidate that doesn't match the client. With Prisma 7, the datasource URL moves to `prisma.config.ts` (the `url = env(...)` line leaves `schema.prisma`), and `lib/db.ts` needs a driver adapter: `@prisma/adapter-better-sqlite3` for SQLite, `@prisma/adapter-pg` for Supabase.
- [Ghosted is derived, not stored] → No way to mark a job ghosted manually or un-ghost it except by moving it. Fine for MVP; it auto-clears when the job moves.
- [Case-insensitive company match scans all companies] → O(n) at personal scale (< 1k rows) is negligible.

## Migration Plan

Greenfield — nothing to migrate. Rollback = revert the commit; SQLite data stays in `prisma/dev.db` or the Docker volume.
