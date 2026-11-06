import { testConnection } from "./lib/api.js";
import { getSettings, isInsecureRemote, normalizeBaseUrl, originPattern, saveSettings } from "./lib/settings.js";

const $ = (id) => document.getElementById(id);
const form = $("form");
const baseUrlInput = $("baseUrl");
const passwordInput = $("password");

function showStatus(kind, text) {
  const el = $("status");
  el.className = `banner ${kind}`;
  el.textContent = text;
}

function setUrlError(text) {
  $("baseUrl-error").textContent = text;
  baseUrlInput.setAttribute("aria-invalid", text ? "true" : "false");
}

function updateInsecureWarning() {
  const url = normalizeBaseUrl(baseUrlInput.value);
  $("insecure").hidden = !(url && isInsecureRemote(url));
}

function formSettings() {
  const baseUrl = normalizeBaseUrl(baseUrlInput.value);
  return baseUrl ? { baseUrl, password: passwordInput.value } : null;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const next = formSettings();
  if (!next) {
    setUrlError("Enter a full http(s) URL, e.g. http://localhost:3000");
    showStatus("error", "Not saved. The previous settings are kept.");
    return;
  }
  setUrlError("");
  // Ask for exactly this origin. Must run first, while the click still counts as a user gesture.
  const granted = await chrome.permissions.request({ origins: [originPattern(next.baseUrl)] });
  if (!granted) {
    showStatus("error", `Not saved. Jobsy Clipper needs permission to reach ${new URL(next.baseUrl).host}.`);
    return;
  }
  await saveSettings(next);
  baseUrlInput.value = next.baseUrl;
  showStatus("ok", "Saved.");
});

$("test").addEventListener("click", async () => {
  const settings = formSettings();
  if (!settings) {
    setUrlError("Enter a full http(s) URL, e.g. http://localhost:3000");
    return;
  }
  setUrlError("");
  showStatus("info", "Testing…");
  try {
    await testConnection(settings);
    showStatus("ok", `Connected to Jobsy at ${settings.baseUrl}.`);
  } catch (err) {
    const messages = {
      unauthorized: "Wrong password.",
      unreachable: `Can't reach Jobsy at ${settings.baseUrl}. Is it running?`,
      permission: `${err.message} Click Save to grant it.`,
    };
    showStatus("error", messages[err.kind] || err.message);
  }
});

baseUrlInput.addEventListener("input", () => {
  setUrlError("");
  updateInsecureWarning();
});

const current = await getSettings();
baseUrlInput.value = current.baseUrl;
passwordInput.value = current.password;
updateInsecureWarning();
