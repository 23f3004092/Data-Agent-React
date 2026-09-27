"""
Adaptive multi-agent orchestration using LangGraph.

    Router → Researcher⇄tools → Analyst⇄tools → Storyteller

- Router (LLM): classifies the request — is external research needed?
- Researcher:   ReAct loop over search/scrape tools, distills sourced notes.
                Can be re-engaged ONCE by the analyst if data is missing.
- Analyst:      ReAct loop over pandas/plotly tools, driven by the ACTUAL
                data (files and/or research notes): grouping, correlations,
                and charts whose type is chosen from real column metadata.
- Storyteller:  single LLM call → plain-text summary + self-contained HTML.

Conditional edges skip phases; loops are bounded by per-phase tool budgets
(forced `tool_choice="none"` when exhausted) plus a graph recursion limit —
so no run can hang or loop forever. Every file tool is containment-checked
against the chat's own uploads directory (chat_dir arrives via config, so
concurrent requests cannot race on a global).
"""

import os
import json
import re
import time
import logging
from typing import TypedDict, List, Optional, Annotated
from pathlib import Path
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.runnables.config import RunnableConfig
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

# .env is the source of truth for this project. An OS-level OPENAI_BASE_URL
# (set on this machine for other tools) would otherwise silently win and point
# the agent at the wrong provider — so override ambient environment variables.
load_dotenv(override=True)

logger = logging.getLogger(__name__)

AIPIPE_TOKEN = os.getenv("AIPIPE_TOKEN")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://aipipe.org/openrouter/v1")

# ─── Configuration ───────────────────────────────────────

MAX_RETRIES = 3
RETRY_WAIT_MIN = 2
RETRY_WAIT_MAX = 10

RESEARCH_TOOL_BUDGET = 10   # max tool calls for the researcher phase
ANALYST_TOOL_BUDGET = 14    # max tool calls for the analyst phase
RECURSION_LIMIT = 90        # hard graph super-step cap (belt & braces)

NEED_MARKER = "NEED_MORE_RESEARCH:"   # analyst → researcher back-edge signal

PLOTLY_CDN = "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@3.1.0/plotly.min.js"

# ─── Response Model ──────────────────────────────────────

class GeneratedHTML(BaseModel):
    html_code: str = Field(description="Final HTML code")
    simple_response: str = Field(description="LLM response for the user query excluding HTML")
    names_of_required_files: List[str] = Field(default_factory=list)
    list_of_steps_you_did: List[str] = Field(default_factory=list)

# ─── Graph State ─────────────────────────────────────────

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    user_query: str
    chat_dir: str
    research_needed: bool
    research_question: str
    notes: str                  # distilled researcher output (facts + sources)
    errors: List[str]
    bounce_used: bool           # analyst→researcher back-edge fired at least once
    research_tool_calls: int    # phase tool budgets
    analyst_tool_calls: int
    started_at: float           # lets the storyteller find files created this run
    structured_response: Optional[GeneratedHTML]

# ─── Path Helpers ────────────────────────────────────────

def _chat_dir(config: RunnableConfig) -> Path:
    """Chat working directory, injected via graph config (race-free)."""
    raw = ((config or {}).get("configurable") or {}).get("chat_dir") or "uploads"
    p = Path(raw)
    p.mkdir(parents=True, exist_ok=True)
    return p.resolve()


def _resolve_file(chat_dir: Path, file_path: str) -> Path:
    """Resolve a file the agent asked for; must live inside the chat dir."""
    candidates = [Path(file_path), chat_dir / file_path, chat_dir / Path(file_path).name]
    for c in candidates:
        try:
            rc = c.resolve()
        except OSError:
            continue
        if rc.is_file() and rc.is_relative_to(chat_dir):
            return rc
    raise ValueError(f"File not found inside {chat_dir.name}/: {file_path}")


def _write_target(chat_dir: Path, file_name: str) -> Path:
    """A writable path inside the chat dir (any directory components stripped)."""
    name = Path(str(file_name)).name
    if not name or name.startswith("."):
        raise ValueError(f"Invalid file name: {file_name}")
    return chat_dir / name


def _read_df(path: Path):
    import pandas as pd
    s = str(path).lower()
    if s.endswith(".csv"):
        return pd.read_csv(path)
    if s.endswith(".json"):
        return pd.read_json(path)
    if s.endswith((".xlsx", ".xls")):
        return pd.read_excel(path)
    raise ValueError(f"Unsupported file format: {path.name}")


def _scan_file_names(chat_dir: str) -> List[str]:
    try:
        p = Path(chat_dir)
        if not p.is_dir():
            return []
        return sorted(f.name for f in p.iterdir() if f.is_file() and not f.name.startswith("."))
    except OSError:
        return []


