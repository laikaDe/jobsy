# Jobsy

A lean, single-user job application tracker: a dashboard, a Kanban board, one job form, and a Chrome extension that clips postings into it. Runs locally on SQLite, or for free on Vercel + Supabase.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router), TypeScript, Server Components + Server Actions | One process, one deploy, no API boilerplate |
| DB (local) | SQLite file via Prisma | Zero install, file lives in `prisma/dev.db` |
| DB (hosted) | Supabase Postgres free tier via Prisma | Vercel's filesystem is ephemeral — SQLite can't persist there |
| UI | TailwindCSS + shadcn/ui (Radix: Dialog, DropdownMenu, AlertDialog, Select, Sonner toast) | Copy-in components, no runtime UI dependency |
| Drag & drop | `@dnd-kit/core` | Small, accessible, works with touch |
| Validation | `zod` (shared by form + Server Action) | One schema, both sides |
| Tests | `vitest` (analytics, status transitions, validation, API route, extension extraction) | Fast, no browser needed |

### Directory layout

```
app/
  layout.tsx              # SiteHeader (nav + Add job) and <Toaster/>
  page.tsx                # Dashboard (Server Component)
  board/page.tsx          # Kanban (Server Component → <Board/> client)
  actions.ts              # "use server": saveJob, moveJob, deleteJob
  api/jobs/route.ts       # JSON API: POST create, GET lookup by URL
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
  queries.ts              # reads: board jobs, company names, dashboard facts, job by URL
  url.ts                  # normalizeJobUrl() for duplicate lookup
  types.ts                # JobDTO passed to client components
  status.ts               # STATUSES, COLUMNS, applyStatusChange()
  analytics.ts            # pure metric functions
  validation.ts           # zod jobInput schema
  config.ts               # GHOST_AFTER_DAYS parsing
proxy.ts                  # optional Basic auth (Next 16)
extension/                # Chrome extension (MV3, load unpacked, no build)
  manifest.json
  popup.html, popup.js    # clip the current tab into Jobsy
  options.html, options.js  # Jobsy URL + password, test connection
  lib/extract.js          # page → {title, company, url}
  lib/api.js              # fetch wrapper, error classification
  lib/settings.js         # chrome.storage.local settings
prisma/schema.prisma
prisma7.config.ts         # Prisma 7 CLI config: schema path + DATABASE_URL
generated/prisma/         # Prisma client output (gitignored)
tests/                    # vitest: status, validation, analytics, url, API route, extension
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

## Features

### Dashboard

`/` shows five numbers, recomputed from the database on every visit:

- **Total Applied**, **Active Interviews**, **Ghosted / Rejected**: three large tiles.
- **Applied → Interview** and **Avg days in Applied**: two smaller tiles (`—` until there's data).

With no jobs it shows a "No jobs yet" card with an **Add job** button. Definitions are under [Analytics](#analytics).

### Board

`/board` is a four-column Kanban board:

| Column | Statuses | Dropping a card here sets |
|---|---|---|
| Wishlist | `WISHLIST` | `WISHLIST` |
| Applied | `APPLIED` | `APPLIED` |
| Interviewing | `INTERVIEWING` | `INTERVIEWING` |
| Offer / Rejected | `OFFER`, `REJECTED` | asks **Offer** or **Rejected** |

- **Cards** show company, title, days in the current stage, and an Offer / Rejected / Ghosted badge. Offer cards sort before Rejected ones, then most recent change first.
- **Move a card** by dragging it, or with its **⋯ → Move to…** menu (works on touch and keyboard). Dropping on its own column does nothing. Keyboard drag also works: focus a card, press Space, use the arrow keys, then Space to drop.
- **Click a card** to edit it. Each column's **+** opens the form with that column's status already chosen.

How a move works (`components/board/Board.tsx`):

1. Snapshot the current cards.
2. Move the card locally right away (optimistic).
3. Call the `moveJob` server action.
4. On success, the server re-renders the page and the board re-syncs with the fresh data.
5. On failure, restore the snapshot and show "Move not saved — check the database connection."

### Job form

One dialog for adding and editing, opened from the header's **Add job**, a column's **+**, or a card.

| Field | Rules |
|---|---|
| Company * | Required, ≤ 100 chars. Suggests existing companies; matching is case-insensitive, so "acme" reuses "Acme". |
| Title * | Required, ≤ 150 chars |
| URL | Optional, must be a full `http(s)://` URL |
| Status | Wishlist · Applied · Interviewing · Offer · Rejected (default Wishlist, or the column's status) |
| Date applied | Optional. Filled with today when the job first moves to Applied or later. |
| Salary | Optional free text, ≤ 100 chars (e.g. "120–140k") |
| Notes | Optional, ≤ 5000 chars |

Errors appear under each field and the dialog stays open with your input intact. In edit mode, **Delete** asks for confirmation, then removes the job and its interviews (the company is kept).

### API

A small JSON API so tools outside the web UI (like the [Chrome extension](#chrome-extension)) can add jobs. It uses the same validation, company reuse and Date Applied rules as the Job form.

| Request | Response |
|---|---|
| `POST /api/jobs` with a JSON body of form fields (`company`, `title`, `url`, `dateApplied`, `salary`, `status`, `notes`) | `201 {job: {id, title, companyName, status}}` · `400 {error, fieldErrors}` · `500 {error}` |
| `GET /api/jobs?url=<url>` | `200 {job}` or `200 {job: null}` · `400` when `url` isn't http(s) |

The API is create-only: an `id` in the body is ignored. URL lookup ignores `#…`, a trailing `/`, host case and `utm_*` parameters.

```bash
curl -X POST http://localhost:3000/api/jobs -H 'content-type: application/json' \
  -d '{"company":"Acme","title":"Frontend Engineer","url":"https://acme.dev/jobs/1"}'
curl 'http://localhost:3000/api/jobs?url=https://acme.dev/jobs/1'
```

**Auth:** when `APP_PASSWORD` is set, add `-u :<password>` (Basic auth, any username). A wrong or missing password gets `401 {"error": …}` *without* a `WWW-Authenticate` challenge, so browsers never pop up a login dialog for API calls. Pages still get the normal challenge.

## Chrome extension

`extension/` is a small Manifest V3 clipper. Open it on a job posting, check the pre-filled fields, and save the job into Jobsy without leaving the page. It's plain HTML/CSS/JS with no build step.

### Install (load unpacked)

1. Start Jobsy (`npm run dev`, Docker, or your Vercel URL).
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked**, and pick the `extension/` folder.
3. Pin **Jobsy Clipper** from the puzzle-piece menu.
4. Right-click the icon → **Options**:
   - **Jobsy URL:** defaults to `http://localhost:3000`. Use your deployed URL otherwise.
   - **Access password:** only if `APP_PASSWORD` is set.
   - Click **Save**, accept Chrome's permission prompt for that site, then **Test connection**.

After pulling new extension code, click the reload icon on the extension's card in `chrome://extensions`.

### Use

Click the icon on a job posting:

- **Pre-fill:** Company, Title and URL are filled from the page.
  - The popup checks, in order: [`JobPosting`](https://schema.org/JobPosting) structured data, then `og:title` and `og:site_name`, then the page title.
  - Anything it can't find stays empty.
- **Save:** pick **Wishlist** or **Applied**, add notes, and **Save**. Applied fills Date Applied with today, as on the board.
- **Duplicates:** if the page's URL is already in Jobsy, the popup shows **Already in Jobsy** with that job's status. The button becomes **Save anyway**.
- **Errors:**
  - "Can't reach Jobsy", "rejected the password" and "needs permission" each link to Options.
  - Your input is kept so you can retry.

### Permissions

| Permission | Why |
|---|---|
| `activeTab` + `scripting` | Read the current tab's title, meta tags and JSON-LD, only when you click the icon. Nothing runs in the background, and no other pages are read. |
| `storage` | Save the Jobsy URL and password in `chrome.storage.local`. |
| Host access to your Jobsy URL (optional, granted on Save) | Send the job to that one site. The extension never asks for "all websites". |

**About the password:** it's stored unencrypted in this Chrome profile's extension storage and is never synced. Prefer an `https://` Jobsy URL; the options page warns about plain `http://` to another machine.

## Analytics

All numbers are computed on every dashboard load from the jobs table (`lib/analytics.ts`, pure functions covered by `tests/analytics.test.ts`).

| Metric | Definition |
|---|---|
| **Total Applied** | Jobs with a Date Applied, whatever their current status. Wishlist jobs without a date don't count. |
| **Active Interviews** | Jobs whose current status is `INTERVIEWING`. |
| **Ghosted / Rejected** | `REJECTED` jobs + ghosted jobs. |
| **Applied → Interview** | % of applied jobs (with a Date Applied) that have *ever* reached `INTERVIEWING`, one decimal. Jobs that interviewed and later got an offer or a rejection still count. Shows `—` when nothing has been applied to. |
| **Avg days in Applied** | Mean days between Date Applied and the first time a job left `APPLIED`, one decimal. Jobs still in Applied are excluded. Shows `—` when no job has moved on yet. |

**Ghosted rule:** a job is ghosted when its status is `APPLIED` and hasn't changed for at least `GHOST_AFTER_DAYS` days (default 30). It's derived, not stored, so it clears itself as soon as the job moves.

**Timestamps behind the numbers:** each job records when its status last changed, when it *first* left Applied, and when it *first* reached Interviewing. The first-time stamps are never overwritten, so moving a job back and forth doesn't distort the averages. Moving a job to Applied or later fills in Date Applied with today's date if it was empty.

## Deployment

### Environment (`.env.example`)

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

### Option A: local, npm (fastest)

Requires Node 20.9+.

```bash
git clone https://github.com/laikaDe/jobsy.git && cd jobsy
npm run setup     # npm install, creates .env, creates prisma/dev.db, generates the Prisma client
npm run dev       # http://localhost:3000
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm test` | Unit tests (status rules, validation, analytics) |
| `npm run db:push` | Apply `prisma/schema.prisma` to the database and regenerate the client |
| `npm run db:studio` | Browse data in Prisma Studio |

Backup: copy `prisma/dev.db`.

### Option B: local, Docker

```bash
docker build -t jobsy .
docker run -d -p 3000:3000 -v jobsy-data:/data --name jobsy jobsy   # add -e APP_PASSWORD=... to require a password
```

Data lives in the `jobsy-data` volume and survives `docker rm -f jobsy` and rebuilds. Each start runs `prisma db push` against the volume before serving.

<details><summary>Dockerfile</summary>

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

</details>

### Option C: free hosted, Vercel + Supabase

SQLite can't persist on Vercel, so the hosted setup uses Supabase's free Postgres.

1. **Supabase**: create a free project, open **Connect**, and copy the pooled (port 6543) and direct (port 5432) connection strings.
2. **Switch the code to Postgres** and commit:
   - `npm i -E @prisma/adapter-pg@7.10.1`
   - `prisma/schema.prisma`: `provider = "postgresql"`
   - `prisma7.config.ts`: `url: process.env.DIRECT_URL ?? process.env.DATABASE_URL` (the CLI uses the direct connection)
   - `lib/db.ts`: replace the SQLite adapter with
     ```ts
     import { PrismaPg } from "@prisma/adapter-pg";
     // …
     return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
     ```
3. **Vercel**: import the GitHub repo and set the environment variables `DATABASE_URL` (pooled), `DIRECT_URL` (direct), `APP_PASSWORD` (**required**, because the URL is public) and optionally `GHOST_AFTER_DAYS`.
4. Set **Build Command** to `npm run vercel-build` (pushes the schema, generates the client, builds) and deploy.

To go back to local SQLite, revert step 2. Free Supabase projects pause after about a week without use; un-pause them from the Supabase dashboard.
