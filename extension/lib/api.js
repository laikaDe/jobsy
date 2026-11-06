// Tiny client for Jobsy's JSON API. Runs in extension pages (popup/options), which are exempt
// from CORS for origins the extension has host permission for.

import { originPattern } from "./settings.js";

const TIMEOUT_MS = 8000;

/** kind: "unreachable" | "unauthorized" | "invalid" | "server" | "permission" */
export class ApiError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = extra.status;
    this.fieldErrors = extra.fieldErrors || {};
  }
}

/** Basic auth header with an empty username; UTF-8 safe. */
export function basicAuth(password) {
  const bytes = new TextEncoder().encode(`:${password}`);
  return "Basic " + btoa(String.fromCharCode(...bytes));
}

const defaultDeps = () => ({
  fetch: (...args) => globalThis.fetch(...args),
  permissions: globalThis.chrome?.permissions,
});

async function request(settings, path, init = {}, deps = defaultDeps()) {
  const { baseUrl, password } = settings;
  if (deps.permissions && !(await deps.permissions.contains({ origins: [originPattern(baseUrl)] }))) {
    throw new ApiError("permission", `Jobsy Clipper needs permission to reach ${new URL(baseUrl).host}.`);
  }
  const headers = { accept: "application/json", ...(init.headers || {}) };
  if (password) headers.authorization = basicAuth(password);

  let res;
  try {
    res = await deps.fetch(baseUrl + path, { ...init, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new ApiError("unreachable", `Can't reach Jobsy at ${baseUrl}.`);
  }

  if (res.status === 401) throw new ApiError("unauthorized", "Jobsy rejected the password.", { status: 401 });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // fall through: a non-JSON answer means this isn't a Jobsy API
  }
  if (!body || typeof body !== "object") {
    throw new ApiError("server", `${baseUrl} didn't answer like Jobsy (HTTP ${res.status}).`, { status: res.status });
  }
  if (res.status === 400) {
    throw new ApiError("invalid", body.error || "Jobsy rejected the input.", {
      status: 400,
      fieldErrors: body.fieldErrors,
    });
  }
  if (!res.ok) {
    throw new ApiError("server", body.error || `Jobsy returned an error (HTTP ${res.status}).`, { status: res.status });
  }
  return body;
}

/** @returns {Promise<null | {id: string, title: string, companyName: string, status: string}>} */
export async function lookupJob(settings, url, deps) {
  const body = await request(settings, `/api/jobs?url=${encodeURIComponent(url)}`, {}, deps);
  return body.job ?? null;
}

/** @param {{company: string, title: string, url?: string, status?: string, notes?: string}} draft */
export async function createJob(settings, draft, deps) {
  const body = await request(
    settings,
    "/api/jobs",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(draft) },
    deps,
  );
  return body.job;
}

/** Resolves when Jobsy answers with the configured password; throws ApiError otherwise. */
export async function testConnection(settings, deps) {
  await lookupJob(settings, "https://example.com/jobsy-connection-test", deps);
}
