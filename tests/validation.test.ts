import { describe, expect, it } from "vitest";
import { ghostAfterDays } from "@/lib/config";
import { parseDateOnly, parseJobInput } from "@/lib/validation";

const valid = { company: "Acme", title: "Frontend Engineer" };

describe("parseJobInput", () => {
  it("accepts the minimum fields and defaults status to WISHLIST", () => {
    const r = parseJobInput(valid);
    expect(r).toEqual({ ok: true, data: { company: "Acme", title: "Frontend Engineer", status: "WISHLIST" } });
  });

  it("rejects an unknown status", () => {
    const r = parseJobInput({ ...valid, status: "ARCHIVED" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.status).toBeDefined();
  });

  it("rejects an empty title with a field error", () => {
    const r = parseJobInput({ ...valid, title: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.title).toBe("Title is required");
  });

  it("rejects a missing company", () => {
    const r = parseJobInput({ title: "Engineer" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.company).toBeDefined();
  });

  it("rejects an invalid URL", () => {
    const r = parseJobInput({ ...valid, url: "not-a-url" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.url).toBeDefined();
  });

  it("rejects non-http URLs", () => {
    expect(parseJobInput({ ...valid, url: "javascript:alert(1)" }).ok).toBe(false);
    expect(parseJobInput({ ...valid, url: "ftp://example.com" }).ok).toBe(false);
  });

  it("accepts https URLs and treats blank optional fields as absent", () => {
    const fd = new FormData();
    Object.entries({ ...valid, url: "https://acme.dev/jobs/1", salary: "", notes: " ", dateApplied: "" }).forEach(([k, v]) => fd.set(k, v));
    const r = parseJobInput(fd);
    expect(r).toEqual({ ok: true, data: { ...valid, url: "https://acme.dev/jobs/1", status: "WISHLIST" } });
  });

  it("trims company and title", () => {
    const r = parseJobInput({ company: "  acme ", title: " Dev " });
    expect(r.ok && r.data).toMatchObject({ company: "acme", title: "Dev" });
  });

  it("enforces length limits", () => {
    expect(parseJobInput({ ...valid, notes: "x".repeat(5001) }).ok).toBe(false);
    expect(parseJobInput({ ...valid, company: "x".repeat(101) }).ok).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(parseJobInput({ ...valid, dateApplied: "2026-13-40" }).ok).toBe(false);
  });
});

describe("parseDateOnly", () => {
  it("parses to local midnight", () => {
    expect(parseDateOnly("2026-09-15")).toEqual(new Date(2026, 8, 15));
  });
});

describe("ghostAfterDays", () => {
  it("defaults to 30 and accepts positive integers", () => {
    expect(ghostAfterDays(undefined)).toBe(30);
    expect(ghostAfterDays("")).toBe(30);
    expect(ghostAfterDays("abc")).toBe(30);
    expect(ghostAfterDays("0")).toBe(30);
    expect(ghostAfterDays("14")).toBe(14);
  });
});
