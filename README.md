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
| `DATABASE_URL` | a PostgreSQL URL (SQLite runs in WAL mode and is fine for a single instance) |
| `LLM_PROVIDER` / `GROQ_API_KEY` | optional content analysis; detection works without it |

```bash
uv run alembic upgrade head
```
```bash
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2 --proxy-headers
```

Serve it behind HTTPS. Failed logins are rate-limited per (IP, email); with several instances, also rate-limit
at the reverse proxy because the in-process limiter is per worker.

**Frontend** (`client/.env`, see `client/.env.example`): set `NEXT_PUBLIC_API_URL` to the public API URL, then

```bash
bun run build && bun run start
```

**Extension**: edit `extension/config.js` (`API_BASE`, `APP_ORIGIN`) and the matching `host_permissions` and
`content_scripts.matches` entries in `extension/manifest.json`, then rebuild the downloadable package
(`client/public/baitlock-extension.zip`).

**Health check**: `GET /api/v1/health` returns `healthy` only when the database is reachable and the shipped
model artifact loaded (not the fallback model).

### Tests

```bash
cd server && uv run --with pytest python -m pytest -q tests
```
