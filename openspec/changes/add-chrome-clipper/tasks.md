# Tasks

## 1. Job intake API

- [x] 1.1 Add `lib/url.ts` with `normalizeJobUrl` (lowercase host, drop hash, `utm_*` params and trailing slash) plus `tests/url.test.ts`; verify `npm test` passes, including the spec's `https://ACME.dev/jobs/1/?utm_source=x#apply` case
- [x] 1.2 Add `findJobByUrl(url)` to `lib/queries.ts` returning `{id, title, companyName, status} | null`; verify via the route tests in 1.4
- [x] 1.3 Create `app/api/jobs/route.ts`:
  - **POST:** JSON parse, then `parseJobInput` with `id` stripped, then `upsertJob` and revalidation of `/` and `/board`. Responses: 201 / 400 `{fieldErrors}` / 400 `{error}` / 500 `{error}`.
  - **GET `?url=`:** 200 `{job}` / 400.
  - Both call `await connection()`.
  - Verify with `curl` against `npm run dev`: a created job appears on `/board`.
- [x] 1.4 Add `tests/api-route.test.ts` exercising the handlers with `Request` objects against a temp SQLite DB, covering every scenario in `specs/job-intake-api`; verify `npm test` passes and the temp DB is removed afterwards

## 2. Access password for the API

- [x] 2.1 Update `proxy.ts` so `/api/*` requests with missing or wrong credentials get a JSON 401 without `WWW-Authenticate`, while pages keep the challenge; verify with `curl -i` against `APP_PASSWORD=x npm run dev`: `/api/jobs?url=…` returns 401 JSON with no challenge header, `/` returns 401 with the challenge, and correct credentials return 200
- [x] 2.2 Document the API endpoints and auth behavior in README.md (new "API" subsection); verify the documented `curl` commands run as written

## 3. Extension scaffold and extraction

- [x] 3.1 Create `extension/manifest.json`:
  - MV3, with name, version and `action.default_popup`
  - `options_ui`
  - permissions `activeTab`, `scripting` and `storage`
  - `optional_host_permissions` as in design §5
  - no background script and no content scripts
  - Verify it loads via Load unpacked in `chrome://extensions` with no errors.
- [x] 3.2 Add `extension/lib/extract.js`, exporting `collectPageData` (the injected collector) and the pure `toDraft(pageData)`, implementing the design §6 precedence and title-suffix cleanup. Add `tests/extract.test.ts` with fixtures for JSON-LD (plain, `@graph`, array `@type`), og-only, title-only and malformed JSON-LD. Verify `npm test` passes.
- [x] 3.3 Add `extension/**` to the ESLint config with browser and `chrome` globals, and add `extension` to `.dockerignore`; verify `npm run lint` passes

## 4. Settings and API client

- [x] 4.1 Add `extension/lib/settings.js` (`chrome.storage.local` get/set with default `http://localhost:3000`, and URL validation) and `extension/lib/api.js`:
  - Basic header, an 8s timeout, and `lookupJob(url)` / `createJob(draft)`.
  - Errors are classified as `unreachable | unauthorized | invalid | server | permission`.
  - Unit-test the classification in `tests/extension-api.test.ts` with a stubbed `fetch`, and verify `npm test` passes.
- [x] 4.2 Build the options page (`options.html`, `options.js`, shared CSS):
  - Fields: URL and password.
  - Save validates the URL, then calls `chrome.permissions.request` for exactly that origin, then stores.
  - "Test connection" reports OK / Wrong password / Can't reach.
  - Show an http-to-remote-host warning.
  - Verify manually in Chrome against `npm run dev` with and without `APP_PASSWORD`, including the invalid-URL scenario.

## 5. Popup

- [x] 5.1 Build `popup.html` and `popup.js`:
  - Get the active tab, inject `collectPageData`, and pre-fill the form via `toDraft`, falling back to the tab URL on injection failure.
  - Fields: Company, Title, URL, Status (Wishlist / Applied), Notes.
  - Client-side required and http(s) validation with inline errors.
  - Verify manually on a page with JobPosting JSON-LD, an og-only page and `chrome://extensions`.
- [x] 5.2 Wire save and the duplicate check:
  - The duplicate lookup runs on open and shows "Already in Jobsy" with a "Save anyway" primary button.
  - Save maps API field errors inline, and success shows "Saved" with an "Open board" link (`chrome.tabs.create`).
  - Distinct unreachable / wrong-password / missing-permission messages, each linking to options (`chrome.runtime.openOptionsPage`), and input kept on failure.
  - Verify each `browser-clipper` scenario manually.
- [x] 5.3 Document extension install and configuration in README.md:
  - Load unpacked and Options setup.
  - Permissions explained.
  - Plaintext-password note.
  - Verify by following the README steps from a fresh Chrome profile.

## 6. Integration check

- [x] 6.1 End-to-end check:
  - Clip a real posting into a local `npm run dev` instance with `APP_PASSWORD` set.
  - Confirm it appears on `/board` and in the dashboard numbers after reload.
  - Reopen the popup on the same tab to see the duplicate warning.
  - Stop the server and confirm the "Can't reach Jobsy" error.
  - Run `npm test`, `npm run lint` and `npm run build`, all clean.
