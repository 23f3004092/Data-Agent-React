"""Tool-level verification of the analyst upgrade — EDA column roles, the run_python
sandbox, and the chart registry (incl. choropleth/map). No LLM calls: runs in ~30s
for free. From backend/: python verify_sandbox.py"""
import json
import shutil
import sys
from pathlib import Path

import agent

CHAT = "uploads/88888"
D = Path(CHAT)
CFG = {"configurable": {"chat_dir": CHAT}}

failures = []


def check(name, cond, detail=""):
    print(("PASS  " if cond else "FAIL  ") + name + (f"  [{detail}]" if detail and not cond else ""),
          flush=True)
    if not cond:
        failures.append(name)


# ─── Fixtures ─────────────────────────────────────────────
shutil.rmtree(D, ignore_errors=True)
D.mkdir(parents=True)
(D / "sales.csv").write_text(
    "date,region,country,city,lon,lat,revenue,units,note\n"
    "2024-01-05,North,India,Delhi,77.2,28.6,1200,10,a\n"
    "2024-02-10,South,Germany,Berlin,13.4,52.5,800,7,b\n"
    "2024-03-15,East,Brazil,Sao Paulo,-46.6,-23.5,1500,12,c\n"
    "2024-04-20,West,USA,New York,-74.0,40.7,2000,15,d\n"
    "2024-05-25,North,India,Delhi,77.2,28.6,1300,11,e\n"
    "2024-06-30,South,Japan,Tokyo,139.7,35.7,900,8,f\n",
    encoding="utf8")

# ─── 1. AST gate ──────────────────────────────────────────
print("== AST gate ==")
check("accepts plain analysis", agent._validate_python("print(df.head())") is None)
check("accepts allowed import",
      agent._validate_python("import numpy as np\nprint(np.mean([1, 2]))") is None)
rejects = {
    "import os": "import os",
    "aliased os": "import os as o\no.getcwd()",
    "from subprocess": "from subprocess import run",
    "open()": "open('C:/Windows/win.ini')",
    "eval()": "eval('1+1')",
    "dunder attribute": "print(df.__class__)",
    "dunder via getattr": "getattr(pd, '__globals__')",
    "network URL": "pd.read_csv('https://example.com/a.csv')",
    "absolute path": r"print(r'C:\Windows\System32')",
    "parent path": "pd.read_csv('../other_dir/x.csv')",
    "system() escape": "pd.io.common.os.system('dir')",
    "syntax error": "def (",
}
for _name, _code in rejects.items():
    check(f"rejects {_name}", agent._validate_python(_code) is not None)

# ─── 2. EDA column roles ──────────────────────────────────
print("\n== EDA column roles ==")
out = agent.analyze_data.invoke({"file_path": "sales.csv"}, config=CFG)
check("analyze_data returns JSON", out.lstrip().startswith("{"), out[:120])
prof = json.loads(out)
roles = prof.get("column_roles", {})
check("country -> geo_country", roles.get("country") == "geo_country", str(roles))
check("lat -> geo_lat", roles.get("lat") == "geo_lat", str(roles))
check("lon -> geo_lon", roles.get("lon") == "geo_lon", str(roles))
check("date -> datetime_string", roles.get("date") == "datetime_string", str(roles))
check("revenue -> numeric_money", roles.get("revenue") == "numeric_money", str(roles))
check("region -> categorical", roles.get("region") == "categorical", str(roles))
check("cardinality present", prof.get("cardinality", {}).get("region") == 4,
      str(prof.get("cardinality")))
check("time_ranges present", bool(prof.get("time_ranges")), str(prof.get("time_ranges")))

# ─── 3. run_python sandbox ────────────────────────────────
print("\n== run_python sandbox ==")
out = agent.run_python.invoke({"code": "print(int(df['revenue'].sum()))",
                               "file_path": "sales.csv"}, config=CFG)
check("computes sum with explicit file", out.strip() == "7700", out[:150])

out = agent.run_python.invoke({"code": "print(df.shape[1])"}, config=CFG)
check("auto-detects the single data file", out.strip() == "9", out[:150])

out = agent.run_python.invoke({"code": "print(df['revenue'].quantile(0.5))",
                               "file_path": "sales.csv"}, config=CFG)
check("median via pandas", out.strip() == "1250.0", out[:150])

