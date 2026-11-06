/**
 * Canonical form used to compare job URLs: lowercase host, no fragment,
 * no `utm_*` tracking params, no trailing slash. Returns null for non-http(s) input.
 */
export function normalizeJobUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
  }
  // URL already lowercases the host; strip trailing slashes from the path.
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  const out = u.toString();
  return u.pathname === "/" && !u.search ? out.replace(/\/$/, "") : out;
}
