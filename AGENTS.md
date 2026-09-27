# AGENTS.md

> **Design System:** All UI work MUST follow `DESIGN.md` (VoiceBox design system). Refer to it for colors, typography, spacing, borders, and component specs. Never introduce rounded corners, shadows, or colors outside the VoiceBox palette.

## Project Overview

Full-stack data agent platform. FastAPI + SQLite backend with JWT auth, LangChain agent that generates interactive HTML data stories. React 19 + Vite frontend with live SSE streaming and Sandpack-based HTML preview.

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `backend/.env` with:
```
AIPIPE_TOKEN=<your_token>
OPENAI_BASE_URL=https://aipipe.org/openrouter/v1
```

**Run backend** (from `backend/` directory, not project root):
```bash
cd backend
uvicorn main:app --reload
```

> The README says `uvicorn backend.main:app --reload` but that fails — `main.py` uses flat imports (`import models, schemas, …`) that require `backend/` as CWD. Run from inside `backend/`.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend hardcodes `http://localhost:8000` in `src/api/client.js` — there is no Vite proxy or env var for the API URL.

## Architecture

- `backend/main.py` — FastAPI app; auth, chat CRUD, file upload, SSE streaming endpoint (`/chats/{id}/message/stream`)
- `backend/agent.py` — LangChain agent with `PythonREPLTool`; uses `ChatOpenAI` via AIPIPE; structured output via Pydantic model (`GeneratedHTML`)
- `backend/auth.py` — JWT (HS256), bcrypt hashing, 7-day token expiry
- `backend/models.py` — SQLAlchemy models: `User`, `Chat`, `Message`
- `backend/database.py` — SQLite engine at `backend/sql_app.db`
- `frontend/src/pages/Dashboard.jsx` — main workspace: chat panel + Sandpack preview, SSE consumer
- `frontend/src/components/QueryInputPage.jsx` — initial prompt / file upload
- `frontend/src/api/client.js` — `apiFetch` helper, `API_BASE_URL` constant

### Data Flow

1. User sends message → `POST /chats/{id}/message/stream`
2. Backend builds LangChain message history (reads `uploads/{chat_id}/` for file context)
3. Agent runs in a thread, pushes trace events onto a `queue.Queue`
4. SSE generator polls queue, yields `trace` events to frontend
5. On completion, assistant response (JSON with `html_code`, `files_data`, etc.) saved to SQLite, sent as `done` event
6. Frontend renders `html_code` in Sandpack preview

### Uploads Convention

Each chat gets a directory `uploads/{chat_id}/`. The agent's system prompt instructs it to read/write only within this directory. Uploaded files and generated JSON/CSV artifacts live here. The `GET /chats/{id}/messages` endpoint dynamically merges file contents from disk into the message history.

## Available Scripts

| Command | Location | Purpose |
|---|---|---|
| `npm run dev` | `frontend/` | Vite dev server |
| `npm run build` | `frontend/` | Production build |
| `npm run lint` | `frontend/` | ESLint (flat config) |
| `uvicorn main:app --reload` | `backend/` | API dev server |

## No Tests, No Backend Linting

- No test suite exists (no pytest config, no test files)
- No Python formatter/linter configured (no ruff, black, mypy)
- No type checking on backend
- ESLint is configured for frontend only

## Key Gotchas

- **JWT secret is hardcoded** in `backend/auth.py` (`SECRET_KEY = "HARLIVSINGH"`). Do not expose this in production.
- **SSE streaming** uses threading + `queue.Queue`, not async generators. The `TraceCallbackHandler` bridges sync LangChain callbacks to the async SSE generator.
- **Message content is JSON**, not plain text. Both user and assistant messages store JSON strings in the `content` column. The frontend parses with `JSON.parse`.
- **Sandpack** (`@codesandbox/sandpack-react`) renders the generated HTML. The `Dashboard.jsx` contains significant CSS overrides (`.sp-preview`, `.sp-code-editor`, etc.) to make Sandpack fill its container — don't remove these.
- **No database migrations** — schema is created via `models.Base.metadata.create_all()` on startup. Schema changes require deleting `backend/sql_app.db`.
- **Frontend has no TypeScript** — plain JSX throughout. `@types/react` dev deps are vestigial.
- **`AgentResponse.jsx`** is defined but not used in the current `Dashboard.jsx` — the dashboard has its own inline rendering. Don't be confused by this file.
