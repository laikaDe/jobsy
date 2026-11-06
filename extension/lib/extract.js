// Page → job draft. `collectPageData` runs inside the tab (via chrome.scripting) and must stay
// self-contained; `toDraft` is pure so it can be unit-tested without a browser.

/**
 * Injected into the active tab. Returns plain, serializable data only.
 * @returns {{url: string, title: string, meta: Record<string, string>, jsonLd: string[]}}
 */
export function collectPageData() {
  const meta = {};
  for (const el of document.querySelectorAll("meta[property], meta[name]")) {
    const key = (el.getAttribute("property") || el.getAttribute("name") || "").toLowerCase();
    if (key && !(key in meta)) meta[key] = el.getAttribute("content") || "";
  }
  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent || "");
  return { url: location.href, title: document.title, meta, jsonLd };
}

const clean = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

const isJobPosting = (node) => {
  const t = node && node["@type"];
  return t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
};

/** Depth-first search through JSON-LD values (arrays, @graph, nested objects). */
function findJobPosting(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findJobPosting(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (isJobPosting(value)) return value;
  for (const child of Object.values(value)) {
    const hit = findJobPosting(child, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function orgName(org) {
  if (Array.isArray(org)) org = org[0];
  if (typeof org === "string") return clean(org);
  return org && typeof org === "object" ? clean(org.name) : "";
}

/** Drop a trailing " | Company", " - Company" or " – Company" when it names the company. */
function stripCompanySuffix(title, company) {
  if (!company) return title;
  const m = title.match(/^(.*\S)\s+[|\-–—]\s+(.+)$/);
  if (m && m[2].toLowerCase().includes(company.toLowerCase())) return m[1].trim();
  if (m && company.toLowerCase().includes(m[2].toLowerCase())) return m[1].trim();
  return title;
}

const httpUrl = (u) => (typeof u === "string" && /^https?:\/\//i.test(u) ? u : "");

/**
 * Best-effort job fields from page data. Precedence: JSON-LD JobPosting → Open Graph → document title.
 * @param {{url?: string, title?: string, meta?: Record<string, string>, jsonLd?: string[]}} page
 * @returns {{url: string, title: string, company: string}}
 */
export function toDraft(page) {
  const meta = page.meta || {};
  let posting = null;
  for (const raw of page.jsonLd || []) {
    try {
      posting = findJobPosting(JSON.parse(raw));
    } catch {
      continue; // malformed JSON-LD is common; ignore that block
    }
    if (posting) break;
  }

  const company = orgName(posting?.hiringOrganization) || clean(meta["og:site_name"]);
  const rawTitle = clean(posting?.title) || clean(meta["og:title"]) || clean(page.title);
  return {
    url: httpUrl(page.url),
    title: posting?.title ? rawTitle : stripCompanySuffix(rawTitle, company),
    company,
  };
}
