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
- `backend/agent.py` — LangGraph multi-agent pipeline: **Router → Researcher⇄tools → Analyst⇄tools → Storyteller** (see below); `ChatOpenAI` via AIPIPE; structured output via Pydantic model (`GeneratedHTML`)
- `backend/auth.py` — JWT (HS256), bcrypt hashing, 7-day token expiry
- `backend/models.py` — SQLAlchemy models: `User`, `Chat`, `Message`
- `backend/database.py` — SQLite engine at `backend/sql_app.db`
- `frontend/src/pages/Dashboard.jsx` — main workspace: chat panel + Sandpack preview, SSE consumer
- `frontend/src/components/QueryInputPage.jsx` — initial prompt / file upload
- `frontend/src/api/client.js` — `apiFetch` helper, `API_BASE_URL` constant

### Agent Orchestration (`backend/agent.py`)

Five-node adaptive graph (LangGraph, no checkpointer — every request is one-shot):

```
router → [researcher ⇄ research_tools] → [analyst ⇄ analyst_tools] → storyteller → END
            (conditional skip)                (one back-edge to researcher)
```

- **router** (LLM, JSON): decides if web research is needed; falls back to a URL/keyword heuristic on error. Skips the researcher when local files suffice.
- **researcher** (ReAct loop, tools: `search_web`/`scrape_url`/`list_files`): gathers sourced facts, final message = `RESEARCH NOTES`. Search uses `ddgs` (no API key).
- **analyst** (ReAct loop, tools: `list_files`/`analyze_data`/`group_stats`/`correlate`/`create_chart`/`save_table`): works from actual data — chart type chosen from column metadata, not hardcoded. Can end its message with `NEED_MORE_RESEARCH: …` to bounce back to the researcher **once** (`bounce_used` guard makes a second bounce impossible).
- **storyteller** (single LLM call): plain-text summary + self-contained HTML (Plotly from `cdn.jsdelivr.net` — `cdn.plotly.com` is DNS-blocked on this network).
- **Termination guarantees**: per-phase tool budgets (`RESEARCH_TOOL_BUDGET`/`ANALYST_TOOL_BUDGET`) force `tool_choice="none"` when exhausted, plus `recursion_limit`. A quality gate re-asks the analyst once if numeric data exists but no `chart_*`/`table_*` file was produced.
- **File tools are containment-checked**: `chat_dir` arrives via `config["configurable"]` (injected into tools as `RunnableConfig`), never a module global — concurrent requests can't race.
- Each phase injects its own system prompt at invoke time; shared `messages` state holds only the conversation (no prompt leakage between phases).

### Data Flow

1. User sends message → `POST /chats/{id}/message/stream`
2. Backend builds LangChain message history (reads `uploads/{chat_id}/` for file context)
3. Agent runs in a thread, pushes trace events onto a `queue.Queue`
4. SSE generator polls queue, yields `trace` events to frontend
5. On completion, assistant response (JSON with `html_code`, `files_data`, etc.) saved to SQLite, sent as `done` event
6. Frontend renders `html_code` in Sandpack preview

### Uploads Convention

Each chat gets a directory `uploads/{chat_id}/`. All agent file tools resolve paths against this directory and reject anything outside it (server-side, not prompt-enforced). Uploaded files and generated artifacts (`chart_*.json`, `table_*.json`, `generated.html`) live here. The `GET /chats/{id}/messages` endpoint dynamically merges file contents from disk into the message history.

## Available Scripts

| Command | Location | Purpose |
|---|---|---|
| `npm run dev` | `frontend/` | Vite dev server |
| `npm run build` | `frontend/` | Production build |
| `npm run lint` | `frontend/` | ESLint (flat config) |
| `uvicorn main:app --reload` | `backend/` | API dev server |

## No Test Framework, No Backend Linting

- No pytest config / formal test suite. Two **manual verification scripts** exist in `backend/` (run from `backend/` with `python verify_file_flow.py` / `verify_research_flow.py`; each costs several LLM calls, writes to throwaway `uploads/9999x/` dirs, and asserts on steps, chart files, and trace events).
- No Python formatter/linter configured (no ruff, black, mypy)
- No type checking on backend
- ESLint is configured for frontend only

## Key Gotchas

- **`load_dotenv(override=True)` in `backend/agent.py` is load-bearing.** This machine has a user-level OS env var `OPENAI_BASE_URL=https://aipipe.org/openai/v1` that silently overrides `backend/.env`'s `openrouter` URL (wrong provider → "Model pricing unknown" failures). Never remove the `override=True`.
- **JWT secret is hardcoded** in `backend/auth.py` (`SECRET_KEY = "HARLIVSINGH"`). Do not expose this in production.
- **SSE streaming** uses threading + `queue.Queue`, not async generators. The `TraceCallbackHandler` bridges sync LangChain callbacks to the async SSE generator.
- **Message content is JSON**, not plain text. Both user and assistant messages store JSON strings in the `content` column. The frontend parses with `JSON.parse`.
- **Sandpack** (`@codesandbox/sandpack-react`) renders the generated HTML. The `Dashboard.jsx` contains significant CSS overrides (`.sp-preview`, `.sp-code-editor`, etc.) to make Sandpack fill its container — don't remove these.
- **No database migrations** — schema is created via `models.Base.metadata.create_all()` on startup. Schema changes require deleting `backend/sql_app.db`.
- **Frontend has no TypeScript** — plain JSX throughout. `@types/react` dev deps are vestigial.
- **`AgentResponse.jsx`** is defined but not used in the current `Dashboard.jsx` — the dashboard has its own inline rendering. Don't be confused by this file.
