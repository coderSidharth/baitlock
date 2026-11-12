# Baitlock audit resolution

All 100 numbered findings from `AUDIT_REPORT.md` were checked against the actual code, including pre-existing uncommitted fixes. The report contains duplicates and incorrect assumptions; those are explicitly distinguished below rather than implemented literally. No production deployment, public sharing, live database migration or store submission is performed.

The working implementation includes backend, dashboard and extension fixes, regression tests, additive schema migrations, release packaging, CI and container definitions. See the verification results at the end of this file.

| Finding | Outcome | Evidence / resulting behavior |
|---|---|---|
| C1 | Fixed | Exact constructor allowlist, production HMAC verification before deserialization, and matching model-card checks; shipped model loads. |
| C2 | Fixed | Resolve and validate each hop, connect to the pinned public IP, preserve HTTPS SNI and certificate hostname validation, and bound streaming reads. |
| C3 | Fixed | Release builder derives API host permissions from the supplied HTTPS deployment URL. |
| C4 | Fixed | Release builder derives dashboard content-script matches and includes the shared config. |
| C5 | Mitigated | Token shape/expiry checks and backend session validation precede extension storage. Same-origin dashboard XSS remains a dashboard trust-boundary compromise; format checks alone cannot solve XSS. |
| C6 | Fixed | Build-time origin injection, nonlocal HTTPS validation, and consistent generated manifest/CSP. |
| H1 | Fixed | Versioned new hashes take one bcrypt check; unversioned legacy hashes migrate on successful login. Login CPU/database work runs outside the async event loop. |
| H2 | Verified existing fix | New hashes use SHA-256 hex. Legacy binary format is accepted only for migration. |
| H3 | Fixed | At most four LLM calls per worker, short connect/read timeouts, immediate load shedding, and no retry sleeps. Synchronous calls are capacity-bounded rather than migrated through the entire scoring pipeline to async. |
| H4 | Verified existing fix | alembic.ini has no embedded credential; env.py obtains the configured URL and escapes interpolation percent signs. |
| H5 | Verified existing fix | Fraud repository rolls back and logs failed commits before re-raising. |
| H6 | Verified existing fix | Chat sends aggregate counts rather than personal domain lists; score aggregates are computed in SQL. |
| H7 | Verified existing fix | All chat telemetry queries require the authenticated user ID. |
| H8 | Verified existing fix | Chat history is bounded to 500 rows; default 100. |
| H9 | Fixed | Account deletion verifies the current password; the dashboard supplies it through a password modal. |
| H10 | Fixed | Expired sessions are rejected and cleaned up at sign-in; per-account session cap and persistent token nonce prevent old-token resurrection. |
| H11 | Fixed | Password length is bounded and changes require current-password coupling in the schema and verification in the route; arbitrary character-composition rules are not added. |
| H12 | Fixed | Community flags are rate-limited, unique per account/domain and advisory only; votes cannot adjust detection scores. |
| H13 | Fixed | Company flag input uses a Literal of malicious/legitimate. |
| H14 | Fixed with explicit limitation | Synthetic model is opt-in for development and always disabled in production. Default fraud screening is rule-only and labelled accordingly. A real validated financial model requires real training/evaluation data. |
| H15 | Corrected report | Broad all-site host permissions are unnecessary for API requests. The package grants only configured API/dashboard origins. |
| H16 | Fixed | Navigation bypass entries expire after 30 seconds, are consumed once, and are capped at 500. |
| H17 | Fixed | Worker catches config-load failure, logs it and reports an error badge without trapping navigation. |
| H18 | Fixed | Shared JWT shape and expiry validation; server validates the session before accepting dashboard sync. |
| H19 | Mitigated | Bridge checks source/origin and uses postMessage only as a signal to read current dashboard storage. It does not accept a message-supplied token. Same-origin scripts share the dashboard trust boundary. |
| H20 | Fixed | Nonlocal plaintext configuration is rejected; popup uses bounded API requests. |
| H21 | Fixed | Removed popup script injection that wrote tokens into dashboard localStorage. Popup login is extension-only. |
| H22 | Fixed | Expired/401 sessions are cleared and the popup asks for sign-in; explicit re-authentication replaces silent expiry. No long-lived refresh token is introduced. |
| H23 | Fixed | Removed remote font stylesheet from the extension; system font fallbacks apply. |
| H24 | Fixed | Removed the remote CSS font import. |
| H25 | Verified and hardened | Scan requests have a 15-second timeout and manual-continue state; completion acknowledgements are checked and failures are shown. |
| H26 | Fixed | Same HTTPS build/config validation as C6/H20. |
| M1 | Fixed | Settings load server/.env by absolute path and resolve relative SQLite file paths against server root. |
| M2 | Fixed | Default access lifetime shortened to one hour with server session expiry and explicit sign-in handling. |
| M3 | Fixed | Documented file-backed SQLite QueuePool selection; isolated in-memory tests explicitly select StaticPool. |
| M4 | Verified existing fix | The unused _safe_password_bytes helper is absent. |
| M5 | Fixed | JWTs contain exp/iat/jti/sub/sid and require matching live session token_id. |
| M6 | Fixed | Limiter caps key count and per-key history, prunes expired keys, and recovers after key exhaustion. |
| M7 | Fixed | Separate /live and /ready; readiness correctly returns 503 for unavailable DB/model while diagnostic /health remains compatible. |
| M8 | Fixed | Database UNION performs ordering, tie-breaking, offset and limit before materialization. |
| M9 | Fixed | User activation state is persisted and enforced by required and optional authentication. |
| M10 | Fixed | Overnight high velocity is now a deterministic signal; isolated hour alone does not imply fraud. |
| M11 | Fixed | Score response rejects a tier inconsistent with its safety score; fraud threshold aligned to the shared tiers. |
| M12 | Fixed | Removed markup-to-tool polyfill; mutating chat actions require structured explicit confirmation, validated domain/action and authorized user scope. |
| M13 | Fixed | Follow at most three redirects; validate and pin every hop, including changes in hostname. |
| M14 | Fixed | Incremental body reads enforce a 1 MB cap, short timeouts and cleanup; compressed responses are rejected. |
| M15 | Fixed | Cache uses HMAC of the complete URL with user scope; sanitized telemetry no longer supplies the cache identity. |
| M16 | Fixed | Scan schema accepts HTTP/HTTPS only and validates hostname/port/whitespace. |
| M17 | Fixed | Chat creation role is Literal[user]; content is bounded. |
| M18 | Verified existing fix | Legacy history sanitization expunges objects before changing response text; regression asserts DB contents unchanged. |
| M19 | Fixed | Hostname labels reject underscores; regression expectations updated. |
| M20 | Fixed | Scan endpoint consumes a bounded per-client limiter before expensive scoring. |
| M21 | Fixed | Unique user/domain list indexes plus account-row locking; additive migration collapses duplicates and gives blocklist conflicts priority. |
| M22 | Fixed compatibly | DELETE supports a domain query parameter; legacy JSON bodies remain accepted so existing clients keep working. DELETE bodies are not universally forbidden, but have interoperability limitations. |
| M23 | Fixed | Removed unused HttpUrl import; normalized domain validation remains in the company service boundary. |
| M24 | Verified and strengthened | Existing transaction schema bounds are also applied when the service is called directly. |
| M25 | Fixed | One vote per account/domain; a later opposite vote updates the existing record. |
| M26 | Fixed | Generated manifest specifies connect-src for configured API origins. |
| M27 | Fixed | Stored scan results are limited to 200 records and 24 hours, with tab-close cleanup. |
| M28 | Fixed | All result writes and removals pass through a serialized worker queue. |
| M29 | Fixed | Navigation guard is consulted only after config loaded successfully. |
| M30 | Mitigated | A message alone cannot force logout: bridge reads actual dashboard token storage. Same-origin XSS can already modify that storage and must be prevented in the dashboard. |
| M31 | Fixed | Removed token injection; generated dashboard origin controls legitimate incoming auth sync. |
| M32 | Fixed | Popup checks required DOM elements before registering handlers. |
| M33 | Fixed | Community vote is awaited and an unsuccessful response is shown separately from the saved personal-list decision. |
| M34 | Fixed | Login view is visible by default, with a noscript message and config-failure feedback. |
| M35 | Fixed | Scan page follows system light/dark colors instead of forcing dark backgrounds. |
| M36 | Fixed | Spinner is hidden, preserving reusable DOM state. |
| M37 | Corrected report | The manifest extension_pages CSP covers scan.html. A redundant per-page script policy is unnecessary. |
| M38 | Fixed | Configuration implementation is enclosed in an IIFE with a frozen shared object in the isolated extension context. |
| M39 | Fixed | Test pickle fixture uses a context-managed file. |
| M40 | Fixed | Auth test helper asserts registration success. |
| L1 | Fixed | CORS allows only actual application methods and Authorization/Content-Type headers. |
| L2 | Fixed | Connection pre-ping disabled for SQLite, retained for other databases. |
| L3 | Fixed | SQLite synchronous=FULL retains WAL concurrency and improves committed-write durability. |
| L4 | Fixed | Shared tier conversion handles event feed and cached verdicts; fraud scores use matching thresholds. |
| L5 | Fixed | Malformed stored reasons are logged and returned as a safe empty list. |
| L6 | Fixed | Dashboard confirms event deletion and the API logs the deleted count/user; chat requires explicit confirmation. |
| L7 | Corrected report | auto_error=False is required for anonymous optional scans. Required dependencies explicitly return a Bearer 401 and validate active session identity. |
| L8 | Fixed | Removed unused re import from rule engine. |
| L9 | Fixed | ScoreResult uses final_score as its actual field, preserving the public API key without a confusing alias. |
| L10 | Verified existing fix | LLM configuration uses central Settings; unused os import removed. |
| L11 | Fixed | Provider/DB exceptions are logged internally and replaced by bounded generic user-facing errors. |
| L12 | Fixed | Major-version dependency upper bounds, locked resolutions and a pytest development group. |
| L13 | Fixed | Unrun LLM analysis is represented by null, not a misleading zero; popup displays Not run. |
| L14 | Fixed | Shipped model-card version/feature schema is checked against its bundle during loading. |
| L15 | Corrected report | No circular import is present in the actual dependency graph; app import and endpoint tests succeed. Moving valid imports solely because they are top-level is unnecessary. |
| L16 | Fixed | Phishing and fraud models share the UTC time helper. |
| L17 | Corrected report | JSON-encoded reasons in a String column work on SQLite/PostgreSQL and preserve existing data compatibility. A JSONB-only type would break SQLite; the legacy column name alone is not a runtime defect. |
| L18 | Fixed | New session addresses store network prefixes; audit migration clears historical raw addresses. Privacy and retention behavior are documented. |
| L19 | Fixed | Added companies/__init__.py. |
| L20 | Corrected report | Chrome accepts one to four numeric version components; the current manifest already has four. There is no four-component requirement. |
| L21 | Fixed | Worker catches now report meaningful failures; tab cleanup runs through the serialized queue. |
| L22 | Fixed | Popup preserves intentional password whitespace. |
| L23 | Verified existing fix | minimum_chrome_version is already 111. |
| L24 | Fixed | Scan styles extracted into scan.css. |
| L25 | Fixed | Scan interstitial displays the complete destination URL. |
| L26 | Fixed | Replaced the assigned lambda with a named test helper. |
| L27 | Fixed | Limiter exposes clear(); tests no longer access _hits. |
| L28 | Normalized | Converted the remaining legacy unittest classes/assertions to pytest. Mixed frameworks were not a runtime failure; all 17 original checks remain in the suite. |

