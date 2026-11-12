# Live integration verification — 2026-11-12

## Database migration

- Active database: `server/events.db` (SQLite).
- Backup: `server/backups/events-before-audit-20261112-164726.db` (restricted permissions, excluded from Git).
- The recorded revision was `488fcb5ed3ff`, but company flags, personal lists and session tables already existed. A direct upgrade was tested only on a disposable copy and correctly rejected the duplicate table.
- After inspecting those existing schemas, the copied database was stamped to `eeb12aaa3456` and upgraded through repair and audit migrations. Integrity and foreign-key checks passed. The same verified procedure was then applied to the backed-up active database.
- Final revision: `7a21d984bf02`; integrity check: `ok`; no foreign-key violations.
- Final original counts: 1 user, 229 phishing events, 15 fraud events, 8 allow-list entries, 0 block-list entries, 4 votes, 0 chat messages. All were preserved.
- Two legacy sessions were revoked. Users must sign in again.

## Checks completed

- 34 live HTTP checks against the SQLite API and dashboard, plus 33 against an isolated PostgreSQL 18 API and dashboard routes.
- Health/readiness, registration/login, profile/session access, block/allow precedence, invalid-domain rejection, voting, URL scanning, fraud scoring, event/history reads, CORS, password revocation, logout and account deletion.
- PostgreSQL migration from an empty database to head, using the locked psycopg 3.3.8 driver. A temporary local cluster was used and shut down after testing; it did not replace the configured SQLite database.
- Browser: sign-in, live fraud simulation with visible persisted result, overrides excluding fraud transactions, profile/session display, password-confirmed account deletion and logout.
- A synthetic request to the configured AI chat returned `READY`.
- Corrected misleading dashboard labels found during browser checks: no events now displays `No events`; model health is labelled `Detection Model`; fraud text avoids claiming a neural model; distance labels match API kilometres.
- Frontend ESLint, TypeScript and production build passed after those corrections. Rebuilt dashboard verified in browser with no console errors.
- All temporary accounts and their test data were removed; original database counts and integrity rechecked afterward.

## Running locally

API: http://127.0.0.1:8000
Dashboard: http://localhost:3000

## Remaining limits

- Follow-up feature testing loaded the real extension in Brave Nightly and verified login, dashboard session sync, automatic/manual scanning, blocking, allow-list release, review actions and offline behavior. The extension was removed after testing. Google Chrome itself is not installed. See FEATURE_TEST_REPORT.md.
- Docker is not installed; container images and Compose execution remain unverified.
- These are functional smoke checks, not a production load benchmark or exhaustive security proof.

## Expanded feature pass

See `FEATURE_TEST_REPORT.md` for 98 live HTTP checks, real extension tests, discovered UI fixes, repeated regression/build results and remaining platform limits. `scripts/check_live_api.py` preserves the repeatable live API checks.
