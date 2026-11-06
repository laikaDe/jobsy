# Design

## Context

- **Write path:** Jobsy only writes through Server Actions (`app/actions.ts`), which call `lib/jobs.ts`. That module holds the shared logic: `upsertJob`, `findOrCreateCompany` and `applyStatusChange`.
- **Validation:** input is validated by `parseJobInput` in `lib/validation.ts`, which accepts FormData or a plain object.
- **Access gate:** `proxy.ts` gates every non-static path behind optional Basic auth (`APP_PASSWORD`) and returns a `WWW-Authenticate` challenge.
- **No external API:** there are no route handlers yet, and nothing can call the app from outside the browser UI.
- **Extension constraints:** the extension must talk to the app over the network. That may be `localhost` in dev, or a Vercel or Docker origin chosen by the user.

See proposal.md for motivation and specs/ for the required behavior.

## Goals / Non-Goals

**Goals:**
- One code path for creating jobs. The API reuses `parseJobInput` and `upsertJob` unchanged, so form and API behavior can't drift.
- An extension with no build step and no dependencies, loaded unpacked from `extension/`.
- Testable extraction logic with no browser.

**Non-Goals:**
- A general REST API (update, delete or list endpoints).
- Token-based auth.
- CORS support for arbitrary web origins.
- TypeScript in the extension.
- Icons beyond Chrome's default action icon.

## Decisions

### 1. Route Handler at `app/api/jobs/route.ts` (POST + GET), not Server Actions
- **Why:** Server Actions use an internal, versioned wire protocol bound to build IDs, so they aren't callable from an extension. A Route Handler is plain HTTP JSON.
- **POST:** reads `request.json()` and runs `parseJobInput(obj)`.
  - Invalid input returns `400 {fieldErrors}`.
  - Valid input runs `upsertJob(data)`, then `revalidatePath("/")` and `revalidatePath("/board")`, and returns `201 {job}`.
  - Any `id` in the body is stripped, so the API can only create.
  - A JSON parse failure returns `400 {error}`, and a database error returns `500 {error}`.
- **GET `?url=`:**
  - Validates the parameter as an http(s) URL (400 otherwise).
  - Calls a new `findJobByUrl(url)` in `lib/queries.ts` and returns `200 {job | null}`.
- Both handlers call `await connection()` first, so they're never prerendered under `cacheComponents`.
- **Response shape:** `{ id, title, companyName, status }`, which is all the popup needs.

### 2. URL normalization in app code (`lib/url.ts`)
- **What:** `normalizeJobUrl(u)` lowercases the host, drops the hash and `utm_*` parameters, and strips a trailing `/` from the path.
- **How lookup works:** `findJobByUrl` loads jobs with a non-null `url` (selecting only id, url and the response fields) and compares normalized values.
- **Why:** this is fine at personal scale (hundreds of jobs) and avoids a schema change or migration.
- **Alternative rejected:** a normalized-URL column. It needs a backfill and `db push` for little gain.
- The stored URL stays exactly as entered.

### 3. Proxy: API gets a JSON 401 without the challenge
- **What:** in `proxy.ts`, when credentials are wrong and `pathname.startsWith("/api/")`, return `NextResponse.json({error}, {status: 401})` without `WWW-Authenticate`.
- **Why:** a `WWW-Authenticate: Basic` response can make Chrome show its native login dialog over the popup.
- The password check is shared with pages, so `APP_PASSWORD` stays the single secret.
- **Alternative rejected:** a separate API token. It's one more env var and more spec surface for a single-user app.

### 4. No CORS headers
- **Why:** requests from extension pages (popup and options) to origins the extension holds host permission for are exempt from CORS in Chrome. The API therefore needs no `Access-Control-*` headers and no `OPTIONS` handler, and ordinary websites still can't call it cross-origin with credentials.
- **Consequence:** all fetches run from the popup or options page, never from a content script. A content script would be subject to the page's CORS.

