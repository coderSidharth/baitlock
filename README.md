# Baitlock - Phishing Shield

This project contains a Next.js frontend (`client`), a FastAPI backend (`server`), and a Chrome extension (`extension`).

## Prerequisites

Ensure you have the following installed on your system:
- [bun](https://bun.sh/) (for the frontend)
- [uv](https://docs.astral.sh/uv/) (for the backend)
- Python 3.12+ (managed via `uv` or installed locally)

---

## Running the Application Locally

You will need two separate terminal windows to run the frontend and backend simultaneously.

### 1. Start the Backend (FastAPI)

Open a terminal and navigate to the `server` directory:

```bash
cd server
```

Copy the example environment variables and configure your LLM provider (Ollama or Groq API):

```bash
cp .env.example .env
```
*Note: Make sure to open `.env` and set `LLM_PROVIDER`, `OLLAMA_MODEL`, or `GROQ_API_KEY` accordingly before starting.*

Install the dependencies (if you haven't already):

```bash
uv sync
```
*(Note: `uv` will automatically create a `.venv` virtual environment for you.)*

Initialize the SQLite database with Alembic migrations:

```bash
uv run alembic upgrade head
```

Run the FastAPI development server:

```bash
uv run fastapi dev app/main.py
```
*(Alternatively, you can run `uv run uvicorn app.main:app --reload`)*

The backend server will start at **http://localhost:8000** (or similar, check the terminal output).

---

### 2. Start the Frontend (Next.js)

Open a **new** terminal window and navigate to the `client` directory:

```bash
cd client
```

Install the Node.js dependencies using `bun`:

```bash
bun install
```

Run the Next.js development server:

```bash
bun run dev
```

The frontend will be available at **http://localhost:3000** (or similar, check the terminal output).

---

### 3. Install the Chrome Extension

To enable real-time phishing detection in your browser:
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** in the top right corner.
3. Click **Load unpacked** and select the `extension` folder located in the root of this project.
4. The Baitlock Phishing Shield extension is now active!

---

## Phishing Detection Model

The Layer-2 URL classifier ships pre-trained (`server/app/features/phishing/phishing_url_model.pkl`,
v2.1.0, HistGradientBoostingClassifier). Full metrics, data sources and limitations are in
[`model_card.json`](server/app/features/phishing/model_card.json).

**Evaluation** — 35,151 held-out URLs from registered domains never seen in training:

| Metric | Value |
|---|---|
| ROC-AUC | 0.9159 |
| PR-AUC | 0.9435 |
| Precision / recall / FPR at the blocking threshold (p ≥ 0.75) | 95.8% / 68.1% / 4.0% |
| Precision / recall / FPR at p ≥ 0.90 | 98.4% / 57.0% / 1.2% |
| End-to-end (rules + model + reputation): reference phishing URLs blocked | 52/52 |
| End-to-end: real legitimate sites blocked (sign-in, OAuth, banking, wallets…) | 1/112 |

The model is one signal among several: user block/allow lists always win, deterministic rules catch IPs,
punycode, `user@host` tricks and plain HTTP, and the optional LLM layer analyses page content.

### Retraining

```bash
cd server
```
```bash
uv run python scripts/build_dataset.py --raw-dir /tmp/baitlock-raw
```
```bash
uv run python train.py --compare
```

`build_dataset.py` downloads the public sources, de-duplicates and de-biases them (balanced classes, matched
host-only/full-URL mix, per-domain caps, no cross-label conflicts) and regenerates the domain-reputation list.
The build is deterministic. `train.py` prints the held-out metrics and an end-to-end check, then writes the
model bundle and model card. The service validates the bundle's feature schema at startup and reports it at
`GET /api/v1/health`.

---

## Production Deployment

**Backend** (`server/.env`, see `server/.env.example`):

| Variable | Production value |
|---|---|
| `ENVIRONMENT` | `production` — the server refuses to start without a strong `SECRET_KEY` or with a wildcard CORS origin |
| `SECRET_KEY` | a stable random secret: `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `ALLOWED_ORIGINS` | your dashboard origin(s), comma-separated, e.g. `https://app.example.com` |
| `DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require` (SQLite runs in WAL mode and is fine for a single instance) |
| `LLM_PROVIDER` / `GROQ_API_KEY` | optional content analysis; detection works without it |

Run schema migrations before starting the API. For PostgreSQL, use the `postgresql+psycopg://` URL shown above; URL-encode special characters in the username or password.

For an existing database created by an earlier Baitlock release (before the migrations were complete), mark the old migration chain as applied once, then run the repair migration:

```bash
uv run alembic stamp eeb12aaa3456
uv run alembic upgrade head
```

Use `alembic upgrade head` directly for a new database or a database that already has an Alembic revision recorded.
```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers
```

Serve it behind HTTPS. Failed logins are rate-limited per (IP, email); with several instances, also rate-limit
at the reverse proxy because the in-process limiter is per worker.

**Frontend** (`client/.env`, see `client/.env.example`): set `NEXT_PUBLIC_API_URL` to the public API URL, then

```bash
bun run build && bun run start
```

**Extension**: use `scripts/build_extension.py` to generate a package for your HTTPS API and dashboard origins; see the release instructions below.

**Health check**: `GET /api/v1/health` returns `healthy` only when the database is reachable and the shipped
model artifact loaded (not the fallback model).

### Tests

```bash
cd server && uv run --with pytest python -m pytest -q tests
```

## Audit fixes and deployment checks

The original findings are preserved in `AUDIT_REPORT.md`; `AUDIT_RESOLUTION.md` tracks every finding against the current implementation.

Authentication uses one-hour access tokens by default, with explicit sign-in after expiry. Sessions are capped at ten per account. Account deletion and sensitive profile changes require the current password. A password change revokes existing sessions. The API's server-side session check also rejects revoked, expired and inactive accounts.

Community votes are advisory and cannot alter a detection verdict. The synthetic fraud model is disabled by default and always disabled in production. Production transaction screening uses deterministic rules until an independently validated model is provided; it is not a payment authorization system.

### Run verification

```bash
uv sync --project server --frozen
uv run --project server pytest -q server/tests
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/extension.test.cjs
cd client
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

The frontend bundles its Inter and Fira Code Latin fonts and their licenses, so production builds do not need Google Fonts access. CI runs the same checks automatically. Backend tests use isolated databases and mock external AI and page-fetch traffic.

### Sign the model and migrate

Set a separate, strong `MODEL_HMAC_KEY` in your deployment's secret store and trusted build environment. From `server/`, sign the known-good model before packaging:

```bash
uv run python -m app.features.phishing.phishing_ml --sign
uv run alembic upgrade head
```

Ship the `.pkl.sig` with the artifact, and provide the same key to the API. Do not re-sign a model at server startup: signatures must establish trust before deserialization. Retraining must also update the reviewed constructor allowlist and model card when the artifact format changes.

Back up existing databases before migration. Audit migrations retain distinct user/domain decisions, collapse duplicate decisions to their latest row and invalidate legacy sessions that lack the new session identifier. Historical raw session IPs are cleared; new sessions store network prefixes. Existing sessions may require a fresh sign-in after upgrading. An old database without migration history needs the repair procedure documented above; do not stamp a populated database to `head`.

### Build a release extension

```bash
python3 scripts/build_extension.py \
  --production \
  --api https://YOUR_API_HOST/api/v1 \
  --app https://YOUR_DASHBOARD_HOST \
  --output client/public/baitlock-extension.zip
```

Use your actual HTTPS origins. The builder generates matching configuration, API/dashboard host permissions, content-script matches and connection CSP. It rejects insecure release URLs and replaces the output archive atomically. The checked-in unpacked extension remains configured for localhost development. It never asks for access to all sites merely to reach the API.

The dashboard may sync an authenticated session into the extension after server validation. Signing in from the popup signs in the extension only; it no longer injects tokens into dashboard tabs. Expired sessions prompt a fresh sign-in. A failed scan holds the destination and offers an explicit continue button.

### Containers and operations

`compose.yaml` supplies API and dashboard services. Copy and configure `server/.env`, sign the trusted model, then run `docker compose up --build`. The example binds ports to loopback for a local HTTPS reverse proxy. Set the dashboard's public API URL at image build time. Set `ALLOWED_ORIGINS` to the real HTTPS dashboard origin, keep database and secret files private, and rate-limit at the ingress when running several workers or replicas. In-process rate limits and AI concurrency limits are per worker.

Use `/api/v1/live` for process liveness and `/api/v1/ready` for readiness (503 if the database or shipped model is unavailable). `/api/v1/health` remains a diagnostic endpoint. Capture Uvicorn/application logs with your deployment platform, apply log retention there, and avoid logging authorization headers, page bodies or full scanned URL queries.

The application uses explicit bearer headers rather than ambient authentication cookies; a separate CSRF cookie middleware is unnecessary for these endpoints. SQLAlchemy parameter binding and schema validation apply at their respective boundaries; blanket string sanitization can corrupt the URLs being analyzed. Store keys in your platform's secret manager and inject them as environment variables. Rotate provider keys there and restart workers; rotating the JWT key invalidates signed tokens, and rotating the model key requires re-signing the trusted artifact.

See `PRIVACY.md` and `STORE_LISTING.md` for data handling and store submission materials. Public domains, deployment credentials, legal operator/contact details and real deployment screenshots must be supplied by the operator before publication. No deployment or store submission is performed by these changes.
