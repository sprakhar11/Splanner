#!/usr/bin/env python3
"""Tests the task completion -> interview item activation flow."""

import json
import urllib.request

BASE = "http://127.0.0.1:3001/api"

def req(m, p, b=None):
    d = json.dumps(b).encode() if b else None
    r = urllib.request.Request(BASE + p, data=d, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return resp.status, json.loads(resp.read().decode())

# Show current state
_, items = req("GET", "/interview-items")
print("Interview items:")
for i in items:
    linked = (i.get("linkedTaskId") or "")[:8]
    print(f"  {i['title'][:35]:35} status={i['status']:20} linked={linked or 'none'}")

# Find the task to complete
_, tasks = req("GET", "/tasks")
task = next((t for t in tasks if t["title"] == "Networking Essentials"), None)
if not task:
    print("\nERROR: Networking Essentials task not found")
    exit(1)

print(f"\nCompleting: {task['title']} (id={task['id'][:8]}...)")
_, updated = req("PUT", f"/tasks/{task['id']}", {"status": "COMPLETED"})
print(f"  Task status now: {updated['status']}")

# Check result
_, items_after = req("GET", "/interview-items")
item = next((i for i in items_after if i["title"] == "Networking Essentials"), None)
print(f"\nInterview item:")
print(f"  status: {item['status']}")
print(f"  revisionItemId: {item.get('revisionItemId', 'none')}")

_, revs = req("GET", "/revisions")
card = next((r for r in revs if r["title"] == "Networking Essentials"), None)
if card:
    print(f"  Revision card due: {card['nextDueDate']}")
else:
    print("  NO revision card (ERROR)")

print(f"\nRevision cards total: {len(revs)}")
print("\nDone.")
