import { z } from "zod";
import { STATUSES } from "./status";

/** Empty form fields arrive as "" — treat them as absent. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().trim().max(max, `Keep it under ${max} characters`).optional());

export const jobInput = z.object({
  id: z.preprocess(blankToUndefined, z.string().optional()),
  company: z.string({ error: "Company is required" }).trim().min(1, "Company is required").max(100, "Keep it under 100 characters"),
  title: z.string({ error: "Title is required" }).trim().min(1, "Title is required").max(150, "Keep it under 150 characters"),
  url: z.preprocess(
    blankToUndefined,
    z.url({ protocol: /^https?$/, error: "Enter a full http(s) URL, e.g. https://example.com/job" }).optional(),
  ),
  dateApplied: z.preprocess(
    blankToUndefined,
    z.iso.date({ error: "Use a valid date" }).optional(),
  ),
  salary: optionalText(100),
  status: z.enum(STATUSES, { error: "Pick a valid status" }).default("WISHLIST"),
  notes: optionalText(5000),
});

export type JobInput = z.infer<typeof jobInput>;
export type JobFieldErrors = Partial<Record<keyof JobInput, string>>;

/** "YYYY-MM-DD" → local-midnight Date, matching how the date input displays it. */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Validate a FormData or plain object; returns parsed data or one message per field. */
export function parseJobInput(
  raw: FormData | Record<string, unknown>,
): { ok: true; data: JobInput } | { ok: false; fieldErrors: JobFieldErrors } {
  const obj = raw instanceof FormData ? Object.fromEntries(raw.entries()) : raw;
  const result = jobInput.safeParse(obj);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: JobFieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof JobInput;
    fieldErrors[key] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}
