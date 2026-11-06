// Connection settings, kept in chrome.storage.local (not sync: the password stays on this device).

export const DEFAULT_BASE_URL = "http://localhost:3000";
const KEY = "jobsySettings";

/** "https://jobsy.app/" → "https://jobsy.app". Null unless it's an http(s) URL. */
export function normalizeBaseUrl(input) {
  let u;
  try {
    u = new URL(String(input).trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  return (u.origin + u.pathname).replace(/\/+$/, "");
}

/** Host permission pattern for the base URL. Chrome patterns without a port match every port. */
export function originPattern(baseUrl) {
  const u = new URL(baseUrl);
  return `${u.protocol}//${u.hostname}/*`;
}

/** True for plain http to anything other than this machine: Basic auth would travel unencrypted. */
export function isInsecureRemote(baseUrl) {
  const u = new URL(baseUrl);
  return u.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
}

/** @returns {Promise<{baseUrl: string, password: string}>} */
export async function getSettings() {
  const { [KEY]: saved } = await chrome.storage.local.get(KEY);
  return { baseUrl: saved?.baseUrl || DEFAULT_BASE_URL, password: saved?.password || "" };
}

export async function saveSettings({ baseUrl, password }) {
  await chrome.storage.local.set({ [KEY]: { baseUrl, password: password || "" } });
}

export async function hasOriginPermission(baseUrl) {
  return chrome.permissions.contains({ origins: [originPattern(baseUrl)] });
}
