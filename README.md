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