def _msg_text(msg) -> str:
    """Message content as plain text (handles str and content-part lists)."""
    c = getattr(msg, "content", "")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        parts = []
        for p in c:
            if isinstance(p, str):
                parts.append(p)
            elif isinstance(p, dict):
                parts.append(str(p.get("text", "")))
            else:
                parts.append(getattr(p, "text", "") or "")
        return "\n".join(parts)
    return str(c)


def _has_numbers_available(state) -> bool:
    """True if there is numeric material the analyst could tabulate/chart."""
    if re.search(r"\d", state.get("notes") or ""):
        return True
    for name in _scan_file_names(state["chat_dir"]):
        if name.startswith(("chart_", "table_", "generated.")) or name == "scraped_data.txt":
            continue
        if name.endswith((".csv", ".json", ".xlsx", ".xls")):
            return True
    return False


def _viz_created_this_run(state) -> bool:
    """True if this run already saved a table or chart file."""
    cutoff = state.get("started_at", 0) - 1.0
    try:
        for f in Path(state["chat_dir"]).iterdir():
            if (f.is_file() and f.name.startswith(("chart_", "table_"))
                    and f.suffix in (".json", ".csv") and f.stat().st_mtime >= cutoff):
                return True
    except OSError:
        pass
    return False

# ─── Tools ───────────────────────────────────────────────
# Three groups of concerns: research (web), analysis (pandas), output (charts/tables).

@tool
def list_files(config: Annotated[RunnableConfig, "runnable config"]) -> str:
    """List the data files available in this chat's working directory."""
    try:
        chat_dir = _chat_dir(config)
        rows = [f"{f.name} ({f.stat().st_size} bytes)" for f in sorted(chat_dir.iterdir()) if f.is_file()]
        return "\n".join(rows) if rows else f"(no files yet in {chat_dir.name}/)"
    except Exception as e:
        return f"Error listing files: {e}"


@tool
def search_web(query: str, max_results: int = 5) -> str:
    """Search the web. Returns numbered titles, URLs and snippets. Use before scrape_url."""
    try:
        from ddgs import DDGS
        n = max(1, min(int(max_results), 10))
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=n)
        if not results:
            return f"No results for: {query}"
        out = []
        for i, r in enumerate(results, 1):
            url = r.get("href") or r.get("link") or r.get("url") or ""
            title = (r.get("title") or "").strip()
            body = (r.get("body") or r.get("snippet") or "").strip()
            out.append(f"{i}. {title}\n   URL: {url}\n   {body[:400]}")
        return "\n".join(out)
    except Exception as e:
        return f"Error searching for '{query}': {e}"


