"""
Multi-agent orchestration using LangGraph.

Pipeline: Planner → Scraper → Analyst → Visualizer → Storyteller

Each node is a specialized agent with a focused system prompt.
Tools are simple, fast, and purpose-built (no monolithic PythonREPL).
"""

import os
import json
import re
import logging
from typing import TypedDict, List, Optional, Annotated
from pathlib import Path
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.tools import tool
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.callbacks import BaseCallbackHandler
from pydantic import BaseModel, Field
from tenacity import retry, stop_after_attempt, wait_exponential

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

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
REQUEST_TIMEOUT = 300  # 5 minutes max per request

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
    raw_data: str
    analysis: dict
    visualizations: list
    html_output: str
    errors: List[str]
    plan: List[str]
    chat_dir: str
    structured_response: Optional[GeneratedHTML]

# ─── Tools ───────────────────────────────────────────────

@tool
def scrape_url(url: str) -> str:
    """Scrape a web page and return cleaned text content."""
    import httpx
    from bs4 import BeautifulSoup

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        response = httpx.get(url, headers=headers, timeout=30, follow_redirects=True)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        for script in soup(["script", "style", "nav", "footer", "header", "aside"]):
            script.decompose()

        text = soup.get_text(separator='\n', strip=True)

        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)

        return text[:50000]
    except Exception as e:
        return f"Error scraping {url}: {str(e)}"

@tool
def analyze_data(file_path: str, query: str) -> str:
    """Analyze a data file (CSV/JSON/Excel) and return summary statistics as JSON."""
    import pandas as pd

    try:
        if not os.path.exists(file_path):
            return f"File not found: {file_path}"

        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        elif file_path.endswith('.json'):
            df = pd.read_json(file_path)
        elif file_path.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(file_path)
        else:
            return f"Unsupported file format: {file_path}"

        result = {
            "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
            "columns": list(df.columns),
            "dtypes": {k: str(v) for k, v in df.dtypes.items()},
            "summary": json.loads(df.describe().to_json()),
            "head": json.loads(df.head(10).to_json(orient='records')),
            "null_counts": {k: int(v) for k, v in df.isnull().sum().items()},
        }

        return json.dumps(result, indent=2, default=str)
    except Exception as e:
        return f"Error analyzing {file_path}: {str(e)}"

@tool
def create_chart(data: str, chart_type: str, title: str, x: str = "", y: str = "") -> str:
    """Create a Plotly chart from JSON data and return the chart JSON.

    For bar/line/scatter charts pass column names via x and y
    (e.g. x="column", y="mean") so axes are labelled correctly.
    """
    import plotly.express as px

    try:
        data_dict = json.loads(data) if isinstance(data, str) else data
        xy = {}
        if x:
            xy["x"] = x
        if y:
            xy["y"] = y

        if chart_type == "bar":
            fig = px.bar(data_dict, **xy)
        elif chart_type == "line":
            fig = px.line(data_dict, **xy)
        elif chart_type == "scatter":
            fig = px.scatter(data_dict, **xy)
        elif chart_type == "pie":
            fig = px.pie(data_dict, **xy)
        elif chart_type == "histogram":
            fig = px.histogram(data_dict, **xy)
        else:
            fig = px.bar(data_dict, **xy)

        fig.update_layout(title=title, template="plotly_white")
        return fig.to_json()
    except Exception as e:
        return f"Error creating chart: {str(e)}"

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

# ─── Retry Wrapper ───────────────────────────────────────

@retry(
    stop=stop_after_attempt(MAX_RETRIES),
    wait=wait_exponential(multiplier=1, min=RETRY_WAIT_MIN, max=RETRY_WAIT_MAX),
    reraise=True,
)
def llm_invoke(messages, config=None):
    """Invoke LLM with exponential backoff retry."""
    return model.invoke(messages, config=config)

# ─── Node: Planner ───────────────────────────────────────

