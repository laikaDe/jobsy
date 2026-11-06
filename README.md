# Jobsy

A lean, single-user job application tracker: a dashboard, a Kanban board, and one job form. Runs locally on SQLite, or for free on Vercel + Supabase.

## Tech Stack

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
  layout.tsx              # nav: Dashboard | Board, <Toaster/>
  page.tsx                # Dashboard (Server Component)
  board/page.tsx          # Kanban (Server Component → <Board/> client)
  actions.ts              # "use server": saveJob, moveJob, deleteJob
components/
  board/Board.tsx         # client: DndContext + optimistic state
  board/Column.tsx
  board/JobCard.tsx       # card + "Move to…" DropdownMenu
  job-form/JobFormDialog.tsx
  dashboard/StatTile.tsx
  ui/                     # shadcn generated
lib/
  db.ts                   # PrismaClient singleton
  status.ts               # STATUSES, COLUMNS, applyStatusChange()
  analytics.ts            # pure metric functions
  validation.ts           # zod jobInput schema
  config.ts               # GHOST_AFTER_DAYS parsing
proxy.ts                  # optional Basic auth (Next 16)
prisma/schema.prisma
prisma7.config.ts         # Prisma 7 CLI config: schema path + DATABASE_URL
generated/prisma/         # Prisma client output (gitignored)
tests/analytics.test.ts
tests/status.test.ts
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

### Board

### Job form

## Analytics

## Deployment
