import type { Status } from "./status";

/** Plain, serializable job shape passed from server components to client components. */
export type JobDTO = {
  id: string;
  title: string;
  url: string | null;
  salary: string | null;
  notes: string | null;
  status: Status;
  /** "YYYY-MM-DD" (local date) or null */
  dateApplied: string | null;
  /** ISO timestamp */
  statusChangedAt: string;
  companyName: string;
};
