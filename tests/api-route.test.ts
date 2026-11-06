import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Route handlers call these Next request-scope APIs; outside Next they're no-ops.
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const DB_FILE = `prisma/api-test-${process.pid}.db`;
process.env.DATABASE_URL = `file:./${DB_FILE}`;

type Route = typeof import("@/app/api/jobs/route");
type Db = typeof import("@/lib/db")["db"];
let route: Route;
let db: Db;

const post = (body: unknown) =>
  route.POST(
    new Request("http://test/api/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
const get = (query: string) => route.GET(new Request(`http://test/api/jobs${query}`));

beforeAll(async () => {
  execSync("npx prisma db push", { env: process.env, stdio: "ignore" });
  route = await import("@/app/api/jobs/route");
  db = (await import("@/lib/db")).db;
}, 60_000);

afterAll(async () => {
  await db?.$disconnect();
  rmSync(DB_FILE, { force: true });
  rmSync(`${DB_FILE}-journal`, { force: true });
});

describe("POST /api/jobs", () => {
  it("creates a Wishlist job and returns 201", async () => {
    const res = await post({ company: "Acme", title: "Frontend Engineer", url: "https://acme.dev/jobs/1" });
    expect(res.status).toBe(201);
    const { job } = await res.json();
    expect(job).toMatchObject({ title: "Frontend Engineer", companyName: "Acme", status: "WISHLIST" });
    const saved = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(saved.status).toBe("WISHLIST");
  });

  it("fills Date Applied with today when created as Applied", async () => {
    const res = await post({ company: "Initech", title: "SRE", status: "APPLIED" });
    const { job } = await res.json();
    const saved = await db.job.findUniqueOrThrow({ where: { id: job.id } });
    expect(saved.dateApplied?.toDateString()).toBe(new Date().toDateString());
  });

  it("reuses an existing company case-insensitively", async () => {
    const res = await post({ company: " acme ", title: "Backend" });
    const { job } = await res.json();
    expect(job.companyName).toBe("Acme");
    expect(await db.company.count({ where: { name: { in: ["Acme", "acme"] } } })).toBe(1);
  });

  it("ignores an id in the body (create-only)", async () => {
    const existing = await db.job.findFirstOrThrow();
    const res = await post({ id: existing.id, company: "Acme", title: "Other" });
    expect(res.status).toBe(201);
    expect((await res.json()).job.id).not.toBe(existing.id);
  });

  it("returns 400 with field errors and saves nothing on missing title", async () => {
    const before = await db.job.count();
    const res = await post({ company: "Acme" });
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.title).toBe("Title is required");
    expect(await db.job.count()).toBe(before);
  });

  it("returns 400 on malformed JSON", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it("returns 500 JSON when the database write fails", async () => {
    const before = await db.job.count();
    const spy = vi.spyOn(db.job, "create").mockRejectedValueOnce(new Error("disk gone"));
    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    const res = await post({ company: "Acme", title: "Broken" });
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBeTruthy();
    expect(await db.job.count()).toBe(before);
  });
});

describe("GET /api/jobs?url=", () => {
  it("matches after normalization", async () => {
    const res = await get(`?url=${encodeURIComponent("https://ACME.dev/jobs/1/?utm_source=x#apply")}`);
    expect(res.status).toBe(200);
    expect((await res.json()).job).toMatchObject({ title: "Frontend Engineer", companyName: "Acme", status: "WISHLIST" });
  });

  it("returns job: null when nothing matches", async () => {
    const res = await get(`?url=${encodeURIComponent("https://none.dev/x")}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ job: null });
  });

  it("returns 400 without a valid http(s) url", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("?url=chrome://extensions")).status).toBe(400);
  });
});