@tool
def scrape_url(url: str, max_chars: int = 6000, config: Annotated[RunnableConfig, "runnable config"] = None) -> str:
    """Scrape a web page and return cleaned text (capped at max_chars)."""
    import httpx
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        cap = max(500, min(int(max_chars), 20000))
        response = httpx.get(url, headers=headers, timeout=30, follow_redirects=True)
        response.raise_for_status()

        ctype = response.headers.get("content-type", "").lower()
        if ctype.startswith("application/pdf") or response.content[:4] == b"%PDF":
            return (f"Skipping {url}: it is a PDF. Use the numbers already in your search "
                    f"snippets, or find an HTML version of this source.")

        soup = BeautifulSoup(response.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()

        text = soup.get_text(separator="\n", strip=True)
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = "\n".join(chunk for chunk in chunks if chunk)
        if not text.strip():
            return (f"Page {url} rendered no readable text (likely bot-protected). "
                    f"Fall back to search snippets or another source.")
        return text[:cap]
    except Exception as e:
        return (f"Could not fetch {url} ({type(e).__name__}: {str(e)[:150]}). "
                f"The site may block bots or be unreachable — rely on search snippets "
                f"or scrape a different source instead.")


@tool
def analyze_data(file_path: str, columns: str = "", config: Annotated[RunnableConfig, "runnable config"] = None) -> str:
    """Profile a data file (csv/json/xlsx): shape, columns, dtypes, stats, head, nulls.

    file_path: path to the file (inside this chat's directory).
    columns: optional comma-separated subset to profile (keeps output small).
    """
    try:
        chat_dir = _chat_dir(config)
        path = _resolve_file(chat_dir, file_path)
        df = _read_df(path)

        if columns:
            wanted = [c.strip() for c in columns.split(",") if c.strip()]
            missing = [c for c in wanted if c not in df.columns]
            if missing:
                return f"Columns not found: {missing}. Available: {list(df.columns)}"
            df = df[wanted]

        result = {
            "file": path.name,
            "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
            "columns": list(df.columns),
            "dtypes": {k: str(v) for k, v in df.dtypes.items()},
            "summary": json.loads(df.describe().to_json()),
            "head": json.loads(df.head(10).to_json(orient="records")),
            "null_counts": {k: int(v) for k, v in df.isnull().sum().items()},
        }
        return json.dumps(result, indent=2, default=str)[:25000]
    except Exception as e:
        return f"Error analyzing {file_path}: {e}"


@tool
def group_stats(file_path: str, group_by: str, aggregations: str,
                config: Annotated[RunnableConfig, "runnable config"] = None) -> str:
    """Aggregate a data file with a group-by; returns a compact JSON table (row objects).

    file_path:    path to csv/json/xlsx inside this chat's directory.
    group_by:     column name(s), comma-separated.
    aggregations: JSON object mapping column -> function, e.g. {"revenue":"sum","units":"mean"}
                  Functions: sum, mean, median, min, max, count, nunique, std.
    The returned table can be passed straight into create_chart as data.
    """
    try:
        chat_dir = _chat_dir(config)
        path = _resolve_file(chat_dir, file_path)
        df = _read_df(path)

        aggs = json.loads(aggregations) if isinstance(aggregations, str) else aggregations
        if not isinstance(aggs, dict) or not aggs:
            return 'aggregations must be a JSON object like {"revenue": "sum"}'

        keys = [k.strip() for k in group_by.split(",") if k.strip()]
        missing = [k for k in keys if k not in df.columns] + [c for c in aggs if c not in df.columns]
        if missing:
            return f"Columns not found: {missing}. Available: {list(df.columns)}"

        allowed = {"sum", "mean", "median", "min", "max", "count", "nunique", "std"}
        bad = [fn for fn in aggs.values() if fn not in allowed]
        if bad:
            return f"Unsupported aggregation {bad}. Allowed: {sorted(allowed)}"

        out = df.groupby(keys, dropna=False).agg(aggs).reset_index().head(200)
        return json.dumps(json.loads(out.to_json(orient="records")), indent=2, default=str)
    except Exception as e:
        return f"Error in group_stats: {e}"


@tool
def correlate(file_path: str, columns: str = "all",
              config: Annotated[RunnableConfig, "runnable config"] = None) -> str:
    """Pearson correlation matrix for numeric columns.

    columns: comma-separated column names, or "all" for every numeric column.
    """
    try:
        chat_dir = _chat_dir(config)
        path = _resolve_file(chat_dir, file_path)
        df = _read_df(path)

        if columns.strip().lower() == "all":
            cols = list(df.select_dtypes("number").columns)[:10]
        else:
            cols = [c.strip() for c in columns.split(",") if c.strip()]
            missing = [c for c in cols if c not in df.columns]
            if missing:
                return f"Columns not found: {missing}. Available: {list(df.columns)}"
            non_numeric = [c for c in cols if not str(df[c].dtype).startswith(("int", "float"))]
            if non_numeric:
                return f"Non-numeric columns: {non_numeric}. Available numeric: {list(df.select_dtypes('number').columns)}"

        if len(cols) < 2:
            return f"Need at least 2 numeric columns to correlate, found: {cols}"
        corr = df[cols].corr()
        return json.dumps(json.loads(corr.to_json()), indent=2)
    except Exception as e:
        return f"Error in correlate: {e}"


@tool
def create_chart(data: str, chart_type: str, title: str, x: str = "", y: str = "",
                 config: Annotated[RunnableConfig, "runnable config"] = None) -> str:
    """Render a Plotly chart and save it as chart_<n>.json in this chat's directory.

    data:       JSON — either a list of row objects (as returned by group_stats)
                or a dict of equal-length arrays.
    chart_type: bar | line | area | scatter | pie | histogram
                (time → line/area, categories → bar, distribution → histogram,
                 parts of a whole → pie, relationship → scatter)
    x, y:       column/field names for the axes (pie: x = labels, y = values).
    """
    import plotly.express as px

    try:
        chat_dir = _chat_dir(config)
        data_obj = json.loads(data) if isinstance(data, str) else data
        if isinstance(data_obj, dict) and not isinstance(data_obj, (list, tuple)):
            # dict of arrays or {"data": ...} wrapper — px accepts both dict forms
            pass
        if not isinstance(data_obj, (list, dict)):
            return "data must be a JSON list of row objects or a dict of arrays"

        xy = {}
        if x:
            xy["x"] = x
        if y:
            xy["y"] = y

        ct = (chart_type or "bar").lower()
        if ct == "bar":
            fig = px.bar(data_obj, **xy)
        elif ct == "line":
            fig = px.line(data_obj, **xy)
        elif ct == "area":
            fig = px.area(data_obj, **xy)
        elif ct == "scatter":
            fig = px.scatter(data_obj, **xy)
        elif ct == "pie":
            fig = px.pie(data_obj, **xy)
        elif ct == "histogram":
            fig = px.histogram(data_obj, **xy)
        else:
            fig = px.bar(data_obj, **xy)

        fig.update_layout(title=title, template="plotly_white")

        idx = 1
        while (chat_dir / f"chart_{idx}.json").exists():
            idx += 1
        file_name = f"chart_{idx}.json"
        target = chat_dir / file_name
        target.write_text(fig.to_json(), encoding="utf8")
        return f"Saved {file_name} ({ct} chart, title '{title}'). Reference it when you describe charts."
    except Exception as e:
        return f"Error creating chart: {e}"


@tool
def save_table(file_name: str, data_json: str,
               config: Annotated[RunnableConfig, "runnable config"] = None) -> str:
    """Save a data table into this chat's directory (derived from research or analysis).

    file_name: must end with .json or .csv (stored in the chat directory).
    data_json: JSON array of row objects, e.g. [{"year":2024,"value":12}].
    Use for tables built from research notes (label estimates clearly in the rows).
    """
    import pandas as pd
    try:
        chat_dir = _chat_dir(config)
        rows = json.loads(data_json) if isinstance(data_json, str) else data_json
        if not isinstance(rows, list) or not rows:
            return "data_json must be a non-empty JSON array of row objects"
        if not all(isinstance(r, dict) for r in rows):
            return "each row must be a JSON object (key/value pairs)"

        target = _write_target(chat_dir, file_name)
        if target.suffix.lower() == ".csv":
            pd.DataFrame(rows).to_csv(target, index=False)
        elif target.suffix.lower() == ".json":
            target.write_text(json.dumps(rows, indent=2, default=str), encoding="utf8")
        else:
            return "file_name must end with .json or .csv"

        return f"Saved {target.name} ({len(rows)} rows)"
    except Exception as e:
        return f"Error saving table: {e}"


RESEARCH_TOOLS = [list_files, search_web, scrape_url]
ANALYST_TOOLS = [list_files, analyze_data, group_stats, correlate, create_chart, save_table]

# ─── LLM Setup ───────────────────────────────────────────

model = ChatOpenAI(
    model="openai/gpt-5.4-mini",
    api_key=AIPIPE_TOKEN,
    base_url=OPENAI_BASE_URL,
    temperature=0,
    streaming=True,
    timeout=120,
    max_retries=0,  # tenacity below owns retries (avoids 3×3 double-retry)
)

researcher_llm = model.bind_tools(RESEARCH_TOOLS)
analyst_llm = model.bind_tools(ANALYST_TOOLS)


@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=RETRY_WAIT_MIN, max=RETRY_WAIT_MAX),
    reraise=True,
)
def _llm_call(runnable, messages):
    """Invoke an LLM runnable with exponential backoff retry."""
    return runnable.invoke(messages)