## Unnumbered “missing” checklist

- Docker and Compose definitions, CI checks, model-signing/release instructions, privacy information and store listing copy are now supplied.
- README, architecture documentation, `.env.example`, migration files, `.gitignore`, production Uvicorn commands and API tests already existed; the report incorrectly marked them absent. They have been extended where needed.
- Liveness/readiness probes are separated. Uvicorn/application logs are used; the deployment platform must collect, rotate and retain them.
- Bearer headers are not ambient cookies, so cookie CSRF middleware is not applicable. Schema validation, safe output rendering and SQL parameter binding apply at the actual boundaries; blanket string sanitization is not a substitute.
- Explicit re-authentication after short token expiry is the chosen session policy. Refresh tokens are not required for a functional deployment.
- Secret storage and provider-key rotation are deployment responsibilities; environment injection and restart/re-sign procedures are documented. No new external secret provider or telemetry service was connected.
- Extension pages use internal messages and a tightly scoped content bridge. `externally_connectable` would open an additional communication surface and is not needed.
- Extension fonts use local system fallbacks. Dashboard fonts are bundled locally with their licenses.
- Regression tests cover auth/session lifecycle, URL/model boundaries, database isolation, community voting, chat safety, rate limiting, extension worker state and release generation. No claim is made of a full production load benchmark or a validated real-world fraud model.
- Real HTTPS hostnames, operator/contact/legal details, production keys, ingress TLS/rate limits and real store screenshots require deployment-owner input. Templates do not fabricate these or publish a site on the owner's behalf.

