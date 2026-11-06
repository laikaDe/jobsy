import type { JobFacts } from "./analytics";
import { db } from "./db";
import { isStatus, type Status } from "./status";
import type { JobDTO } from "./types";

function toStatus(value: string): Status {
  return isStatus(value) ? value : "WISHLIST";
}

function toDateOnly(d: Date | null): string | null {
  if (!d) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function getBoardJobs(): Promise<JobDTO[]> {
  const jobs = await db.job.findMany({
    include: { company: { select: { name: true } } },
    orderBy: { statusChangedAt: "desc" },
  });
  return jobs.map((j) => ({
    id: j.id,
    title: j.title,
    url: j.url,
    salary: j.salary,
    notes: j.notes,
    status: toStatus(j.status),
    dateApplied: toDateOnly(j.dateApplied),
    statusChangedAt: j.statusChangedAt.toISOString(),
    companyName: j.company.name,
  }));
}

export async function getCompanyNames(): Promise<string[]> {
  const companies = await db.company.findMany({ select: { name: true }, orderBy: { name: "asc" } });
  return companies.map((c) => c.name);
}

export async function getJobFacts(): Promise<JobFacts[]> {
  const jobs = await db.job.findMany({
    select: { status: true, dateApplied: true, statusChangedAt: true, leftAppliedAt: true, firstInterviewAt: true },
  });
  return jobs.map((j) => ({ ...j, status: toStatus(j.status) }));
}