# ─── Prompts ─────────────────────────────────────────────

ROUTER_PROMPT = """You route a data-story request for a pipeline with two modes:
- RESEARCH mode: the story needs external/real-world facts (a topic to research, a URL, current statistics, news, market/trend data).
- DIRECT ANALYSIS mode: the listed data files already cover the request.

Available data files: {files}

Return STRICT JSON only — no markdown, no commentary:
{{"research_needed": true, "research_question": "<one-sentence research brief, or empty>", "reason": "<max 12 words>"}}

Rules:
- Query contains a URL → true, put the URL first in research_question.
- Query asks for research / latest / current / statistics on a real-world topic → true.
- Query is fully covered by the listed files → false.
- Purely illustrative requests with no real-world facts → false."""

RESEARCHER_PROMPT = """You are a research agent feeding a data-story pipeline.

Research brief: {question}
Original user request: {user_query}
Working directory: {chat_dir}/
{extra}
Tools: search_web(query), scrape_url(url), list_files().

Method:
1. If the brief contains a URL — scrape it first, then search around it.
2. Otherwise run 2-3 focused search_web queries; scrape_url the 2-4 most promising results.
3. Extract CONCRETE facts: numbers, dates, quantities, rankings, growth rates, percentages — prefer recent data.

When you have 8-15 solid facts (or the tool budget is reached), STOP calling tools and give your FINAL message with no tool calls, exactly:

RESEARCH NOTES
- <fact> (source: <url>)
...
SOURCES
- <url>
...

Rules:
- Every fact needs a source URL you actually retrieved. Never invent numbers.
- PDFs and bot-protected sites fail to scrape — when that happens, the numbers
  in search snippets still count as sourced facts; don't waste budget retrying.
- If the web was unreachable or results were thin, say so plainly in the notes
  instead of fabricating data."""

