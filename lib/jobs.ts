import { db } from "./db";
import { applyStatusChange, isStatus, type Status } from "./status";
import { parseDateOnly, type JobInput } from "./validation";

/** Find a company by trimmed, case-insensitive name, or create it. */
export async function findOrCreateCompany(rawName: string) {
  const name = rawName.trim();
  const exact = await db.company.findUnique({ where: { name } });
  if (exact) return exact;
  // SQLite `=` is case-sensitive and `mode: "insensitive"` is Postgres-only, so compare in app code.
  const all = await db.company.findMany({ select: { id: true, name: true } });
  const match = all.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match;
  return db.company.create({ data: { name } });
}

/** Create (no id) or update (with id) a job from validated form input. */
export async function upsertJob(input: JobInput, now = new Date()) {
  const company = await findOrCreateCompany(input.company);
  const formDate = input.dateApplied ? parseDateOnly(input.dateApplied) : null;
  const fields = {
    title: input.title,
    url: input.url ?? null,
    salary: input.salary ?? null,
    notes: input.notes ?? null,
    dateApplied: formDate,
    companyId: company.id,
  };

  if (!input.id) {
    // New jobs start life as WISHLIST; any other initial status is a transition from there.
    const patch = applyStatusChange(
      { status: "WISHLIST", dateApplied: formDate, leftAppliedAt: null, firstInterviewAt: null },
      input.status,
      now,
    );
    return db.job.create({ data: { ...fields, status: "WISHLIST", statusChangedAt: now, ...patch } });
  }

  const existing = await db.job.findUniqueOrThrow({ where: { id: input.id } });
  const patch = applyStatusChange(
    {
      status: toStatus(existing.status),
      dateApplied: formDate,
      leftAppliedAt: existing.leftAppliedAt,
      firstInterviewAt: existing.firstInterviewAt,
    },
    input.status,
    now,
  );
  return db.job.update({ where: { id: input.id }, data: { ...fields, ...patch } });
}

/** Change only the status. Throws if the job is missing or the write fails. */
export async function setJobStatus(id: string, next: Status, now = new Date()) {
  const job = await db.job.findUniqueOrThrow({ where: { id } });
  const patch = applyStatusChange({ ...job, status: toStatus(job.status) }, next, now);
  if (!patch) return job;
  return db.job.update({ where: { id }, data: patch });
}

/** Delete a job; its interviews cascade, its company stays. */
export async function removeJob(id: string) {
  await db.job.delete({ where: { id } });
}

function toStatus(value: string): Status {
  if (!isStatus(value)) throw new Error(`Unknown status in database: ${value}`);
  return value;
}
