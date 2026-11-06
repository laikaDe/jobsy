export const STATUSES = ["WISHLIST", "APPLIED", "INTERVIEWING", "OFFER", "REJECTED"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  WISHLIST: "Wishlist",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
};

export const COLUMNS = [
  { id: "wishlist", title: "Wishlist", statuses: ["WISHLIST"], dropStatus: "WISHLIST" },
  { id: "applied", title: "Applied", statuses: ["APPLIED"], dropStatus: "APPLIED" },
  { id: "interviewing", title: "Interviewing", statuses: ["INTERVIEWING"], dropStatus: "INTERVIEWING" },
  { id: "closed", title: "Offer / Rejected", statuses: ["OFFER", "REJECTED"], dropStatus: "OFFER" },
] as const satisfies readonly {
  id: string;
  title: string;
  statuses: readonly Status[];
  dropStatus: Status;
}[];

export type ColumnId = (typeof COLUMNS)[number]["id"];

export function isStatus(value: unknown): value is Status {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value);
}

export function columnFor(status: Status): ColumnId {
  return COLUMNS.find((c) => (c.statuses as readonly Status[]).includes(status))!.id;
}

export type StatusStamps = {
  status: Status;
  dateApplied: Date | null;
  leftAppliedAt: Date | null;
  firstInterviewAt: Date | null;
};

export type StatusPatch = {
  status: Status;
  statusChangedAt: Date;
  dateApplied?: Date;
  leftAppliedAt?: Date;
  firstInterviewAt?: Date;
};

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Pure: the DB patch for moving a job to `next`. Returns null when the status is unchanged.
 * First-time timestamps (leftAppliedAt, firstInterviewAt) are never overwritten.
 */
export function applyStatusChange(job: StatusStamps, next: Status, now = new Date()): StatusPatch | null {
  if (job.status === next) return null;
  const patch: StatusPatch = { status: next, statusChangedAt: now };
  if (next !== "WISHLIST" && !job.dateApplied) patch.dateApplied = startOfDay(now);
  if (job.status === "APPLIED" && !job.leftAppliedAt) patch.leftAppliedAt = now;
  if (next === "INTERVIEWING" && !job.firstInterviewAt) patch.firstInterviewAt = now;
  return patch;
}