ANALYST_PROMPT = """You are a data-analysis agent feeding a data-story pipeline.

User request: {user_query}
Working directory: {chat_dir}/
Available files: {files}
Research notes so far: {notes}
{extra}
Tools: list_files(), analyze_data(file_path, columns?), group_stats(file_path, group_by, aggregations),
correlate(file_path, columns?), create_chart(data, chart_type, title, x?, y?), save_table(file_name, data_json).

Method:
1. list_files(). If files exist, analyze_data the RELEVANT one(s) first.
2. Then answer the actual question — generic profiles are not enough:
   group_stats for breakdowns/comparisons (e.g. {{"revenue":"sum"}} by "region"),
   correlate for relationships between numeric columns.
3. No files but the research notes contain numbers? Build a small table with
   save_table (rows derived from the notes; put "illustrative": true on rows
   you had to estimate, never on sourced ones).
4. Charts: create_chart for the 1-3 comparisons that best carry the story.
   Choose type by data shape: time→line/area, categories→bar, distribution→histogram,
   parts of a whole→pie, relationship→scatter. Pass group_stats output straight as data.

OUTPUT GATE (mandatory): if ANY numbers are available (research notes or data files),
you are not done until at least one table (save_table) and at least one chart
(create_chart) exist in the working directory — prose-only findings are rejected,
because the HTML story embeds charts from those files.

{marker_rule}
When analysis is done, give your FINAL message with no tool calls, exactly:

FINDINGS
- <finding with the actual number>
...
CHARTS
- <chart_N.json and what it shows>
LIMITATIONS
- <data gaps or estimates, or "none">

Every finding must trace to a file, a chart, or the research notes."""

STORYTELLER_PROMPT = """You are a data storyteller. Turn the material below into ONE self-contained HTML data story.

Output format (strict):
1. First, a 2-3 sentence plain-text summary of the findings for the user (no markdown, no code fences).
2. Then a blank line, then the complete HTML inside a ```html code block.

HTML requirements:
- Single self-contained file. Load Plotly ONLY from: """ + PLOTLY_CDN + """
- If chart files are listed, embed each with:
  <script>Plotly.newPlot('id', DATA, LAYOUT);</script>
  where DATA/LAYOUT come from that chart file's JSON (copy verbatim).
- Narrative: headline → context → insights (with the real numbers) → resolution.
- Detective/aesthetic theme, smooth CSS animations, responsive, 0-radius/2px-border motifs.
- Mark illustrative or estimated data clearly on the page.
- No other external requests; no placeholders; must render standalone."""

# ─── Nodes ───────────────────────────────────────────────

def _parse_json_reply(text: str) -> dict:
    t = text.strip()
    if "```" in t:
        t = re.sub(r"^```[a-zA-Z]*\s*", "", t)
        t = re.sub(r"\s*```$", "", t)
    try:
        obj = json.loads(t)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if not m:
            raise
        obj = json.loads(m.group(0))
    if not isinstance(obj, dict):
        raise ValueError("reply is not a JSON object")
    return obj


def router_node(state: AgentState) -> dict:
    """Classify: does this request need web research before analysis?"""
    files = _scan_file_names(state["chat_dir"])
    file_list = ", ".join(files) if files else "(none)"

    messages = [
        SystemMessage(ROUTER_PROMPT.format(files=file_list)),
        HumanMessage(f"Request: {state['user_query']}"),
    ]

    try:
        response = _llm_call(model, messages)
        data = _parse_json_reply(_msg_text(response))
        state["research_needed"] = bool(data.get("research_needed"))
        question = str(data.get("research_question") or "").strip()
        state["research_question"] = question or state["user_query"]
        logger.info(f"Router: research_needed={state['research_needed']} ({data.get('reason', '')})")
    except Exception as e:
        # Heuristic fallback: URLs and research-y keywords without local files.
        q = state["user_query"].lower()
        keywords = ("research", "latest", "current", "news", "recent", "today",
                    "statistics", "stats", "market", "trend", "2025", "2026")
        state["research_needed"] = bool(re.search(r"https?://", q)) or (
            any(k in q for k in keywords) and not files
        )
        state["research_question"] = state["user_query"]
        state["errors"].append(f"Router error: {e}")
        logger.warning(f"Router fallback: {e}")

    return {
        "research_needed": state["research_needed"],
        "research_question": state["research_question"],
        "errors": state["errors"],
    }


