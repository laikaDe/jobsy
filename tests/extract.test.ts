import { describe, expect, it } from "vitest";
import { toDraft } from "../extension/lib/extract.js";

const ld = (obj: unknown) => JSON.stringify(obj);
const posting = { "@type": "JobPosting", title: "Frontend Engineer", hiringOrganization: { "@type": "Organization", name: "Acme" } };

describe("toDraft", () => {
  it("prefers a plain JSON-LD JobPosting over metadata", () => {
    const d = toDraft({
      url: "https://acme.dev/jobs/1",
      title: "Careers | Acme",
      meta: { "og:title": "Something else", "og:site_name": "Acme Careers" },
      jsonLd: [ld({ "@context": "https://schema.org", ...posting })],
    });
    expect(d).toEqual({ url: "https://acme.dev/jobs/1", title: "Frontend Engineer", company: "Acme" });
  });

  it("finds a JobPosting inside @graph", () => {
    const d = toDraft({ url: "https://a.dev", jsonLd: [ld({ "@graph": [{ "@type": "WebPage" }, posting] })] });
    expect(d.title).toBe("Frontend Engineer");
    expect(d.company).toBe("Acme");
  });

  it("accepts an array @type and a top-level array", () => {
    const d = toDraft({ jsonLd: [ld([{ "@type": "Thing" }, { ...posting, "@type": ["JobPosting", "Thing"] }])] });
    expect(d.title).toBe("Frontend Engineer");
  });

  it("accepts a string hiringOrganization", () => {
    expect(toDraft({ jsonLd: [ld({ ...posting, hiringOrganization: "Initech" })] }).company).toBe("Initech");
  });

  it("falls back to Open Graph", () => {
    const d = toDraft({
      url: "https://globex.jobs/1",
      title: "ignored",
      meta: { "og:title": "Backend Developer", "og:site_name": "Globex Careers" },
      jsonLd: [],
    });
    expect(d).toEqual({ url: "https://globex.jobs/1", title: "Backend Developer", company: "Globex Careers" });
  });

  it("falls back to the document title and strips a matching company suffix", () => {
    expect(toDraft({ title: "  Data Analyst | Globex Careers ", meta: { "og:site_name": "Globex" } }).title).toBe(
      "Data Analyst",
    );
    expect(toDraft({ title: "Data Analyst - Globex", meta: { "og:site_name": "Globex Careers" } }).title).toBe(
      "Data Analyst",
    );
  });

  it("keeps a dash in the title when it doesn't name the company", () => {
    expect(toDraft({ title: "Engineer - Remote", meta: { "og:site_name": "Globex" } }).title).toBe("Engineer - Remote");
  });

  it("title only: company empty", () => {
    expect(toDraft({ url: "https://x.dev/j", title: "QA Engineer" })).toEqual({
      url: "https://x.dev/j",
      title: "QA Engineer",
      company: "",
    });
  });

  it("skips malformed JSON-LD and uses the next valid block", () => {
    const d = toDraft({ jsonLd: ["{not json", ld(posting)] });
    expect(d.company).toBe("Acme");
  });

  it("drops non-http(s) URLs", () => {
    expect(toDraft({ url: "chrome://extensions", title: "Extensions" }).url).toBe("");
  });
});
