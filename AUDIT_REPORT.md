# 🔒 BaitLock — Full Project Audit Report

> **Audited:** 2026-11-12 | **Total Issues Found: 100** | **Files Audited: 40+**

> [!CAUTION]
> **6 CRITICAL** vulnerabilities found that must be fixed before any deployment. These include remote code execution vectors, SSRF bypasses, and production-breaking configuration issues.

---

## Project Overview

BaitLock is a phishing/fraud detection system comprising:
- **Python FastAPI Backend** (`server/`) — ML-powered phishing URL analysis, fraud detection, auth, chat AI assistant
- **Chrome Browser Extension** (`extension/`) — Real-time URL scanning, phishing interstitial, user auth sync

---

## Summary Dashboard

| Severity | Server Core | Server Features | Extension | **Total** |
|----------|:-----------:|:---------------:|:---------:|:---------:|
| 🔴 **CRITICAL** | 0 | 2 | 4 | **6** |
| 🟠 **HIGH** | 4 | 10 | 12 | **26** |
| 🟡 **MEDIUM** | 12 | 13 | 15 | **40** |
| 🔵 **LOW** | 12 | 7 | 9 | **28** |
| **Total** | **28** | **32** | **40** | **100** |

---

## 🔴 CRITICAL Issues (6) — Must Fix Before Deployment