def researcher_node(state: AgentState) -> dict:
    """One step of the research ReAct loop (tool calls, or distilled notes)."""
    last = state["messages"][-1] if state["messages"] else None
    extra = ""

    # Analyst bounced back for more data → flag it and honour its request.
    if last is not None and NEED_MARKER in _msg_text(last):
        state["bounce_used"] = True
        need = _msg_text(last).split(NEED_MARKER, 1)[1].strip().splitlines()[0][:300]
        extra += f"\nThe ANALYST needs this specific data: {need}\n"

    over_budget = state["research_tool_calls"] >= RESEARCH_TOOL_BUDGET
    if over_budget:
        extra += ("\nTOOL BUDGET REACHED: do NOT call tools. Write your final "
                  "RESEARCH NOTES now from what you already have.\n")

    system = RESEARCHER_PROMPT.format(
        question=state["research_question"],
        user_query=state["user_query"],
        chat_dir=state["chat_dir"],
        extra=extra,
    )
    messages = [SystemMessage(system), HumanMessage(f"User request: {state['user_query']}")] + state["messages"]

    runnable = model.bind_tools(RESEARCH_TOOLS, tool_choice="none") if over_budget else researcher_llm

    try:
        response = _llm_call(runnable, messages)
    except Exception as e:
        state["errors"].append(f"Researcher error: {e}")
        logger.error(f"Researcher LLM failed: {e}")
        response = AIMessage(content=f"[research unavailable: {e}]")

    updates = {"messages": [response], "errors": state["errors"], "bounce_used": state["bounce_used"]}

    calls = getattr(response, "tool_calls", None) or []
    if calls:
        updates["research_tool_calls"] = state["research_tool_calls"] + len(calls)
    else:
        content = _msg_text(response).strip()
        if content:
            updates["notes"] = f"{state['notes']}\n\n{content}".strip() if state["notes"] else content

    return updates


def analyst_node(state: AgentState) -> dict:
    """One step of the analysis ReAct loop (files → stats → charts → findings)."""
    files = _scan_file_names(state["chat_dir"])
    file_list = ", ".join(files) if files else "(none)"
    notes = state["notes"] or "(none)"

    extra = ""
    if state["bounce_used"]:
        extra += ("You already used your ONE request for additional web research — "
                  "you cannot use the marker again; work with what you have.\n")
    over_budget = state["analyst_tool_calls"] >= ANALYST_TOOL_BUDGET
    if over_budget:
        extra += ("\nTOOL BUDGET REACHED: do NOT call tools. Give your final "
                  "FINDINGS message now from the results you already have.\n")

    marker_rule = (
        f"If — and only if — you critically need raw web data you don't have AND you have not "
        f"requested research before, end your message with exactly the line:\n{NEED_MARKER} <precise description of the missing data>\n"
        f"(That hands control back to the researcher once.)\n"
    )

    system = ANALYST_PROMPT.format(
        user_query=state["user_query"],
        chat_dir=state["chat_dir"],
        files=file_list,
        notes=notes,
        extra=extra,
        marker_rule=marker_rule,
    )
    messages = [SystemMessage(system), HumanMessage(f"User request: {state['user_query']}")] + state["messages"]

    runnable = model.bind_tools(ANALYST_TOOLS, tool_choice="none") if over_budget else analyst_llm

    try:
        response = _llm_call(runnable, messages)
    except Exception as e:
        state["errors"].append(f"Analyst error: {e}")
        logger.error(f"Analyst LLM failed: {e}")
        response = AIMessage(content=f"[analysis unavailable: {e}]")

    # Quality gate: numbers exist but the analyst finished without any table or
    # chart this run → explicitly re-ask ONCE inside this node call (no loop risk:
    # if the re-ask also returns prose, route_analyst sends it onward to the story).
    if (not getattr(response, "tool_calls", None)
            and _has_numbers_available(state)
            and not _viz_created_this_run(state)
            and state["analyst_tool_calls"] < ANALYST_TOOL_BUDGET):
        logger.info("Analyst gate: re-asking for save_table + create_chart")
        nudge_system = system + (
            "\nCRITICAL: You are finishing without creating any table or chart even "
            "though numeric data is available. Call save_table AND create_chart NOW, "
            "then give your FINDINGS message."
        )
        try:
            response = _llm_call(analyst_llm, [SystemMessage(nudge_system)] + messages[1:])
        except Exception as e:
            logger.warning(f"Analyst quality-gate re-ask failed: {e}")

    updates = {"messages": [response], "errors": state["errors"]}
    calls = getattr(response, "tool_calls", None) or []
    if calls:
        updates["analyst_tool_calls"] = state["analyst_tool_calls"] + len(calls)
    return updates