out = agent.run_python.invoke({"code": "import socket"}, config=CFG)
check("tool-level rejection of socket", out.startswith("Rejected:"), out[:120])

out = agent.run_python.invoke({"code": "import time\ntime.sleep(60)",
                               "file_path": "sales.csv"}, config=CFG)
check("hang killed by timeout", "timed out" in out, out[:150])

# ─── 4. chart registry ────────────────────────────────────
print("\n== chart registry ==")
bar_data = json.dumps([
    {"year": 2023, "region": "North", "revenue": 100},
    {"year": 2024, "region": "North", "revenue": 150},
    {"year": 2023, "region": "South", "revenue": 80},
    {"year": 2024, "region": "South", "revenue": 120},
])
out = agent.create_chart.invoke({"data": bar_data, "chart_type": "bar", "title": "Rev",
                                 "x": "year", "y": "revenue", "color": "region",
                                 "mode": "stacked"}, config=CFG)
check("stacked bar saved", out.startswith("Saved chart_"), out[:160])
p1 = json.loads((D / "chart_1.json").read_text(encoding="utf8"))
check("barmode=stack in layout", p1.get("layout", {}).get("barmode") == "stack",
      str(p1.get("layout", {}).get("barmode")))

out = agent.create_chart.invoke({"data": json.dumps([[1.0, 0.6], [0.6, 1.0]]),
                                 "chart_type": "heatmap", "title": "Corr",
                                 "x": "a,b", "y": "a,b"}, config=CFG)
check("heatmap (2D matrix) saved", out.startswith("Saved chart_"), out[:160])

out = agent.create_chart.invoke({"data": json.dumps([
                                    {"group": "Asia", "country": "India", "v": 100},
                                    {"group": "Asia", "country": "Japan", "v": 90},
                                    {"group": "EU", "country": "Germany", "v": 80}]),
                                 "chart_type": "treemap", "title": "Tree",
                                 "x": "group,country", "y": "v"}, config=CFG)
check("treemap (hierarchy path) saved", out.startswith("Saved chart_"), out[:160])

out = agent.create_chart.invoke({"data": json.dumps([
                                    {"country": "India", "v": 100},
                                    {"country": "USA", "v": 200},
                                    {"country": "Atlantis", "v": 5}]),
                                 "chart_type": "choropleth", "title": "World",
                                 "x": "country", "y": "v"}, config=CFG)
check("choropleth saved (alias USA resolved)", out.startswith("Saved chart_"), out[:220])
check("unmatched locations reported", "unmatched" in out, out[:220])
geo_payloads = []
for _f in sorted(D.glob("chart_*.json")):
    _p = json.loads(_f.read_text(encoding="utf8"))
    if _p.get("data") and isinstance(_p["data"][0], dict) and "geojson" in _p["data"][0]:
        geo_payloads.append(_p)
check("geojson embedded in a chart", bool(geo_payloads), "no chart trace carries geojson")
if geo_payloads:
    trace4 = geo_payloads[0]["data"][0]
    check("geojson substantial (>50KB)", len(json.dumps(trace4.get("geojson", ""))) > 50000,
          str(len(json.dumps(trace4.get("geojson", "")))))

out = agent.create_chart.invoke({"data": json.dumps([
                                    {"lon": 77.2, "lat": 28.6, "city": "Delhi", "n": 10},
                                    {"lon": 2.3, "lat": 48.8, "city": "Paris", "n": 8}]),
                                 "chart_type": "map_scatter", "title": "Cities",
                                 "x": "lon", "y": "lat", "size": "n"}, config=CFG)
check("map_scatter saved", out.startswith("Saved chart_"), out[:160])

out = agent.create_chart.invoke({"data": json.dumps([{"a": 1}]), "chart_type": "radar",
                                 "title": "X", "x": "a", "y": "a"}, config=CFG)
check("unknown chart_type rejected", "Unknown chart_type" in out, out[:160])

out = agent.create_chart.invoke({"data": json.dumps([{"a": 1}]), "chart_type": "bar",
                                 "title": "X", "x": "nope", "y": "a"}, config=CFG)
check("missing column rejected", "Columns not found" in out, out[:160])

# ─── Summary ──────────────────────────────────────────────
print()
if failures:
    print(f"{len(failures)} FAILURE(S): {failures}")
    sys.exit(1)
print("ALL SANDBOX / EDA / CHART CHECKS PASSED")
shutil.rmtree(D, ignore_errors=True)