## Verification

A follow-up review found and corrected four additional gaps:

- Malformed domains now return HTTP 422 when reporting a company or removing a personal list entry, rather than an unhandled server error.
- Login, password updates and account deletion serialize against the same database account lock and reload credentials before acting, preventing a concurrent old-password login from surviving a password change.
- The legacy schema repair removes duplicate identical votes before adding its unique constraint, allowing the later audit migration to complete.
- The CI workflow quotes its SQLite in-memory URL so the workflow is valid YAML.

- Backend: **85 passed** (including model/HMAC, SSRF, auth/session lifecycle and concurrency, domain validation, cache isolation, chat, companies and migration regressions).
- Extension worker: **7 passed**; release-package builder: **2 passed**.
- Frontend: ESLint clean, TypeScript clean, optimized Next.js production build passed.
- Backend lockfile consistency, Python/JavaScript/JSON syntax and packaged extension archive verified.
- Workflow and Compose YAML parse successfully; the workflow's in-memory database value is verified.
- Only dependency deprecation warnings remain in the backend test run.

Docker is not installed on this machine, so container images and Compose services were not executed. No live Chrome installation test, external AI-provider request, PostgreSQL integration run or production load benchmark was performed. Existing application data and secrets are unchanged; run the documented backup/migration procedure before starting the updated API. The new migration invalidates old sessions, requiring sign-in again.