def storyteller_node(state: AgentState) -> dict:
    """Compile everything into a summary + one self-contained HTML data story."""
    chat_dir = Path(state["chat_dir"])
    cutoff = state.get("started_at", 0) - 1.0

    charts, tables = [], []
    try:
        for f in sorted(chat_dir.iterdir()):
            if not f.is_file():
                continue
            if f.name.startswith("chart_") and f.suffix == ".json" and f.stat().st_mtime >= cutoff:
                charts.append(f.name)
            elif f.name.startswith("table_") and f.suffix in (".json", ".csv") and f.stat().st_mtime >= cutoff:
                tables.append(f.name)
    except OSError:
        pass

    # The analyst's final (tool-free) message carries the findings.
    findings = ""
    for m in reversed(state["messages"]):
        if isinstance(m, AIMessage) and not getattr(m, "tool_calls", None):
            findings = _msg_text(m).strip()
            if findings:
                break

    steps = [f"Mode: {'research + analysis' if state['research_needed'] else 'direct analysis'}"]
    seen = set()
    for m in state["messages"]:
        if isinstance(m, AIMessage):
            for tc in getattr(m, "tool_calls", None) or []:
                args = tc.get("args") or {}
                key = (args.get("query") or args.get("url") or args.get("file_path")
                       or args.get("group_by") or args.get("title") or "")
                label = f"{tc.get('name', 'tool')}" + (f"({str(key)[:60]})" if key else "")
                if label not in seen:
                    seen.add(label)
                    steps.append(label)
    steps.append("Wrote HTML data story")

    context = f"""User Request: {state['user_query']}

RESEARCH NOTES:
{state['notes'] or 'None'}

FINDINGS:
{findings or 'None'}

CHART FILES (embed the relevant ones): {charts}
TABLE FILES (may be cited): {tables}

ERRORS/CAVEATS: {', '.join(state['errors']) if state['errors'] else 'None'}"""

    messages = [SystemMessage(STORYTELLER_PROMPT), HumanMessage(context)]

    try:
        response = _llm_call(model, messages)
        raw = _msg_text(response).strip()

        # Summary = plain text before the HTML code block; HTML = inside the block.
        if "```html" in raw:
            summary_text, rest = raw.split("```html", 1)
            html_code = rest.split("```")[0]
        elif "```" in raw:
            summary_text, rest = raw.split("```", 1)
            html_code = rest.split("```")[0]
        else:
            summary_text, html_code = "", raw

        summary_text = summary_text.strip()
        html_code = html_code.strip()

        os.makedirs(state["chat_dir"], exist_ok=True)
        (Path(state["chat_dir"]) / "generated.html").write_text(html_code, encoding="utf8")

        structured = GeneratedHTML(
            html_code=html_code,
            simple_response=summary_text or "Data story generated successfully",
            names_of_required_files=charts + tables,
            list_of_steps_you_did=steps,
        )
        logger.info(f"Story generated ({len(html_code)} chars, {len(charts)} charts)")
    except Exception as e:
        state["errors"].append(f"Storyteller error: {e}")
        logger.error(f"Storyteller failed: {e}")
        structured = GeneratedHTML(
            html_code="",
            simple_response=f"Error generating story: {e}",
            names_of_required_files=[],
            list_of_steps_you_did=steps,
        )

    return {"structured_response": structured, "errors": state["errors"]}

# ─── Conditional Routes ──────────────────────────────────

def route_from_router(state: AgentState) -> str:
    return "research" if state["research_needed"] else "analyze"