### 5. Permissions: `activeTab` + `scripting` + `storage`, `optional_host_permissions`
- **Manifest:** `optional_host_permissions: ["http://localhost/*", "http://127.0.0.1/*", "https://*/*", "http://*/*"]`.
- **Options save:** calls `chrome.permissions.request({origins: [origin + "/*"]})` for exactly the configured origin, so only that one is granted.
- **Popup:** checks `chrome.permissions.contains` before fetching and shows the "missing permission" error with a link to the options page.
- **Page access:** `activeTab` grants temporary access to the current tab only when the user clicks the action, which satisfies the "no background access" requirement.
- There is no service worker or content script declared in the manifest.

### 6. Extraction: injected collector + pure parser
- **Collector:** the popup runs `chrome.scripting.executeScript({target: {tabId}, func: collectPageData})`. It returns plain data: `location.href`, `document.title`, the relevant `<meta>` values, and the text of every `script[type="application/ld+json"]`.
- **Parser:** `extension/lib/extract.js` exports a pure `toDraft(pageData)`.
  - It parses the JSON-LD, walking `@graph` and arrays, and finds `@type` `JobPosting` (string or array).
  - Field precedence:
    - title: `JobPosting.title`, then `og:title`, then `document.title`
    - company: `hiringOrganization.name`, then `og:site_name`, then empty
  - It trims values and drops a " | Site" or " - Site" suffix from titles when it matches the company.
- **Why:** the DOM-touching part is tiny, and vitest can unit-test `toDraft` with fixtures and no jsdom.
- **Fallback:** if `executeScript` throws (`chrome://` pages, the Web Store or PDFs), the popup uses `tab.url` when it's http(s).

### 7. Plain HTML/CSS/ES modules, no bundler
- **Why:** `popup.html` and `options.html` load `type="module"` scripts, which MV3 extension pages support natively. Keeping it to a few hundred lines avoids a second toolchain.
- **API client:** a shared `extension/lib/api.js` holds the fetch wrapper. It builds the Basic header, maps errors to `unreachable | unauthorized | invalid | server`, and applies an 8-second timeout via `AbortSignal.timeout`.
- **Settings:** `extension/lib/settings.js` wraps `chrome.storage.local`. It uses local rather than sync storage, so the password doesn't sync across devices.
- **Styling:** small hand-written CSS approximating the app's neutral look, with light and dark themes via `prefers-color-scheme`.

### 8. Repo integration
- **Lint:** add `extension/**` with browser globals plus `chrome` to the ESLint config.
- **Docker:** add `extension` to `.dockerignore`.
- **Tests:** vitest picks up `tests/extract.test.ts`, `tests/url.test.ts` and `tests/api-route.test.ts`.
  - The route test calls the handlers directly with `Request` objects against a temp SQLite file, set through `DATABASE_URL` before importing `lib/db`.

## Risks / Trade-offs

- **The password sits in plaintext in `chrome.storage.local`.**
  - Mitigation: it's single-user, so the risk is limited to the user's own Chrome profile. The options page says so, and the password is never synced or sent anywhere except the configured origin.
- **Basic auth over plain `http://` to a remote host exposes the password.**
  - Mitigation: the options page warns when the URL is http and the host isn't `localhost` or `127.0.0.1`.
- **Many job boards (LinkedIn, Workday) render without JSON-LD or with generic `og:` tags,** so some pre-fills will be poor.
  - Mitigation: every field stays editable. Site-specific scrapers are out of scope, and `toDraft` is the single place to add them later.
- **The full-table URL scan in `findJobByUrl` grows linearly with job count.**
  - Mitigation: acceptable below a few thousand rows. A normalized column can be added later without an API change.
- **Revalidation from a Route Handler only affects the server cache.** An already-open board tab won't update until it refreshes.
  - Accepted, and consistent with the spec ("on the next page load").

## Migration Plan

- No schema change or data migration is needed.
- **Deploy:** redeploy the app as usual (Docker, Vercel or `npm run dev`), then load `extension/` via `chrome://extensions` → Developer mode → Load unpacked, and set the URL in Options.
- **Rollback:** remove the extension and revert `app/api` and `proxy.ts`. Existing data is untouched.
