import { revalidatePath } from "next/cache";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { upsertJob } from "@/lib/jobs";
import { findJobByUrl, type JobSummary } from "@/lib/queries";
import { normalizeJobUrl } from "@/lib/url";
import { parseJobInput } from "@/lib/validation";

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** Create a job. Same validation and rules as the Job Form; create-only (any `id` is ignored). */
export async function POST(request: Request) {
  await connection();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Body must be valid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ error: "Body must be a JSON object" }, 400);
  }
  const { id: _ignored, ...fields } = body as Record<string, unknown>;
  void _ignored;
  const parsed = parseJobInput(fields);
  if (!parsed.ok) return json({ error: "Invalid job", fieldErrors: parsed.fieldErrors }, 400);

  try {
    const created = await upsertJob(parsed.data);
    const company = await db.company.findUniqueOrThrow({ where: { id: created.companyId } });
    revalidatePath("/");
    revalidatePath("/board");
    const job: JobSummary = {
      id: created.id,
      title: created.title,
      companyName: company.name,
      status: parsed.data.status,
    };
    return json({ job }, 201);
  } catch (err) {
    console.error("POST /api/jobs failed", err);
    return json({ error: "Couldn't save the job. Is the database reachable?" }, 500);
  }
}

/** Look up a saved job by URL (normalized). */
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !normalizeJobUrl(url)) return json({ error: "Pass a full http(s) URL as ?url=" }, 400);
  try {
    return json({ job: await findJobByUrl(url) });
  } catch (err) {
    console.error("GET /api/jobs failed", err);
    return json({ error: "Couldn't read jobs. Is the database reachable?" }, 500);
  }
}
