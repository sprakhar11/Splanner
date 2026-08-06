#!/usr/bin/env python3
"""Verifies the four Interview Prep resources round-trip through the API
with exactly the field shapes InterviewPrep.tsx renders."""

import json
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:3001/api"
passed, failed = [], []


def check(name, cond, detail=""):
    (passed if cond else failed).append(name)
    print(("  PASS  " if cond else "  FAIL  ") + name + (f"   {detail}" if detail and not cond else ""))


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode()
        return resp.status, (json.loads(raw) if raw else None)


today = date.today().isoformat()
soon = (date.today() + timedelta(days=3)).isoformat()
created = {}

# ---------------------------------------------------------------- DSA
print("\nDSA")
status, item = req("POST", "/dsa", {
    "title": "Trapping Rain Water", "difficulty": "HARD", "platform": "LEETCODE",
    "categoryPattern": "Two Pointers", "timeTakenMinutes": 42, "status": "SOLVED",
    "url": "https://leetcode.com/problems/trapping-rain-water/",
    "revisionDue": today,
    "mistakesNotes": "Forgot to track running max from the right.",
    "solutionSnippet": "def trap(h): ...",
})
check("POST /dsa returns 201", status == 201, f"got {status}")
created["dsa"] = item["id"]
for f in ["title", "difficulty", "platform", "categoryPattern",
          "timeTakenMinutes", "status", "url", "revisionDue",
          "mistakesNotes", "solutionSnippet"]:
    check(f"dsa.{f} persisted", f in item and item[f] not in (None, ""))
check("dsa.timeTakenMinutes is a number", isinstance(item.get("timeTakenMinutes"), int))
check("dsa.revisionDue drives 'due to revisit' stat", item.get("revisionDue") <= today)

status, lst = req("GET", "/dsa")
check("GET /dsa is a list", isinstance(lst, list))
check("GET /dsa contains new row", any(d["id"] == created["dsa"] for d in lst))

# ------------------------------------------------------- System Design
print("\nSystem Design")
status, item = req("POST", "/system-design", {
    "title": "Design a rate limiter", "category": "DISTRIBUTED_SYSTEMS",
    "notes": "Token bucket at the edge, Redis counters behind it.",
    "keyTradeoffs": ["Token bucket vs leaky bucket", "Redis vs in-memory"],
    "isRevised": True, "lastRevised": today,
})
check("POST /system-design returns 201", status == 201, f"got {status}")
created["sd"] = item["id"]
check("sd.title persisted", item.get("title") == "Design a rate limiter")
check("sd.category persisted", item.get("category") == "DISTRIBUTED_SYSTEMS")
check("sd.isRevised is truthy", bool(item.get("isRevised")))
check("sd.lastRevised persisted", item.get("lastRevised") == today)

raw = item.get("keyTradeoffs")
parsed = raw if isinstance(raw, list) else json.loads(raw or "[]")
check("sd.keyTradeoffs parses to 2 items", len(parsed) == 2, f"got {raw!r}")

# ---------------------------------------------------------------- LLD
print("\nLLD")
status, item = req("POST", "/lld", {
    "title": "Design a parking lot", "pattern": "STRATEGY", "status": "IN_PROGRESS",
    "description": "Spot allocation strategies per vehicle size.",
    "codeSnippet": "class ParkingLot: ...",
})
check("POST /lld returns 201", status == 201, f"got {status}")
created["lld"] = item["id"]
for f in ["title", "pattern", "status", "description", "codeSnippet"]:
    check(f"lld.{f} persisted", item.get(f) not in (None, ""))
check("lld.status is a known enum", item.get("status") in ["IMPLEMENTED", "IN_PROGRESS", "BACKLOG"])

# ----------------------------------------------------------- HR Stories
print("\nHR Stories")
status, item = req("POST", "/hr-stories", {
    "title": "Shipped the migration after the lead quit",
    "questionCategory": "LEADERSHIP",
    "situation": "Two weeks from a compliance deadline our tech lead resigned.",
    "task": "I owned finishing the Postgres migration.",
    "action": "I cut scope to the three blocking tables and paired daily.",
    "result": "Shipped four days early with zero rollback.",
    "tags": ["ownership", "ambiguity"],
})
check("POST /hr-stories returns 201", status == 201, f"got {status}")
created["hr"] = item["id"]
for f in ["situation", "task", "action", "result"]:
    check(f"hr.{f} persisted (STAR meter)", item.get(f) not in (None, ""))

# The list endpoint must include tags — HrTab reads s.tags off the list response.
status, lst = req("GET", "/hr-stories")
row = next((s for s in lst if s["id"] == created["hr"]), None)
check("GET /hr-stories includes the row", row is not None)
check("GET /hr-stories returns tags array", isinstance(row.get("tags"), list),
      f"got {row.get('tags')!r}")
check("hr tags round-trip both values", sorted(row.get("tags") or []) == ["ambiguity", "ownership"],
      f"got {row.get('tags')!r}")
check("all 4 STAR parts present -> 'interview ready'",
      all((row.get(k) or "").strip() for k in ["situation", "task", "action", "result"]))

# A partial story must count as 2/4, not 4/4.
status, partial = req("POST", "/hr-stories", {
    "title": "Partial story", "questionCategory": "BEHAVIORAL",
    "situation": "Only this one filled.", "task": "And this.",
})
created["hr2"] = partial["id"]
status, lst = req("GET", "/hr-stories")
p = next((s for s in lst if s["id"] == created["hr2"]), None)
filled = sum(1 for k in ["situation", "task", "action", "result"] if (p.get(k) or "").strip())
check("partial story counts 2/4 STAR parts", filled == 2, f"got {filled}")
check("partial story has empty tags array", p.get("tags") == [], f"got {p.get('tags')!r}")

# ------------------------------------------------------- update + delete
print("\nUpdate / delete")
status, upd = req("PUT", f"/hr-stories/{created['hr']}", {
    "title": "Shipped the migration after the lead quit",
    "questionCategory": "FAILURE_AND_GROWTH",
    "situation": "s", "task": "t", "action": "a", "result": "r",
    "tags": ["ownership"],
})
check("PUT /hr-stories changes category", upd.get("questionCategory") == "FAILURE_AND_GROWTH")
status, lst = req("GET", "/hr-stories")
row = next(s for s in lst if s["id"] == created["hr"])
check("PUT replaces tags (2 -> 1)", row.get("tags") == ["ownership"], f"got {row.get('tags')!r}")

status, upd = req("PUT", f"/system-design/{created['sd']}",
                  {"isRevised": False, "lastRevised": None})
check("PUT /system-design can un-revise", not bool(upd.get("isRevised")))

for key, path in [("dsa", "/dsa"), ("sd", "/system-design"),
                  ("lld", "/lld"), ("hr", "/hr-stories"), ("hr2", "/hr-stories")]:
    req("DELETE", f"{path}/{created[key]}")
status, lst = req("GET", "/hr-stories")
check("DELETE removes rows", not any(s["id"] in (created["hr"], created["hr2"]) for s in lst))

print(f"\n{len(passed)}/{len(passed) + len(failed)} checks passed")
if failed:
    print("FAILED: " + ", ".join(failed))
    raise SystemExit(1)
print("Interview Prep API verified end to end.")
