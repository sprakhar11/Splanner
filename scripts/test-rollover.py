#!/usr/bin/env python3
"""Tests the day rollover mechanism."""

import json
import sqlite3
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:3001/api"


def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return resp.status, json.loads(resp.read().decode())


today = date.today().isoformat()
yesterday = (date.today() - timedelta(days=1)).isoformat()
three_days_ago = (date.today() - timedelta(days=3)).isoformat()

# Create tasks in the past
_, t1 = req("POST", "/tasks", {"title": "Past TODO", "date": yesterday, "status": "TODO"})
_, t2 = req("POST", "/tasks", {"title": "Past WIP", "date": three_days_ago, "status": "IN_PROGRESS"})
_, t3 = req("POST", "/tasks", {"title": "Past DONE", "date": yesterday, "status": "COMPLETED"})
print(f"Created: TODO({yesterday}), WIP({three_days_ago}), DONE({yesterday})")

# Reset rollover flag
req("PUT", "/settings", {"lastRolloverDate": ""})

# Trigger via any request
req("GET", "/health")

# Verify
_, t1a = req("GET", f"/tasks/{t1['id']}")
_, t2a = req("GET", f"/tasks/{t2['id']}")
_, t3a = req("GET", f"/tasks/{t3['id']}")

print(f"\nAfter rollover:")
print(f"  TODO:    {t1a['date']} (expect {today})")
print(f"  WIP:     {t2a['date']} (expect {today})")
print(f"  DONE:    {t3a['date']} (expect {yesterday}, not moved)")

assert t1a["date"] == today, f"TODO not moved: {t1a['date']}"
assert t2a["date"] == today, f"WIP not moved: {t2a['date']}"
assert t3a["date"] == yesterday, f"DONE was moved: {t3a['date']}"

# Check log
con = sqlite3.connect("data/splanner.db")
logs = con.execute("SELECT task_id, from_date, to_date FROM task_rollovers").fetchall()
print(f"\nRollover log: {len(logs)} entries")
for log in logs:
    print(f"  {log[0][:8]}... {log[1]} -> {log[2]}")

# Verify idempotency
req("GET", "/health")
logs2 = con.execute("SELECT count(*) FROM task_rollovers").fetchone()[0]
assert logs2 == len(logs), f"Ran twice! {logs2} != {len(logs)}"
print(f"Idempotent: still {logs2} entries after second call")

# Check flag
_, s = req("GET", "/settings")
assert s.get("lastRolloverDate") == today
print(f"Flag: lastRolloverDate = {s['lastRolloverDate']}")

# Cleanup
for t in [t1, t2, t3]:
    req("DELETE", f"/tasks/{t['id']}")
con.execute("DELETE FROM task_rollovers")
con.commit()
con.close()

print("\nAll passed. Day rollover works.")