def route_researcher(state: AgentState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "next"


def route_analyst(state: AgentState) -> str:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    # Back-edge to the researcher — guarded: researcher flips bounce_used on
    # re-entry, so a second marker can never route again (prompt also forbids it).
    if NEED_MARKER in _msg_text(last) and not state["bounce_used"]:
        return "more_research"
    return "next"

# ─── Graph Builder ───────────────────────────────────────

def build_graph():
    """Build the adaptive Router → Researcher⇄tools → Analyst⇄tools → Storyteller graph."""
    g = StateGraph(AgentState)

    g.add_node("router", router_node)
    g.add_node("researcher", researcher_node)
    g.add_node("research_tools", ToolNode(RESEARCH_TOOLS))
    g.add_node("analyst", analyst_node)
    g.add_node("analyst_tools", ToolNode(ANALYST_TOOLS))
    g.add_node("storyteller", storyteller_node)

    g.set_entry_point("router")
    g.add_conditional_edges("router", route_from_router,
                            {"research": "researcher", "analyze": "analyst"})
    g.add_conditional_edges("researcher", route_researcher,
                            {"tools": "research_tools", "next": "analyst"})
    g.add_edge("research_tools", "researcher")
    g.add_conditional_edges("analyst", route_analyst,
                            {"tools": "analyst_tools", "more_research": "researcher", "next": "storyteller"})
    g.add_edge("analyst_tools", "analyst")
    g.add_edge("storyteller", END)

    # No checkpointer: every request is a one-shot run (no interrupts/resume).
    return g.compile()


# ─── Singleton Graph ─────────────────────────────────────

_graph = None

def get_graph():
    """Get or create the compiled graph (singleton)."""
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph

# ─── Main Entry Point ────────────────────────────────────

def run_agent(messages, callbacks=None, chat_id=None):
    """
    Run the adaptive multi-agent pipeline.

    Args:
        messages: List of message dicts with 'role' and 'content'
        callbacks: Optional list of LangChain callbacks for tracing
        chat_id: Chat ID used to resolve the uploads directory. If omitted,
            it is recovered from the directory-context message.

    Returns:
        Dict with 'structured_response' key containing GeneratedHTML
    """
    # Extract user query from messages
    user_query = ""
    for msg in reversed(messages):
        if isinstance(msg, dict) and msg.get("role") == "user":
            user_query = msg.get("content", "")
            break
        elif hasattr(msg, 'type') and msg.type == "human":
            user_query = msg.content
            break

    # Resolve the chat's private uploads directory.
    if chat_id is not None:
        chat_dir = f"uploads/{chat_id}"
    else:
        chat_dir = "uploads"
        for msg in messages:
            content = msg.get("content", "") if isinstance(msg, dict) else getattr(msg, 'content', "")
            match = re.search(r'uploads/(\d+)', content)
            if match:
                chat_dir = f"uploads/{match.group(1)}"
                break

    initial_state = {
        "messages": [],
        "user_query": user_query,
        "chat_dir": chat_dir,
        "research_needed": False,
        "research_question": "",
        "notes": "",
        "errors": [],
        "bounce_used": False,
        "research_tool_calls": 0,
        "analyst_tool_calls": 0,
        "started_at": time.time(),
        "structured_response": None,
    }

    config = {
        "configurable": {"chat_dir": chat_dir},
        "recursion_limit": RECURSION_LIMIT,
    }
    if callbacks:
        config["callbacks"] = callbacks

    try:
        result = get_graph().invoke(initial_state, config)

        if result.get("structured_response"):
            return {"structured_response": result["structured_response"]}
        return {
            "structured_response": GeneratedHTML(
                html_code="",
                simple_response="The agent finished without producing a story. Please retry.",
                names_of_required_files=[],
                list_of_steps_you_did=[],
            )
        }
    except Exception as e:
        logger.error(f"Agent execution failed: {e}", exc_info=True)
        return {
            "structured_response": GeneratedHTML(
                html_code="",
                simple_response=f"Error: {str(e)}",
                names_of_required_files=[],
                list_of_steps_you_did=[],
            )
        }

# ─── Trace Callback Handler ──────────────────────────────

class TraceCallbackHandler(BaseCallbackHandler):
    """Pushes human-readable trace steps onto a thread-safe queue as the agent runs."""

    STEP_COLORS = {
        "thinking":  "#EF4444",
        "tool":      "#0A0A0A",
        "running":   "#525252",
        "result":    "#16A34A",
        "error":     "#EF4444",
        "done":      "#16A34A",
    }

    # Graph node name → (tag, label). White-listed so wrapper chains stay quiet.
    NODE_LABELS = {
        "router":      ("Planning", "Classifying your request"),
        "researcher":  ("Thinking", "Researching sources & facts"),
        "analyst":     ("Running", "Analyzing the data"),
        "storyteller": ("Done", "Composing your data story"),
    }

    def __init__(self, trace_queue):
        super().__init__()
        self.trace_queue = trace_queue
        self._llm_call_count = 0

    def _put(self, tag: str, label: str, kind: str = "trace"):
        self.trace_queue.put({
            "type": kind,
            "tag":   tag,
            "label": label,
            "color": self.STEP_COLORS.get(tag.lower(), "#888"),
        })

    def on_chain_start(self, serialized, inputs, **kwargs):
        name = kwargs.get("name")
        if not name and isinstance(serialized, dict):
            name = serialized.get("name")
        label = self.NODE_LABELS.get(name) if name else None
        if label:
            self._put(*label)

    def on_llm_start(self, serialized, prompts, **kwargs):
        self._llm_call_count += 1
        self._put("Thinking", f"LLM pass #{self._llm_call_count} — reasoning", "trace")

    def on_chat_model_start(self, serialized, messages, **kwargs):
        # ChatOpenAI emits on_chat_model_start, NOT on_llm_start.
        self._llm_call_count += 1
        self._put("Thinking", f"LLM pass #{self._llm_call_count} — reasoning", "trace")

    def on_llm_error(self, error, **kwargs):
        self._put("Error", str(error)[:120], "trace")

    def on_agent_action(self, action, **kwargs):
        tool_input = str(action.tool_input)
        preview = (tool_input[:120] + "…") if len(tool_input) > 120 else tool_input
        self._put("Tool", f"Calling {action.tool} → {preview}", "trace")

    def on_tool_start(self, serialized, input_str, **kwargs):
        name = serialized.get("name", "tool") if isinstance(serialized, dict) else "tool"
        self._put("Running", f"Executing {name}…", "trace")

    def on_tool_end(self, output, **kwargs):
        # langchain-core ≥0.3 passes a ToolMessage here, not a raw string.
        text = getattr(output, "content", None)
        if not isinstance(text, str):
            text = str(output)
        preview = (text[:100] + "…") if len(text) > 100 else text
        self._put("Result", preview, "trace")

    def on_agent_finish(self, finish, **kwargs):
        self._put("Done", "Agent finished — compiling response", "trace")

    def on_chain_error(self, error, **kwargs):
        self._put("Error", str(error)[:120], "trace")