def planner_node(state: AgentState) -> AgentState:
    """LLM decides which pipeline steps are needed."""
    system_prompt = """You are a planning agent. Given a user query, decide which steps are needed.

Return a JSON object with a "steps" list. Available steps:
- "scrape": Fetch data from a URL (include if query mentions a URL)
- "analyze": Analyze data (always include)
- "visualize": Create charts (include for data analysis tasks)
- "generate_html": Generate final HTML (always include)

Example output: {"steps": ["scrape", "analyze", "visualize", "generate_html"]}"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Query: {state['user_query']}")
    ]

    try:
        response = llm_invoke(messages)
        plan_text = response.content.strip()

        if "```json" in plan_text:
            plan_text = plan_text.split("```json")[1].split("```")[0]
        elif "```" in plan_text:
            plan_text = plan_text.split("```")[1].split("```")[0]

        plan_data = json.loads(plan_text)
        allowed_steps = {"scrape", "analyze", "visualize", "generate_html"}
        plan = [s for s in plan_data.get("steps", []) if s in allowed_steps]
        state["plan"] = plan or ["analyze", "generate_html"]
        logger.info(f"Plan: {state['plan']}")
    except Exception as e:
        state["errors"].append(f"Planner error: {str(e)}")
        state["plan"] = ["analyze", "generate_html"]
        logger.warning(f"Planner fallback: {e}")

    return state

# ─── Node: Scraper ───────────────────────────────────────

def scraper_node(state: AgentState) -> AgentState:
    """Fetch data from URLs if the plan includes scraping."""
    if "scrape" not in state["plan"]:
        return state

    url_match = re.search(r'https?://[^\s]+', state["user_query"])
    if not url_match:
        state["errors"].append("No URL found in query for scraping")
        return state

    url = url_match.group(0)
    logger.info(f"Scraping: {url}")

    try:
        result = scrape_url.invoke({"url": url})

        if result.startswith("Error"):
            state["errors"].append(result)
        else:
            state["raw_data"] = result
            chat_dir = state["chat_dir"]
            os.makedirs(chat_dir, exist_ok=True)
            with open(os.path.join(chat_dir, "scraped_data.txt"), "w", encoding="utf8") as f:
                f.write(result)
            logger.info(f"Scraped {len(result)} chars")
    except Exception as e:
        state["errors"].append(f"Scraping error: {str(e)}")
        logger.error(f"Scraping failed: {e}")

    return state

# ─── Node: Analyst ───────────────────────────────────────

def analyst_node(state: AgentState) -> AgentState:
    """Analyze data files in the chat directory."""
    chat_dir = state["chat_dir"]
    data_files = []

    # Files the pipeline itself writes — never treat them as input data.
    artifacts = {"scraped_data.txt", "chart_data.json", "generated.html"}

    if os.path.exists(chat_dir):
        for f in os.listdir(chat_dir):
            if f.endswith(('.csv', '.json', '.xlsx', '.txt')) and f not in artifacts:
                data_files.append(os.path.join(chat_dir, f))

    if not data_files and not state["raw_data"]:
        state["errors"].append("No data files found for analysis")
        return state

    analysis_results = {}

    for file_path in data_files:
        try:
            result = analyze_data.invoke({
                "file_path": file_path,
                "query": state["user_query"]
            })
            analysis_results[os.path.basename(file_path)] = result
            logger.info(f"Analyzed: {os.path.basename(file_path)}")
        except Exception as e:
            state["errors"].append(f"Analysis error for {file_path}: {str(e)}")

    # NOTE: scraped text goes straight to the storyteller via state["raw_data"];
    # analyze_data only supports csv/json/xlsx, so it would just error on .txt.

    state["analysis"] = analysis_results
    return state

# ─── Node: Visualizer ────────────────────────────────────

def visualizer_node(state: AgentState) -> AgentState:
    """Create a chart from the numeric summary of the analyzed data."""
    if "visualize" not in state["plan"]:
        return state

    chat_dir = state["chat_dir"]
    os.makedirs(chat_dir, exist_ok=True)

    # Build chart data from the mean of each numeric column in the analysis
    # output — real data instead of placeholder values.
    chart_data = None
    for _name, payload in state["analysis"].items():
        try:
            result = json.loads(payload)
        except (json.JSONDecodeError, TypeError):
            continue
        summary = result.get("summary") or {}
        means = {
            col: stats.get("mean")
            for col, stats in summary.items()
            if isinstance(stats, dict) and stats.get("mean") is not None
        }
        if means:
            chart_data = {"column": list(means.keys()), "mean": list(means.values())}
            break

    if not chart_data:
        # Nothing numeric to chart — skip rather than emit a fake chart.
        state["visualizations"] = []
        return state

    try:
        chart_json = create_chart.invoke({
            "data": json.dumps(chart_data),
            "chart_type": "bar",
            "title": "Column Means",
            "x": "column",
            "y": "mean",
        })

        chart_file = os.path.join(chat_dir, "chart_data.json")
        with open(chart_file, "w", encoding="utf8") as f:
            f.write(chart_json)

        state["visualizations"] = ["chart_data.json"]
        logger.info("Chart created from analysis summary")
    except Exception as e:
        state["errors"].append(f"Visualization error: {str(e)}")
        state["visualizations"] = []

    return state

# ─── Node: Storyteller ───────────────────────────────────

def storyteller_node(state: AgentState) -> AgentState:
    """Generate the final HTML data story."""
    system_prompt = """You are a data storyteller. Create an engaging HTML data story.

