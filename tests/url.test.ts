import { describe, expect, it } from "vitest";
import { normalizeJobUrl } from "@/lib/url";

describe("normalizeJobUrl", () => {
  it("matches the spec example", () => {
    expect(normalizeJobUrl("https://ACME.dev/jobs/1/?utm_source=x#apply")).toBe(
      normalizeJobUrl("https://acme.dev/jobs/1"),
    );
  });
  it("keeps non-tracking query params", () => {
    expect(normalizeJobUrl("https://a.dev/j?id=5&utm_medium=e")).toBe("https://a.dev/j?id=5");
  });
  it("treats a bare origin with or without slash alike", () => {
    expect(normalizeJobUrl("https://a.dev/")).toBe(normalizeJobUrl("https://a.dev"));
  });
  it("keeps path case", () => {
    expect(normalizeJobUrl("https://a.dev/Jobs/X")).toBe("https://a.dev/Jobs/X");
  });
  it("rejects non-http(s) and garbage", () => {
    expect(normalizeJobUrl("chrome://extensions")).toBeNull();
    expect(normalizeJobUrl("not a url")).toBeNull();
  });
});
