#!/usr/bin/env python3
"""Verifies the note -> revision card lifecycle and SRS algorithm."""
import json
import urllib.request

API = "http://127.0.0.1:3001/api"


def req(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(
        API + path, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(r) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw else None


def ok(cond, label, extra=""):
    print(f"  {'PASS' if cond else 'FAIL'}  {label}{'  ' + extra if extra else ''}")
    return cond


failures = 0

# Clean slate: drop any cards/notes from earlier runs
for n in req("GET", "/notes"):
    if n["title"].startswith(("Two Pointers", "Plain note")):
        req("DELETE", f"/notes/{n['id']}")
for c in req("GET", "/revisions"):
    if c["title"].startswith("Two Pointers"):
        req("DELETE", f"/revisions/{c['id']}")

print("\n1. Note without revisionScheduled creates no card")
before = len(req("GET", "/revisions"))
req("POST", "/notes", {"title": "Plain note", "content": "x", "revisionScheduled": False})
failures += not ok(len(req("GET", "/revisions")) == before, "no card created")

print("\n2. Note with revisionScheduled creates card; code fence extracted")
note = req("POST", "/notes", {
    "title": "Two Pointers",
    "content": "Use two indices moving inward.\n\n```python\nl, r = 0, n-1\nwhile l < r:\n    l += 1\n```\n\nTrailing prose.",
    "revisionScheduled": True,
    "tags": ["dsa", "arrays"],
})
nid = note["id"]
card = [c for c in req("GET", "/revisions") if c["title"] == "Two Pointers"][0]
cid = card["id"]
failures += not ok(card["currentStepIndex"] == 0, "starts at stage 0")
failures += not ok(card["totalRevisions"] == 0, "zero revisions")
failures += not ok("```" not in card["concept"], "concept has no code fence")
failures += not ok("Trailing prose" in card["concept"], "prose after fence kept")
failures += not ok(card["codeSnippet"] and "l, r = 0, n-1" in card["codeSnippet"],
                   "code body extracted")
failures += not ok("```" not in (card["codeSnippet"] or ""), "snippet has no fence markers")

print("\n3. GOOD x2 -> stage 2 (3 day interval)")
req("POST", f"/revisions/{cid}/grade", {"grade": "GOOD"})
req("POST", f"/revisions/{cid}/grade", {"grade": "GOOD"})
c = req("GET", f"/revisions/{cid}")
failures += not ok(c["currentStepIndex"] == 2, "stage", f"got {c['currentStepIndex']}")
failures += not ok(c["totalRevisions"] == 2, "revisions counted")
failures += not ok(len(c["history"]) == 2, "history rows", f"got {len(c['history'])}")
failures += not ok(c["history"][-1]["intervalDays"] == 3, "interval logged as 3")

print("\n4. Editing note refreshes display but PRESERVES schedule")
req("PUT", f"/notes/{nid}", {
    "title": "Two Pointers (revised)",
    "content": "Completely new body, no code.",
    "revisionScheduled": True,
})
c = req("GET", f"/revisions/{cid}")
failures += not ok(c["title"] == "Two Pointers (revised)", "title refreshed")
failures += not ok("Completely new body" in c["concept"], "concept refreshed")
failures += not ok(c["codeSnippet"] is None, "snippet cleared (no fence now)")
failures += not ok(c["currentStepIndex"] == 2, "stage preserved", f"got {c['currentStepIndex']}")
failures += not ok(c["totalRevisions"] == 2, "revisions preserved")

print("\n5. EASY at stage 2 -> +2 = stage 4")
req("POST", f"/revisions/{cid}/grade", {"grade": "EASY"})
c = req("GET", f"/revisions/{cid}")
failures += not ok(c["currentStepIndex"] == 4, "stage", f"got {c['currentStepIndex']}")
failures += not ok(c["history"][-1]["intervalDays"] == 14, "interval 14")

print("\n6. HARD holds stage")
req("POST", f"/revisions/{cid}/grade", {"grade": "HARD"})
c = req("GET", f"/revisions/{cid}")
failures += not ok(c["currentStepIndex"] == 4, "stage unchanged", f"got {c['currentStepIndex']}")

print("\n7. EASY near ceiling clamps at 6")
req("POST", f"/revisions/{cid}/grade", {"grade": "EASY"})   # 4 -> 6
req("POST", f"/revisions/{cid}/grade", {"grade": "EASY"})   # 6 -> 6
c = req("GET", f"/revisions/{cid}")
failures += not ok(c["currentStepIndex"] == 6, "clamped at 6", f"got {c['currentStepIndex']}")
failures += not ok(c["history"][-1]["intervalDays"] == 90, "interval 90")

print("\n8. AGAIN resets to stage 1 regardless of height")
req("POST", f"/revisions/{cid}/grade", {"grade": "AGAIN"})
c = req("GET", f"/revisions/{cid}")
failures += not ok(c["currentStepIndex"] == 1, "reset to 1", f"got {c['currentStepIndex']}")
failures += not ok(c["history"][-1]["intervalDays"] == 1, "interval 1 (tomorrow)")

print("\n9. Toggling revisionScheduled OFF deletes card and history")
req("PUT", f"/notes/{nid}", {"revisionScheduled": False})
remaining = req("GET", "/revisions")
failures += not ok(not any(x["id"] == cid for x in remaining), "card deleted")

print("\n10. Toggling back ON creates a fresh card at stage 0")
req("PUT", f"/notes/{nid}", {"revisionScheduled": True})
fresh = [x for x in req("GET", "/revisions") if x["noteId"] == nid]
failures += not ok(len(fresh) == 1, "exactly one card")
if fresh:
    failures += not ok(fresh[0]["currentStepIndex"] == 0, "stage 0")
    failures += not ok(fresh[0]["totalRevisions"] == 0, "history did not return")

print("\n11. /revisions/due returns today-or-earlier only")
due = req("GET", "/revisions/due")
failures += not ok(all(d["nextDueDate"] <= "2026-08-06" for d in due),
                   "all due dates <= today", f"{len(due)} due")

# Cleanup
for n in req("GET", "/notes"):
    if n["title"].startswith(("Two Pointers", "Plain note")):
        req("DELETE", f"/notes/{n['id']}")

print(f"\n{'ALL CHECKS PASSED' if failures == 0 else f'{failures} CHECK(S) FAILED'}\n")
raise SystemExit(1 if failures else 0)