Output format (strict):
1. First write a 2-3 sentence plain-text summary of your findings for the user (no markdown, no code fences).
2. Then, on a new line, output the complete HTML inside a ```html code block.

Requirements for the HTML:
- Single self-contained HTML file
- Detective/aesthetic theme with smooth CSS animations
- Include Plotly.js via CDN for charts
- Narrative structure: headline → mystery → insights → resolution
- Embed chart data in <script> blocks (no external fetch)"""

    context = f"""User Query: {state['user_query']}

Analysis Results:
{json.dumps(state['analysis'], indent=2, default=str)}

Visualizations: {state['visualizations']}

Raw Data Preview:
{state['raw_data'][:2000] if state['raw_data'] else 'None'}

Errors: {state['errors'] if state['errors'] else 'None'}"""

    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=context)
    ]

    try:
        response = llm_invoke(messages)
        raw = response.content.strip()

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
        state["html_output"] = html_code

        chat_dir = state["chat_dir"]
        os.makedirs(chat_dir, exist_ok=True)
        with open(os.path.join(chat_dir, "generated.html"), "w", encoding="utf8") as f:
            f.write(html_code)

        state["structured_response"] = GeneratedHTML(
            html_code=html_code,
            simple_response=summary_text or "Data story generated successfully",
            names_of_required_files=state["visualizations"],
            list_of_steps_you_did=state["plan"],
        )
        logger.info("Story generated")
    except Exception as e:
        state["errors"].append(f"Storyteller error: {str(e)}")
        logger.error(f"Storyteller failed: {e}")
        state["structured_response"] = GeneratedHTML(
            html_code="",
            simple_response=f"Error generating story: {str(e)}",
            names_of_required_files=[],
            list_of_steps_you_did=state["plan"],
        )

    return state

# ─── Graph Builder ───────────────────────────────────────

def build_graph():
    """Build the LangGraph multi-agent pipeline."""
    graph = StateGraph(AgentState)

    graph.add_node("planner", planner_node)
    graph.add_node("scraper", scraper_node)
    graph.add_node("analyst", analyst_node)
    graph.add_node("visualizer", visualizer_node)
    graph.add_node("storyteller", storyteller_node)

    graph.set_entry_point("planner")
    graph.add_edge("planner", "scraper")
    graph.add_edge("scraper", "analyst")
    graph.add_edge("analyst", "visualizer")
    graph.add_edge("visualizer", "storyteller")
    graph.add_edge("storyteller", END)

    # No checkpointer: every request is a one-shot run (no interrupts/resume).
    # A shared InMemorySaver would (a) require a thread_id in config on every
    # invoke and (b) leak checkpoints for all chats until the process restarts.
    return graph.compile()

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
    Run the multi-agent pipeline.

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
        "raw_data": "",
        "analysis": {},
        "visualizations": [],
        "html_output": "",
        "errors": [],
        "plan": [],
        "chat_dir": chat_dir,
        "structured_response": None,
    }

    graph = get_graph()
    config = {"callbacks": callbacks} if callbacks else {}

    try:
        result = graph.invoke(initial_state, config=config)

        if result.get("structured_response"):
            return {"structured_response": result["structured_response"]}
        else:
            return {
                "structured_response": GeneratedHTML(
                    html_code=result.get("html_output", ""),
                    simple_response="Analysis complete",
                    names_of_required_files=[],
                    list_of_steps_you_did=result.get("plan", []),
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
        preview = (output[:100] + "…") if len(str(output)) > 100 else str(output)
        self._put("Result", preview, "trace")

    def on_agent_finish(self, finish, **kwargs):
        self._put("Done", "Agent finished — compiling response", "trace")

    def on_chain_error(self, error, **kwargs):
        self._put("Error", str(error)[:120], "trace")