### C1. Pickle Deserialization — Remote Code Execution
- **File:** [phishing_ml.py](file:///Users/macsid/baitlock/server/app/features/phishing/phishing_ml.py#L90-L95)
- **Lines:** 94-95
- **Problem:** `pickle.load(f)` on `phishing_url_model.pkl` executes arbitrary Python code. If an attacker replaces the model file (supply-chain attack, compromised CI, writable directory), they get full RCE on the server. No checksum, signature, or safe format is used.
- **Fix:** Switch to ONNX/safetensors/joblib with restricted classes, or add HMAC signature verification of the pkl file.

### C2. SSRF via DNS Rebinding in `_is_safe_url`
- **File:** [service.py](file:///Users/macsid/baitlock/server/app/features/phishing/service.py#L108-L137)
- **Lines:** 108-137
- **Problem:** `_is_safe_url()` resolves hostname and checks for private IPs, but `requests.get()` re-resolves DNS independently. A DNS rebinding attack returns a public IP for the check, then a private IP (e.g., `169.254.169.254` cloud metadata) for the actual request. Classic TOCTOU SSRF bypass.
- **Fix:** Resolve DNS once and pin the IP using a custom `requests` transport adapter.

### C3. Extension `host_permissions` Locked to Localhost
- **File:** [manifest.json](file:///Users/macsid/baitlock/extension/manifest.json#L32-L35)
- **Lines:** 32-35
- **Problem:** `host_permissions` only allows `localhost:8000`. Any production API URL will be blocked by Chrome. **Extension is non-functional outside development.**
- **Fix:** Add production API URLs or implement environment-based configuration.

### C4. Extension `content_scripts` Only Match Localhost
- **File:** [manifest.json](file:///Users/macsid/baitlock/extension/manifest.json#L36-L45)
- **Lines:** 36-45
- **Problem:** `content.js` (token syncing) only injects on `localhost:3000`. Auth sync is dead in production.
- **Fix:** Add production web app URLs to the content script matches.

### C5. Token Theft Vector — Content Script Blindly Trusts localStorage
- **File:** [content.js](file:///Users/macsid/baitlock/extension/content.js#L4-L6)
- **Lines:** 4-6
- **Problem:** Any XSS in the web app can set `localStorage.access_token` to an arbitrary value. The content script blindly trusts and stores it in extension storage — token injection attack.
- **Fix:** Validate token format (JWT structure, reasonable length) before storing.

### C6. Hardcoded Localhost URLs in Extension Config
- **File:** [config.js](file:///Users/macsid/baitlock/extension/config.js#L8-L10)
- **Lines:** 8-10
- **Problem:** `API_BASE` and `APP_URL` are hardcoded to `http://localhost`. Entire extension is locked to development mode. HTTP-only means credentials travel in plaintext.
- **Fix:** Implement build-time config injection with HTTPS enforcement for production.

---

## 🟠 HIGH Issues (26)

### Server Core (4)

| # | File | Lines | Issue |
|---|------|-------|-------|
| H1 | [security.py](file:///Users/macsid/baitlock/server/app/core/security.py#L12-L27) | 12-27 | Triple bcrypt verification — 3 strategies tried per login, tripling CPU cost. Legacy paths never match new hashes. DoS amplification. |
| H2 | [security.py](file:///Users/macsid/baitlock/server/app/core/security.py#L31) | 31 | `sha256().digest()` (raw binary with null bytes) fed to bcrypt — fragile, non-portable. Use `.hexdigest()`. |
| H3 | [llm.py](file:///Users/macsid/baitlock/server/app/integrations/llm.py#L33) | 33,45,52,100,332 | Synchronous `requests.post()` + `time.sleep()` blocks threadpool workers for up to 120s. Under load, exhausts the default 40-worker threadpool, hanging all requests. |
| H4 | [alembic.ini](file:///Users/macsid/baitlock/server/alembic.ini#L89) | 89 | Hardcoded placeholder `driver://user:pass@localhost/dbname` — credential in plaintext. |

### Server Features (10)

| # | File | Lines | Issue |
|---|------|-------|-------|
| H5 | [fraud/repository.py](file:///Users/macsid/baitlock/server/app/features/fraud/repository.py#L17-L19) | 17-19 | No error handling on `db.commit()` — unhandled exception crashes request, leaves DB dirty. |
| H6 | [chat/router.py](file:///Users/macsid/baitlock/server/app/features/chat/router.py#L34-L49) | 34-49 | All blocklist/whitelist domains leaked into LLM system prompt — data exposure, token limit risk, prompt injection vector. |
| H7 | [chat/router.py](file:///Users/macsid/baitlock/server/app/features/chat/router.py#L34-L35) | 34-35 | Blocklist query includes `user_id IS NULL` clause — dead code or potential data leak. |
| H8 | [chat/router.py](file:///Users/macsid/baitlock/server/app/features/chat/router.py#L149-L162) | 155 | Chat history returns ALL messages with no `LIMIT` — OOM risk. |
| H9 | [auth/router.py](file:///Users/macsid/baitlock/server/app/features/auth/router.py#L137-L141) | 137-141 | `DELETE /me` requires no re-authentication — stolen JWT can delete account. |
| H10 | [auth/router.py](file:///Users/macsid/baitlock/server/app/features/auth/router.py#L86-L89) | 86-89 | No session cleanup — `user_sessions` table grows unboundedly. No expiry, no max cap. |
| H11 | [auth/schemas.py](file:///Users/macsid/baitlock/server/app/features/auth/schemas.py#L12-L16) | 12-16 | Password update has no complexity requirements and `current_password` coupling is schema-level unenforced. |
| H12 | [companies/router.py](file:///Users/macsid/baitlock/server/app/features/companies/router.py#L11-L45) | 11-45 | Community flags weaponizable — 3 throwaway accounts can suppress any domain score by 35 points. No rate limit on flag creation. |
| H13 | [companies/schemas.py](file:///Users/macsid/baitlock/server/app/features/companies/schemas.py#L5-L7) | 5-7 | `flag_type: str` accepts any string. No Enum/Literal validation. |
| H14 | [fraud/fraud_ml.py](file:///Users/macsid/baitlock/server/app/features/fraud/fraud_ml.py#L6-L39) | 6-39 | Fraud ML trains on synthetic data at every process start. No real-world signal, startup latency, multi-worker inconsistency. |

### Extension (12)

| # | File | Lines | Issue |
|---|------|-------|-------|
| H15 | manifest.json | 25-30 | No broad `host_permissions` for production API calls. |
| H16 | [background.js](file:///Users/macsid/baitlock/extension/background.js#L3) | 3,42-43,78 | `bypassNavigations` Map leaks memory — entries only cleaned on tab close. |
| H17 | [background.js](file:///Users/macsid/baitlock/extension/background.js#L1) | 1 | No error handling if `config.js` fails to load — service worker dies silently. |
| H18 | [content.js](file:///Users/macsid/baitlock/extension/content.js#L5-L6) | 5-6 | No token format validation before storing in extension storage. |
| H19 | [content.js](file:///Users/macsid/baitlock/extension/content.js#L16-L27) | 16-27 | `window.addEventListener('message')` vulnerable to same-origin spoofing. |
| H20 | [popup.js](file:///Users/macsid/baitlock/extension/popup.js#L140-L144) | 140-144 | Credentials sent over HTTP without HTTPS enforcement. |
| H21 | [popup.js](file:///Users/macsid/baitlock/extension/popup.js#L104-L119) | 104-119 | `syncWebAuth` injects token into web app localStorage — bidirectional token injection. |
| H22 | [popup.js](file:///Users/macsid/baitlock/extension/popup.js#L3) | 3,168 | Token never refreshed — expired JWT causes silent auth failures. |
| H23 | [popup.html](file:///Users/macsid/baitlock/extension/popup.html#L7) | 7 | External Google Fonts CDN blocked by MV3 default CSP. |
| H24 | [popup.css](file:///Users/macsid/baitlock/extension/popup.css#L1) | 1 | External Google Fonts `@import` blocked by MV3 CSP. |
| H25 | [scan.js](file:///Users/macsid/baitlock/extension/scan.js#L58-L66) | 58-66 | No timeout fallback — user can be trapped on interstitial page. |
| H26 | [config.js](file:///Users/macsid/baitlock/extension/config.js#L8-L10) | 8-10 | HTTP-only communication — tokens and credentials in plaintext. |

---

## 🟡 MEDIUM Issues (40)

### Server Core (12)

| # | File | Lines | Issue |
|---|------|-------|-------|
| M1 | [config.py](file:///Users/macsid/baitlock/server/app/core/config.py#L42) | 42 | `.env` path relative to CWD, not project root — fails when started from different directory |
| M2 | [config.py](file:///Users/macsid/baitlock/server/app/core/config.py#L33) | 33 | 1-week JWT token expiry with no refresh mechanism |
| M3 | [database.py](file:///Users/macsid/baitlock/server/app/core/database.py#L8-L9) | 8-9 | Misleading StaticPool comment; pool choice not explicitly considered for SQLite |
| M4 | [security.py](file:///Users/macsid/baitlock/server/app/core/security.py#L10) | 10 | `_safe_password_bytes` is dead/misleading code |
| M5 | [security.py](file:///Users/macsid/baitlock/server/app/core/security.py#L33-L41) | 33-41 | JWT missing `iat` and `jti` claims — can't invalidate or revoke tokens |
| M6 | [rate_limit.py](file:///Users/macsid/baitlock/server/app/core/rate_limit.py#L46-L48) | 46-48 | Memory cleanup only removes empty deques — unbounded growth under attack |
| M7 | [health.py](file:///Users/macsid/baitlock/server/app/api/v1/health.py#L20) | 20 | Degraded status when ML model not from artifact — load balancer may remove instance |
| M8 | [events.py](file:///Users/macsid/baitlock/server/app/api/v1/events.py#L28-L34) | 28-34 | Inefficient in-memory pagination — loads far more rows than needed |
| M9 | [deps.py](file:///Users/macsid/baitlock/server/app/api/deps.py#L60-L61) | 60-61 | No `is_active` check — disabled users retain access |
| M10 | [rule_engine.py](file:///Users/macsid/baitlock/server/app/common/rule_engine.py#L61) | 61 | `hour` parameter accepted but never used |
| M11 | [schemas.py](file:///Users/macsid/baitlock/server/app/common/schemas.py#L48-L53) | 48-53 | `tier_matches_score` validator is a silent no-op (`pass`) |
| M12 | [llm.py](file:///Users/macsid/baitlock/server/app/integrations/llm.py#L275-L291) | 275-291 | Fragile `<function=...>` regex — prompt injection vector for tool calls |

### Server Features (13)

| # | File | Lines | Issue |
|---|------|-------|-------|
| M13 | [phishing/service.py](file:///Users/macsid/baitlock/server/app/features/phishing/service.py#L132) | 132 | `allow_redirects=False` misses content for analysis |
| M14 | [phishing/service.py](file:///Users/macsid/baitlock/server/app/features/phishing/service.py#L127-L137) | 131-134 | No response size limit — malicious server can OOM with multi-GB response |
| M15 | [phishing/service.py](file:///Users/macsid/baitlock/server/app/features/phishing/service.py#L186-L207) | 192-206 | Cache lookup compares sanitized vs unsanitized URL — false cache hits/misses |
| M16 | [phishing/schemas.py](file:///Users/macsid/baitlock/server/app/features/phishing/schemas.py#L20-L21) | 20-21 | Accepts `ftp://` URLs but service rejects them — schema/service mismatch |
| M17 | [chat/schemas.py](file:///Users/macsid/baitlock/server/app/features/chat/schemas.py#L5-L7) | 6-7 | `role: str` accepts any value — client can inject `"system"` or `"assistant"` roles |
| M18 | [chat/router.py](file:///Users/macsid/baitlock/server/app/features/chat/router.py#L156-L162) | 159-161 | ORM object mutation may auto-flush to DB, permanently replacing content |
| M19 | [phishing/service.py](file:///Users/macsid/baitlock/server/app/features/phishing/service.py#L25) | 25 | `_LABEL` regex allows underscores — RFC 1035 violation |
| M20 | [phishing/router.py](file:///Users/macsid/baitlock/server/app/features/phishing/router.py#L12-L19) | 12-19 | No rate limiting on `/check` endpoint — expensive ML+LLM calls unprotected |
| M21 | [phishing/models.py](file:///Users/macsid/baitlock/server/app/features/phishing/models.py#L19-L39) | 19-39 | No unique constraint on whitelist/blocklist — race condition duplicates |
| M22 | [phishing/router.py](file:///Users/macsid/baitlock/server/app/features/phishing/router.py#L45-L63) | 45-63 | DELETE endpoints use request body — RFC 7231 violation, proxies may strip |
| M23 | [companies/schemas.py](file:///Users/macsid/baitlock/server/app/features/companies/schemas.py#L1) | 1 | `HttpUrl` imported but unused — likely forgotten validation |
| M24 | [fraud/service.py](file:///Users/macsid/baitlock/server/app/features/fraud/service.py#L6) | 6 | No input range validation — ML produces meaningless scores for out-of-range inputs |
| M25 | [companies/router.py](file:///Users/macsid/baitlock/server/app/features/companies/router.py#L26-L33) | 26-33 | User can flag same domain as both malicious AND legitimate |

### Extension (15)

| # | File | Lines | Issue |
|---|------|-------|-------|
| M26 | manifest.json | — | No explicit `content_security_policy` for `connect-src` |
| M27 | background.js | 53-58 | `scan_results` grows without bound in storage |
| M28 | background.js | 53-59 | Race condition in read-modify-write of `scan_results` |
| M29 | background.js | 39 | `baitlockIsAppUrl` not guarded if config.js fails |
| M30 | content.js | 24-26 | Any same-origin script can force logout |
| M31 | popup.js | 102 | `syncWebAuth` URL pattern only matches localhost |
| M32 | popup.js | 29-30 | No null checks on DOM elements |
| M33 | popup.js | 283-293 | Fire-and-forget community flag with silent error |
| M34 | popup.html | 22,38 | Both views start hidden — blank page if JS fails |
| M35 | scan.html | 9 | Hardcoded dark theme, inconsistent with popup |
| M36 | scan.js | 11,27,35 | Spinner permanently removed from DOM instead of hidden |
| M37 | scan.js | — | No explicit CSP on scan.html |
| M38 | config.js | 6 | Global variable name collision risk |
| M39 | test_api_production.py | 135 | Resource leak — `open()` without `with` |
| M40 | test_api_production.py | 60 | Registration result not checked |

---

## 🔵 LOW Issues (28)

### Server Core (12)

| # | File | Lines | Issue |
|---|------|-------|-------|
| L1 | main.py | 30-31 | Overly permissive CORS `allow_methods`/`allow_headers=["*"]` |
| L2 | database.py | 14 | `pool_pre_ping` unnecessary for SQLite |
| L3 | database.py | 26 | `synchronous=NORMAL` risks losing last commit on crash |
| L4 | events.py | 47,67 | Tier classification logic duplicated and inconsistent |
| L5 | events.py | 37-39 | Silent swallowing of JSON parse errors |
| L6 | events.py | 80-88 | Destructive DELETE with no confirmation/audit trail |
| L7 | deps.py | 11 | `auto_error=False` makes auth fragile |
| L8 | rule_engine.py | 1 | Unused `import re` |
| L9 | schemas.py | 22 | `alias="final_score"` confusing |
| L10 | llm.py | 8-18 | `os.getenv` duplicates pydantic-settings, bypasses validation |
| L11 | llm.py | 89-90 | Internal error details leaked to API consumer |
| L12 | pyproject.toml | 7-29 | No upper bounds on dependency versions |

### Server Features (7)

| # | File | Lines | Issue |
|---|------|-------|-------|
| L13 | phishing/service.py | 333 | `llm_score` defaults to `0` instead of `None` — misleading |
| L14 | phishing/model_card.json | — | Not validated at runtime, can drift from code |
| L15 | chat/router.py | 12-15 | Top-level imports risk circular dependency |
| L16 | phishing/models.py + fraud/models.py | 5-6 | `_utc_now()` duplicated across models |
| L17 | phishing/models.py | 16 | `reasons_jsonb` uses String, not JSONB type |
| L18 | auth/models.py | 20 | Raw IP address stored — GDPR PII concern |
| L19 | companies/ | — | Missing `__init__.py` — inconsistent with other modules |

### Extension (9)

| # | File | Lines | Issue |
|---|------|-------|-------|
| L20 | manifest.json | 4 | Version format should be 4-part (`x.y.z.w`) |
| L21 | background.js | 113 | Empty catch block swallows errors |
| L22 | popup.js | 127 | Password `.trim()` removes intentional whitespace |
| L23 | popup.css | various | `color-mix()` needs Chrome 111+ but min version is 103 |
| L24 | scan.html | 7-21 | Extensive inline styles |
| L25 | scan.js | 15 | Only hostname shown, not full URL path |
| L26 | test_api_production.py | 147 | Lambda assigned to variable |
| L27 | test_api_production.py | 52 | Accesses private `_hits` attribute |
| L28 | test_unit_security.py | — | Mixed test frameworks (unittest vs pytest) |

---

## 🚫 What's MISSING for a Complete Deployable Project

### Infrastructure & DevOps
1. **No Dockerfile / docker-compose.yml** — No containerization for deployment
2. **No CI/CD pipeline** (`.github/workflows/`, Jenkinsfile, etc.)
3. **No `.env.example`** — New developers don't know required env vars
4. **No `README.md`** with setup/run instructions
5. **No production WSGI/ASGI config** — No Gunicorn/Uvicorn production config, no `[project.scripts]` entry point
6. **No database migration files** (`alembic/versions/`) — Only `alembic.ini` exists, no actual migrations
7. **No `.gitignore`** covering `__pycache__`, `.env`, `*.pyc`, `events.db*`, `.ruff_cache`
8. **No logging configuration** — No structured logging, no log levels, no log rotation
9. **No health check separation** (liveness vs readiness probes)

### Security
10. **No HTTPS enforcement** anywhere — extension and server both use HTTP
11. **No token refresh mechanism** — 1-week JWT with no refresh flow
12. **No CSRF protection** on state-changing endpoints
13. **No input sanitization middleware** (XSS, SQL injection at middleware level)
14. **No secrets management** — API keys expected as plain env vars
15. **No API key rotation mechanism**

### Testing
16. **No test coverage** for phishing ML, fraud ML, chat, or companies modules
17. **No integration tests** — Only unit tests and production API tests
18. **No extension tests** at all
19. **No load/stress tests** for rate limiting and threadpool behavior

### Extension
20. **No production configuration mechanism** — No env-based or build-time config injection
21. **No bundled fonts** — Google Fonts must be downloaded locally for MV3 compliance
22. **No privacy policy** — Required by Chrome Web Store
23. **No store listing assets** — Screenshots, descriptions, promotional images
24. **No token refresh / expiry handling** in extension
25. **No `externally_connectable`** declared in manifest
26. **No error reporting / telemetry** for production debugging
27. **`minimum_chrome_version` should be 111+** for CSS `color-mix()` support

### Documentation
28. **No API documentation** beyond auto-generated OpenAPI (no usage guides)
29. **No architecture documentation** explaining the scoring pipeline
30. **No deployment guide** for production setup

---

## Recommended Fix Order

```mermaid
flowchart TD
    A["🔴 Phase 1: CRITICAL Security Fixes"] --> B["🟠 Phase 2: HIGH Bugs & Security"]
    B --> C["🟡 Phase 3: MEDIUM Issues"]
    C --> D["🔵 Phase 4: LOW Polish"]
    D --> E["🚫 Phase 5: Missing Infrastructure"]
    
    A --> A1["C1: Pickle RCE"]
    A --> A2["C2: SSRF DNS Rebinding"]
    A --> A3["C3-C6: Extension Production Config"]
    
    B --> B1["H1-H2: Security.py bcrypt"]
    B --> B2["H3: Async LLM calls"]
    B --> B3["H5: Fraud repo error handling"]
    B --> B4["H9: Account deletion re-auth"]
    B --> B5["H6-H8: Chat safety"]
    
    E --> E1["Dockerfile + CI/CD"]
    E --> E2["README + .env.example"]
    E --> E3["DB migrations"]
    E --> E4["Test coverage"]
```

> [!IMPORTANT]
> I will fix these **one at a time**, starting with CRITICAL issues. For each fix, I'll explain exactly **what** I'm changing, **why**, and show the code diff — and wait for your approval before making any change.
