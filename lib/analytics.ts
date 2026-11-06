import type { Status } from "./status";

export type JobFacts = {
  status: Status;
  dateApplied: Date | null;
  statusChangedAt: Date;
  leftAppliedAt: Date | null;
  firstInterviewAt: Date | null;
};

export type DashboardStats = {
  totalApplied: number;
  activeInterviews: number;
  ghostedOrRejected: number;
  conversionRate: number | null;
  avgDaysInApplied: number | null;
};

const DAY_MS = 86_400_000;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Days from `from` to `to`, never negative. */
export const daysBetween = (from: Date, to: Date) => Math.max(0, (to.getTime() - from.getTime()) / DAY_MS);

/** APPLIED and unchanged for at least `ghostDays` days. */
export const isGhosted = (j: Pick<JobFacts, "status" | "statusChangedAt">, now: Date, ghostDays = 30) =>
  j.status === "APPLIED" && daysBetween(j.statusChangedAt, now) >= ghostDays;

/** % of applied jobs that ever reached INTERVIEWING, one decimal. null when nothing applied. */
export function applicationToInterviewRate(jobs: JobFacts[]): number | null {
  const applied = jobs.filter((j) => j.dateApplied !== null);
  if (applied.length === 0) return null;
  const interviewed = applied.filter((j) => j.firstInterviewAt !== null).length;
  return round1((interviewed / applied.length) * 100);
}

/** Mean days from dateApplied to first exit from APPLIED, one decimal. null when no job has exited. */
export function averageDaysInApplied(jobs: JobFacts[]): number | null {
  const spans = jobs
    .filter((j) => j.dateApplied && j.leftAppliedAt)
    .map((j) => daysBetween(j.dateApplied!, j.leftAppliedAt!));
  if (spans.length === 0) return null;
  return round1(spans.reduce((a, b) => a + b, 0) / spans.length);
}

export function computeDashboard(jobs: JobFacts[], now = new Date(), ghostDays = 30): DashboardStats {
  return {
    totalApplied: jobs.filter((j) => j.dateApplied !== null).length,
    activeInterviews: jobs.filter((j) => j.status === "INTERVIEWING").length,
    ghostedOrRejected:
      jobs.filter((j) => j.status === "REJECTED").length + jobs.filter((j) => isGhosted(j, now, ghostDays)).length,
    conversionRate: applicationToInterviewRate(jobs),
    avgDaysInApplied: averageDaysInApplied(jobs),
  };
}

export const formatRate = (rate: number | null) => (rate === null ? "—" : `${rate.toFixed(1)}%`);
export const formatDays = (days: number | null) => (days === null ? "—" : days.toFixed(1));
