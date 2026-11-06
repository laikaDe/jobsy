import { describe, expect, it, vi } from "vitest";
import { basicAuth, createJob, lookupJob, testConnection } from "../extension/lib/api.js";
import { isInsecureRemote, normalizeBaseUrl, originPattern } from "../extension/lib/settings.js";

const settings = { baseUrl: "http://localhost:3000", password: "" };
const jsonRes = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
type Init = RequestInit & { headers: Record<string, string> };
const deps = (impl: () => Promise<Response>, granted = true) => ({
  fetch: vi.fn<(url: string, init: Init) => Promise<Response>>(impl),
  permissions: { contains: vi.fn(async () => granted) },
});
const kindOf = async (p: Promise<unknown>) => p.then(() => "ok", (e) => e.kind);

describe("extension API client", () => {
  it("returns the job from a lookup and encodes the url", async () => {
    const job = { id: "1", title: "FE", companyName: "Acme", status: "WISHLIST" };
    const d = deps(async () => jsonRes(200, { job }));
    expect(await lookupJob(settings, "https://acme.dev/j?a=1", d)).toEqual(job);
    expect(d.fetch.mock.calls[0][0]).toBe("http://localhost:3000/api/jobs?url=https%3A%2F%2Facme.dev%2Fj%3Fa%3D1");
  });

  it("returns null when nothing matches", async () => {
    expect(await lookupJob(settings, "https://x.dev", deps(async () => jsonRes(200, { job: null })))).toBeNull();
  });

  it("posts JSON with Basic auth when a password is set", async () => {
    const d = deps(async () => jsonRes(201, { job: { id: "2" } }));
    await createJob({ ...settings, password: "pä:ss" }, { company: "Acme", title: "FE" }, d);
    const [, init] = d.fetch.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ company: "Acme", title: "FE" });
    expect(init.headers.authorization).toBe(basicAuth("pä:ss"));
    expect(Buffer.from(init.headers.authorization.slice(6), "base64").toString("utf8")).toBe(":pä:ss");
  });

  it("sends no auth header without a password", async () => {
    const d = deps(async () => jsonRes(200, { job: null }));
    await lookupJob(settings, "https://x.dev", d);
    expect(d.fetch.mock.calls[0][1].headers).not.toHaveProperty("authorization");
  });

  it("classifies a network failure as unreachable", async () => {
    const d = deps(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(lookupJob(settings, "https://x.dev", d)).rejects.toMatchObject({
      kind: "unreachable",
      message: "Can't reach Jobsy at http://localhost:3000.",
    });
  });

  it("classifies 401 as unauthorized", async () => {
    expect(await kindOf(testConnection(settings, deps(async () => jsonRes(401, { error: "x" }))))).toBe(
      "unauthorized",
    );
  });

  it("classifies 400 as invalid with field errors", async () => {
    const d = deps(async () => jsonRes(400, { error: "Invalid job", fieldErrors: { title: "Title is required" } }));
    await expect(createJob(settings, { company: "A", title: "" }, d)).rejects.toMatchObject({
      kind: "invalid",
      fieldErrors: { title: "Title is required" },
    });
  });

  it("classifies 500 and non-JSON answers as server errors", async () => {
    expect(await kindOf(lookupJob(settings, "https://x.dev", deps(async () => jsonRes(500, { error: "db" }))))).toBe(
      "server",
    );
    const html = deps(async () => new Response("<html>", { status: 200 }));
    expect(await kindOf(lookupJob(settings, "https://x.dev", html))).toBe("server");
  });

  it("refuses to fetch without host permission", async () => {
    const d = deps(async () => jsonRes(200, { job: null }), false);
    expect(await kindOf(lookupJob(settings, "https://x.dev", d))).toBe("permission");
    expect(d.fetch).not.toHaveBeenCalled();
  });
});

describe("extension settings helpers", () => {
  it("normalizes and validates base URLs", () => {
    expect(normalizeBaseUrl(" https://jobsy.example.app/ ")).toBe("https://jobsy.example.app");
    expect(normalizeBaseUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeBaseUrl("jobsy")).toBeNull();
    expect(normalizeBaseUrl("ftp://x.dev")).toBeNull();
  });
  it("builds a port-agnostic origin pattern", () => {
    expect(originPattern("http://localhost:3000")).toBe("http://localhost/*");
    expect(originPattern("https://jobsy.example.app")).toBe("https://jobsy.example.app/*");
  });
  it("flags plain http to remote hosts only", () => {
    expect(isInsecureRemote("http://localhost:3000")).toBe(false);
    expect(isInsecureRemote("http://192.168.1.5:3000")).toBe(true);
    expect(isInsecureRemote("https://jobsy.example.app")).toBe(false);
  });
});
