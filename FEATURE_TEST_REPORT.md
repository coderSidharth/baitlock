# Baitlock feature test report

Date: 2026-11-12. Scope: the implemented API, dashboard and extension features on this Mac. Existing account data was preserved; tests used generated accounts and the named disposable full-feature account.

## Results

- Backend regression suite: **85 passed**.
- Extension worker regression suite: **7 passed**.
- Release-builder suite: **2 passed**.
- Expanded live API runner: **98 HTTP checks passed**. Additional live checks covered deep-page fetching, real AI content scoring and session-cap enforcement.
- Frontend ESLint, TypeScript and optimized production build: **passed** after the fixes below.
- Earlier live PostgreSQL 18 migration/API integration checks remain valid; backend source did not change in this feature pass.

## Feature coverage

| Feature | Verification | Result |
|---|---|---|
| Registration | Invalid inputs, duplicate/case-insensitive email, isolated accounts; browser signup and automatic login | Pass |
| Login | JSON and form login, missing/malformed/wrong credentials; dashboard and real popup login | Pass |
| Logout and revoked tokens | Live API and popup logout; revoked tokens rejected | Pass |
| Sessions | Session listing; 11 live sign-ins leave exactly 10 sessions; oldest token rejected; expiry, nonce and concurrent credential changes covered by regressions | Pass |
| Profile | Browser name update persists; email change and duplicate/current-password checks exercised through API | Pass |
| Password changes | Browser required-field rejection and cancel; actual changes and token revocation exercised through API | Pass |
| Account deletion | Wrong-password rejection and deletion/cascade through API; temporary-account browser confirmation covered in the earlier integration pass | Pass |
| Fast URL scans | Real trained artifact, cache reuse, URL validation and persisted-event sanitization | Pass |
| Deep URL scans | Public-page fetch returned 340 bytes of text; live supplied-content analysis returned an LLM score of 100 | Pass |
| SSRF/model trust boundaries | Private-address/redirect/DNS pinning, response limits, HMAC verification and unsafe-pickle rejection in regression suite | Pass |
| Personal lists | Add/remove, subdomain matching, mutual exclusivity, account isolation, malformed input; browser Mark Safe/Remove | Pass |
| Override presentation | One card for an explicit block plus two matching historical events; block score 0 and trusted scores 100 | Pass after fixes |
| Community votes | Existing vote updated rather than duplicated; invalid types rejected; both real popup review buttons | Pass |
| Fraud screening | Safe/geo-distance/over-limit presets; validation boundaries; actual rule-only reasons and scores | Pass |
| Event feed | Account isolation, type filters, stable pagination, input bounds; live feed risk labels and online/offline state | Pass after fixes |
| Dashboard filters | Fraud shows transaction cards, phishing shows URL cards | Pass |
| Export | Real JSON download parsed; selected fraud feed exported three records | Pass |
| Clear events | API account isolation; native browser Cancel and OK; seeded event removed; new event fetched using Refresh feed | Pass after fix |
| AI chat | Live synthetic free-text reply, history persistence/reset, status query, confirmed block/allow quick actions | Pass |
| Chat action authorization | Exact structured confirmation and clear-log confirmation enforced by regression tests | Pass |
| Theme/sidebar/mobile | Theme toggle, sidebar collapse/expand; 390×844 layout with document width 390 and no page-level horizontal overflow | Pass |
| Documentation | Public/dashboard routes, section search/navigation, command copy verified by native paste, extension download integrity | Pass after instruction corrections |
| Extension installation | Unpacked extension successfully loaded in Brave, then removed after testing with user authorization | Pass |
| Automatic extension scanning | Dashboard session sync, signed-out gate, safe release, actual blocked warning, allow-list release | Pass |
| Manual extension scanning | Visible-page scan, current URL/result rendering, risk breakdown and review actions | Pass |
| Extension failures | Wrong credentials rejected; offline manual scan showed Failed to fetch; automatic scan held the destination and Continue anyway released it | Pass |
| Extension security/state/release | Sender validation, expired tokens, stale completion rejection, one-use bypass, serialized/bounded storage and release permissions | Regression suites pass |
| Health/readiness/CORS | Live health/readiness/liveness, allowed-origin preflight; degraded-readiness behavior in regression suite | Pass |

## Fixes found by feature testing

- Corrected reversed manual allow/block safety scores and duplicate domain cards.
- Failed list reads/writes now show errors and cannot silently report mutation success.
- Live feed reports connecting/active/offline status and retains separate high, critical and moderate tiers.
- Fraud preset names describe their inputs without promising a verdict the configured engine does not return.
- The post-deletion action is now Refresh feed, which retrieves new events. Deleted records are not presented as restorable.
- Shared documentation now uses the actual API start command, locked dependency setup, correct LLM score band, rule-only default fraud behavior, and the extracted folder containing manifest.json.

## Reproduce

Start the API locally, then run from the repository root:

```bash
uv run --project server python scripts/check_live_api.py
node --test tests/extension.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
uv run --project server pytest -q server/tests
cd client
npm run lint
npx tsc --noEmit
npm run build
```

The live runner targets localhost:8000, creates random test accounts, and cleans them up in its finally block. Existing users are never selected for mutation. If the API is interrupted while the runner is cleaning up, inspect its generated accounts before retrying.

## Cleanup and limits

The temporary extension was removed. Temporary accounts and their related data were removed. Final database counts and integrity were checked against the original baseline. The local API/dashboard were restored after offline tests.

Google Chrome itself is not installed; the real extension checks used Brave Nightly (Chromium). Docker is not installed, so container/Compose execution remains untested. This pass is functional/regression verification, not an exhaustive cross-browser/OS, production-load or Web Store review certification. Native browser controls were used where the in-app browser could not automate JavaScript confirmation dialogs.
