# Proposal

## Why

Most jobs enter Jobsy right after reading a posting in the browser, and today that means switching tabs and retyping the company, title and URL by hand. A small Chrome extension that clips the current posting into Jobsy in two clicks removes that friction. The web app stays the place where jobs are reviewed and moved through the pipeline.

## What Changes

- New **Chrome extension (Manifest V3)** in `extension/`, loaded unpacked, with no build step:
  - **Popup:** on click it reads the active tab and pre-fills Company, Title and URL. It uses JSON-LD `JobPosting` data where present, then Open Graph and `<title>` fallbacks. The user can edit the fields, pick Wishlist or Applied, add notes, and save.
  - **Duplicate warning:** if the tab's URL is already saved, the popup says so and links to the board instead of silently creating a second job.
  - **Options page:** stores the Jobsy base URL (default `http://localhost:3000`) and the optional access password. On save it requests host permission for that origin.
  - **Clear errors** for an unreachable app, a wrong password, and validation errors, which are shown inline per field.
- New **JSON API** on the Next.js app:
  - `POST /api/jobs` creates a job through the same validation, company reuse and stage-timestamp logic as the Job Form.
  - `GET /api/jobs?url=…` looks up an existing job by normalized URL.
  - Both revalidate or read the same data the dashboard and board use.
- **Access password covers the API:** when `APP_PASSWORD` is set, `/api/*` requires the same Basic auth credentials. API requests get a JSON 401 without a browser login challenge.
- README section on installing and configuring the extension.

No **BREAKING** changes. Existing pages, server actions and data are untouched.

## Capabilities

### New Capabilities
- `job-intake-api`: HTTP JSON endpoints that let a client outside the web UI create a job and look up a job by URL, with the same validation and rules as the Job Form.
- `browser-clipper`: the Chrome extension, covering page extraction, the popup form, the duplicate warning, the options page and connection/auth error handling.

### Modified Capabilities
- `job-records`: the "Optional access password" requirement extends from pages and server actions to the JSON API. API requests get a 401 without a Basic auth challenge so the browser never shows a login dialog.

## Impact

- **New code:**
  - `app/api/jobs/route.ts`
  - a URL-lookup helper in `lib/` and a shared URL normalizer
  - `extension/`: `manifest.json`, popup, options page, and an extraction module
- **Changed code:**
  - `proxy.ts`: API 401 without the challenge header.
  - `README.md`
  - `.dockerignore` and ESLint config, to exclude or allow the extension's browser globals.
- **Dependencies:** none new. The extension is plain HTML/CSS/JS using `chrome.*` APIs, and tests reuse vitest.
- **Permissions requested by the extension:** `activeTab`, `scripting`, `storage`, plus an optional host permission for the configured Jobsy origin only.
- **Not in scope:**
  - Chrome Web Store publishing
  - side panel or board inside the extension
  - offline queueing
  - editing or moving existing jobs from the extension
  - site-specific scrapers beyond the generic metadata fallbacks
