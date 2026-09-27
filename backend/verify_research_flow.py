"""E2E test 2: research flow — topic with no local files must trigger search+scrape."""
import queue as q_module
import shutil
from pathlib import Path
import agent

# Fresh, empty chat dir — nothing to analyze locally
d = Path("uploads/99998")
if d.exists():
    shutil.rmtree(d)
d.mkdir(parents=True)

q = q_module.Queue()
cb = agent.TraceCallbackHandler(q)

result = agent.run_agent(
    [{"role": "user", "content": "Research global renewable energy adoption statistics and build a data story about it."}],
    callbacks=[cb],
    chat_id=99998,
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
for e in events:
    print(f"  [{e['tag']}] {e['label'][:75]}")
print("=== SUMMARY ===", sr.simple_response[:300])
print("=== HTML len ===", len(sr.html_code))

assert sr.html_code, f"no HTML: {sr.simple_response}"
assert any("search_web" in s for s in steps), f"research never searched: {steps}"
assert any(f.name.startswith("chart_") or f.name.startswith("table_") for f in d.iterdir()), \
    f"no chart/table produced from research: {files}"
assert len(events) >= 5, f"too few trace events: {len(events)}"
assert "NEED_MORE_RESEARCH" not in sr.simple_response
print("\nTEST 2 PASSED (research flow: search → scrape → analysis → story)")
