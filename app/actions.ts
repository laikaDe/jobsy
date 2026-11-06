"use server";

import { revalidatePath } from "next/cache";
import { removeJob, setJobStatus, upsertJob } from "@/lib/jobs";
import { isStatus } from "@/lib/status";
import { parseJobInput, type JobFieldErrors } from "@/lib/validation";

export type SaveJobState =
  | { ok: true; jobId: string; savedAt: number }
  | { ok: false; fieldErrors: JobFieldErrors; formError?: string }
  | null;

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/board");
}

/** Form action for useActionState: validates, upserts, and reports field errors without throwing. */
export async function saveJob(_prev: SaveJobState, formData: FormData): Promise<SaveJobState> {
  const parsed = parseJobInput(formData);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors };
  try {
    const job = await upsertJob(parsed.data);
    revalidateAll();
    return { ok: true, jobId: job.id, savedAt: Date.now() };
  } catch (err) {
    console.error("saveJob failed", err);
    return { ok: false, fieldErrors: {}, formError: "Couldn't save the job. Is the database reachable?" };
  }
}

/** Board move. Throws on failure so the client can roll back its optimistic update. */
export async function moveJob(id: string, status: string): Promise<{ ok: true }> {
  if (!isStatus(status)) throw new Error(`Invalid status: ${status}`);
  await setJobStatus(id, status);
  revalidateAll();
  return { ok: true };
}

export async function deleteJob(id: string): Promise<{ ok: true }> {
  await removeJob(id);
  revalidateAll();
  return { ok: true };
}
