#!/usr/bin/env python3
"""Quick lifecycle test for the unified interview items + revision flow."""

import json
import urllib.request

BASE = "http://127.0.0.1:3001/api"

def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return resp.status, json.loads(resp.read().decode())

# Create with revision opt-in
status, item = req("POST", "/interview-items", {
    "title": "Lifecycle Probe",
    "topicType": "DSA",
    "description": "Testing the revision lifecycle",
    "tags": ["test", "lifecycle"],
    "addToRevision": True,
})
print(f"Created: status={status} item_status={item['status']} revId={item['revisionItemId']}")
assert status == 201
assert item["status"] == "REVISION_PENDING"
assert item["revisionItemId"] is not None

item_id = item["id"]

# Grade GOOD -> should become REVISION_1_DONE
_, after1 = req("POST", f"/interview-items/{item_id}/revise", {"grade": "GOOD"})
print(f"After GOOD: status={after1['status']}")
assert after1["status"] == "REVISION_1_DONE"

# Grade EASY -> should become REVISION_2_DONE
_, after2 = req("POST", f"/interview-items/{item_id}/revise", {"grade": "EASY"})
print(f"After EASY: status={after2['status']}")
assert after2["status"] == "REVISION_2_DONE"

# Grade AGAIN -> resets to stage 1, but totalRevisions is now 3
_, after3 = req("POST", f"/interview-items/{item_id}/revise", {"grade": "AGAIN"})
print(f"After AGAIN: status={after3['status']}")
assert after3["status"] == "REVISION_3_DONE"

# Create without revision -> status is DONE
status2, plain = req("POST", "/interview-items", {
    "title": "Plain Item",
    "topicType": "SYSTEM_DESIGN",
    "description": "No revision",
    "tags": ["test"],
})
print(f"Plain: status={status2} item_status={plain['status']} revId={plain['revisionItemId']}")
assert plain["status"] == "DONE"
assert plain["revisionItemId"] is None

# Add revision retroactively
_, updated = req("PUT", f"/interview-items/{plain['id']}", {"addToRevision": True})
print(f"After addToRevision: status={updated['status']} revId={updated['revisionItemId']}")
assert updated["status"] == "REVISION_PENDING"
assert updated["revisionItemId"] is not None

# Cleanup
req("DELETE", f"/interview-items/{item_id}")
req("DELETE", f"/interview-items/{plain['id']}")
print("\nAll assertions passed. Lifecycle works.")
