import { createJob, lookupJob } from "./lib/api.js";
import { collectPageData, toDraft } from "./lib/extract.js";
import { getSettings } from "./lib/settings.js";

const $ = (id) => document.getElementById(id);
const form = $("form");
const FIELDS = ["company", "title", "url", "status", "notes"];
const STATUS_LABELS = { WISHLIST: "Wishlist", APPLIED: "Applied", INTERVIEWING: "Interviewing", OFFER: "Offer", REJECTED: "Rejected" };

const settings = await getSettings();

// ── UI helpers ────────────────────────────────────────────────
function setFieldErrors(errors = {}) {
  for (const name of FIELDS) {
    const message = errors[name] || "";
    $(`${name}-error`).textContent = message;
    $(name).setAttribute("aria-invalid", message ? "true" : "false");
  }
  const first = FIELDS.find((n) => errors[n]);
  if (first) $(first).focus();
}

function showError(message, withOptionsLink) {
  $("error-text").textContent = message;
  $("error-options").hidden = !withOptionsLink;
  $("error").hidden = !message;
}

const summary = (job) => `${job.title} at ${job.companyName} (${STATUS_LABELS[job.status] || job.status})`;

/** Connection-type failures point at the options page; others are shown as-is. */
function reportApiError(err) {
  const connection = ["unreachable", "unauthorized", "permission"].includes(err?.kind);
  showError(err?.message || "Something went wrong.", connection);
}

for (const el of document.querySelectorAll("[data-open-board]")) {
  el.addEventListener("click", () => chrome.tabs.create({ url: `${settings.baseUrl}/board` }));
}
for (const id of ["options-link", "error-options"]) {
  $(id).addEventListener("click", () => chrome.runtime.openOptionsPage());
}

// ── Pre-fill from the active tab ──────────────────────────────
async function readActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return { url: "", title: "", company: "" };
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: collectPageData });
    return toDraft(result);
  } catch {
    // chrome://, the Web Store, PDFs…: can't script it, keep just the URL when it's http(s).
    return toDraft({ url: tab.url || "" });
  }
}

const draft = await readActiveTab();
$("company").value = draft.company;
$("title").value = draft.title;
$("url").value = draft.url;
(draft.company && draft.title ? $("save") : draft.company ? $("title") : $("company")).focus();

// ── Duplicate check (doesn't block the form) ──────────────────
if (draft.url) {
  lookupJob(settings, draft.url).then(
    (job) => {
      if (!job) return;
      $("duplicate-text").textContent = summary(job);
      $("duplicate").hidden = false;
      $("save").textContent = "Save anyway";
    },
    reportApiError,
  );
}

// ── Save ──────────────────────────────────────────────────────
function validate(values) {
  const errors = {};
  if (!values.company) errors.company = "Company is required";
  if (!values.title) errors.title = "Title is required";
  if (values.url) {
    let ok = false;
    try {
      ok = ["http:", "https:"].includes(new URL(values.url).protocol);
    } catch {
      ok = false;
    }
    if (!ok) errors.url = "Enter a full http(s) URL, e.g. https://example.com/job";
  }
  return errors;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const values = Object.fromEntries(FIELDS.map((n) => [n, $(n).value.trim()]));
  const errors = validate(values);
  setFieldErrors(errors);
  if (Object.keys(errors).length) return;

  showError("");
  const button = $("save");
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const job = await createJob(settings, values);
    form.hidden = true;
    $("duplicate").hidden = true;
    $("saved-text").textContent = `${job.title} at ${job.companyName}`;
    $("saved").hidden = false;
  } catch (err) {
    if (err?.kind === "invalid" && Object.keys(err.fieldErrors).length) setFieldErrors(err.fieldErrors);
    else reportApiError(err);
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
});
