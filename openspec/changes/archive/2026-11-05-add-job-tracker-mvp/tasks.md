# Tasks

## 1. Scaffold

- [x] 1.1 Run `create-next-app` (TypeScript, App Router, Tailwind, ESLint, no `src/`) at repo root without clobbering `openspec/`/`.claude/`; record installed Next and Prisma majors and apply the version notes in design.md → Risks (`proxy.ts` vs `middleware.ts`, Prisma 7 config/adapter). Verify `npm run dev` serves the starter page on :3000
- [x] 1.2 Install `prisma@7.10.1 @prisma/client@7.10.1 zod @dnd-kit/core sonner` and dev `vitest`; `npx shadcn init` and add `button card dialog alert-dialog dropdown-menu input textarea select label badge sonner`. Verify `npm run build` passes
- [x] 1.3 Add `.env.example` exactly as in design §4, `.gitignore` entries for `.env` and `prisma/*.db*`, and the `package.json` scripts from design §4. Verify `cp .env.example .env` and `npm run test` (no tests yet) exit 0
- [x] 1.4 Create `README.md` with design §1 (stack, layout, schema) and empty headings for Features, Analytics, Deployment. Verify it renders the schema block correctly

## 2. Data layer

- [x] 2.1 Write `prisma/schema.prisma` (Company, Job, Interview) from design §1, `prisma7.config.ts` (`import "dotenv/config"`, `datasource.url`), and `lib/db.ts` PrismaClient singleton using `@prisma/adapter-better-sqlite3`; install `dotenv` + the adapter (pinned to 7.10.1) and change the `build` script to `prisma generate && next build`. Verify `npm run build` still passes, `npm run db:push` creates `prisma/dev.db` and `npm run db:studio` shows three tables
- [x] 2.2 Implement `lib/status.ts` (`STATUSES`, `COLUMNS`, `applyStatusChange`) and `tests/status.test.ts` covering spec job-records → Stage timestamps and Date Applied auto-fill scenarios (incl. move-back does not reset, existing date kept, same-status no-op). Verify `npm run test` passes
- [x] 2.3 Implement `lib/validation.ts` zod `jobInput` (required Company/Title, http/https URL, length limits, status enum) and `lib/config.ts` (`GHOST_AFTER_DAYS`, default 30). Add tests for "Unknown status rejected", "Missing required field", "Invalid URL". Verify `npm run test` passes
- [x] 2.4 Implement `app/actions.ts`: `saveJob` (case-insensitive trimmed company reuse, `applyStatusChange` on status change), `moveJob` (throws on failure), `deleteJob` (cascade interviews, keep company), each calling `revalidatePath("/")` and `("/board")`. Verify via a quick script or Studio: saving " acme " twice reuses one Company; deleting a job leaves its Company

## 3. Analytics

- [x] 3.1 Implement `lib/analytics.ts` exactly per design §3 (`daysBetween`, `isGhosted`, `applicationToInterviewRate`, `averageDaysInApplied`, `computeDashboard`)
- [x] 3.2 Add `tests/analytics.test.ts` with one test per scenario in `specs/application-analytics/spec.md` (empty DB, rejected still counts as applied → 5, active interviews → 2, 31d ghosted / 10d not, combined → 3, conversion 30.0% and null, avg 7.0 and null, negative span clamps to 0). Verify `npm run test` passes
- [x] 3.3 Fill README "Analytics" section with the metric definitions and the ghosted rule. Verify definitions match the spec wording

## 4. Job form

- [x] 4.1 Build `components/job-form/JobFormDialog.tsx`: seven fields per design §2c, company `<datalist>`, `useActionState` with `saveJob`, inline `fieldErrors`, pending-disabled Save, success toast + close, `defaultStatus` and `job` (edit) props. Verify manually: create, edit pre-fills, empty Title and `not-a-url` show inline errors with nothing saved
- [x] 4.2 Add Delete with `AlertDialog` confirm in edit mode. Verify confirm removes the job and cancel leaves it unchanged
- [x] 4.3 Add `app/layout.tsx` nav (Dashboard | Board), `<Toaster/>`, and a global "Add job" button. Verify the dialog opens from both pages

## 5. Kanban board

- [x] 5.1 Build `app/board/page.tsx` (load jobs + company name, `statusChangedAt desc`, serialize dates) and `Board`/`Column`/`JobCard` rendering four columns with counts, closed-column OFFER-before-REJECTED ordering, card company/title/`Nd`/badges (Offer, Rejected, Ghosted). Verify with seeded data that the "Final column groups two statuses" scenario shows 3 cards in the right order
- [x] 5.2 Add the "Move to…" `DropdownMenu` and the optimistic `move()` with snapshot rollback + error toast per design §2b. Verify: click-to-reject lands in Offer / Rejected with badge; reload keeps it there; with `DATABASE_URL` pointed at a bad path the card snaps back and the toast shows
- [x] 5.3 Add `@dnd-kit` drag-and-drop (PointerSensor distance 6, KeyboardSensor), same-column no-op, Offer-or-Rejected prompt on dropping into the closed column. Verify: drag Applied → Interviewing persists after reload; click on a card still opens the edit dialog
- [x] 5.4 Wire card click → edit dialog and per-column "+" → dialog with that column's status pre-set. Verify "Add from a column" scenario
- [x] 5.5 Fill README "Features → Board" with column mapping and the optimistic-update flow. Verify it matches the implemented behavior

## 6. Dashboard

- [x] 6.1 Build `app/page.tsx`: fetch job facts, `computeDashboard(jobs, new Date(), GHOST_AFTER_DAYS)`, three `StatTile`s in a responsive 3-col grid, second row for conversion and avg days with `—` for null, empty state with Add job. Verify against seeded data matching the analytics spec scenarios, and that a board move updates the numbers after navigation
- [x] 6.2 Fill README "Features → Dashboard" and "Features → Job form" sections. Verify field list matches the form

## 7. Access gate

- [x] 7.1 Implement `proxy.ts` (or `middleware.ts` per 1.1) Basic auth from design §2, skipping static assets. Verify: `APP_PASSWORD=""` → app opens; `APP_PASSWORD=x` → `curl -i localhost:3000` returns 401 with `WWW-Authenticate`, and `curl -u any:x` returns 200; a board move works while authenticated

## 8. Deployment

- [x] 8.1 Add `Dockerfile` and `.dockerignore` (`node_modules`, `.next`, `.env`, `prisma/*.db*`) per design §4 Option B. Verify `docker build` + `docker run -v jobsy-data:/data` serves the app and data survives `docker rm -f` + re-run
- [x] 8.2 Fill README "Deployment" with Options A/B/C and the `.env.example` block from design §4. Verify Option A by running `npm run setup && npm run dev` in a fresh clone

## 9. Integration check

- [x] 9.1 Fresh-clone smoke test: setup → add 3 jobs → move through all columns by drag and by menu → delete one → dashboard numbers match hand-computed values. Verify `npm run build` and `npm run test` both pass
- [x] 9.2 Run `openspec validate add-job-tracker-mvp --strict` and verify it passes

## Workflow follow-up

- Optional: deploy via design §4 Option C (Vercel + Supabase, `APP_PASSWORD` set) and confirm the 401 gate on the public URL.
- Archive the change with `/opsx:archive` once satisfied.
