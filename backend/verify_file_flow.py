"""E2E test 1: file-based direct-analysis flow (router must skip research)."""
import queue as q_module
import json
from pathlib import Path
import agent

# Seed a chat dir with real data
d = Path("uploads/99999")
d.mkdir(parents=True, exist_ok=True)
(d / "sales.csv").write_text(
    "region,units,revenue,profit\nNorth,120,45000,9000\nSouth,80,32000,5100\n"
    "East,200,78000,15600\nWest,150,60000,12000\n", encoding="utf8")
for stale in ("chart_1.json", "chart_2.json", "chart_3.json"):
    (d / stale).unlink(missing_ok=True)
(d / "generated.html").unlink(missing_ok=True)

q = q_module.Queue()
cb = agent.TraceCallbackHandler(q)

result = agent.run_agent(
    [{"role": "user", "content": "Which region is most profitable and how do regions compare? Analyze my sales data and make a story."}],
    callbacks=[cb],
    chat_id=99999,
)

events = []
while not q.empty():
    ev = q.get_nowait()
    if ev:
        events.append(ev)

sr = result["structured_response"]
steps = sr.list_of_steps_you_did
files = sorted(f.name for f in d.iterdir())

print("=== STEPS ===")
for s in steps:
    print("  -", s)
print("=== FILES ===", files)
print("=== TRACE ===", len(events), "events")
for e in events[:20]:
    print(f"  [{e['tag']}] {e['label'][:70]}")
print("=== SUMMARY ===", sr.simple_response[:220])
print("=== HTML len ===", len(sr.html_code))

# Assertions
assert sr.html_code, "no HTML produced"
assert any("group_stats" in s or "analyze_data" in s for s in steps), f"analyst tools missing from steps: {steps}"
assert any(f.name.startswith("chart_") for f in d.iterdir()), "no chart file created"
assert len(events) >= 3, f"too few trace events: {len(events)}"
assert "NEED_MORE_RESEARCH" not in sr.simple_response, "marker leaked into user-facing summary"
assert not any("search_web" in s or "scrape_url" in s for s in steps), "research ran despite direct-analysis mode"
print("\nTEST 1 PASSED (direct analysis, no research)")
