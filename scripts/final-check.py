#!/usr/bin/env python3
"""Final comprehensive bug check across all API endpoints."""

import json
import urllib.request
import urllib.error

BASE = "http://127.0.0.1:3001/api"
passed = 0
failed = []


def req(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(BASE + path, data=data, method=method,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return resp.status, json.loads(resp.read().decode())


def check(name, cond):
    global passed
    if cond:
        passed += 1
    else:
        failed.append(name)
        print(f"  FAIL: {name}")


def expect_error(method, path, body, expected_code):
    try:
        data = json.dumps(body).encode() if body else None
        r = urllib.request.Request(BASE + path, data=data, method=method,
                                   headers={"Content-Type": "application/json"})
        urllib.request.urlopen(r)
        return False  # Should have thrown
    except urllib.error.HTTPError as e:
        return e.code == expected_code


# === Input validation ===
print("Input validation")
check("empty title task rejected", expect_error("POST", "/tasks", {"title": "", "date": "2026-08-06"}, 400))
check("whitespace title task rejected", expect_error("POST", "/tasks", {"title": "   ", "date": "2026-08-06"}, 400))
check("missing date task rejected", expect_error("POST", "/tasks", {"title": "valid"}, 400))
check("empty title interview item rejected", expect_error("POST", "/interview-items", {"title": "", "topicType": "DSA"}, 400))
check("missing topicType rejected", expect_error("POST", "/interview-items", {"title": "valid"}, 400))
check("empty reflection date rejected", expect_error("POST", "/reflections", {"mood": 3}, 400))

# === Full lifecycle ===
print("\nLifecycle")
s, task = req("POST", "/tasks", {"title": "Lifecycle test", "date": "2026-08-06", "estimatedMinutes": 30, "tags": ["test"]})
check("create task", s == 201 and task["title"] == "Lifecycle test")
check("task has correct status", task["status"] == "TODO")

# Update with nullable fields
s, updated = req("PUT", f"/tasks/{task['id']}", {"categoryId": "", "deadline": None, "reminderAt": None})
check("update with empty categoryId no 500", s == 200)
check("categoryId coerced to null", updated["categoryId"] is None)

# Interview item with revision
s, item = req("POST", "/interview-items", {"title": "Binary Search", "topicType": "DSA", "addToRevision": True, "tags": ["arrays"]})
check("create interview item", s == 201 and item["status"] == "REVISION_PENDING")
check("revision card created", item["revisionItemId"] is not None)

# Grade it
s, graded = req("POST", f"/interview-items/{item['id']}/revise", {"grade": "GOOD"})
check("grade GOOD advances to REVISION_1_DONE", graded["status"] == "REVISION_1_DONE")

s, graded2 = req("POST", f"/interview-items/{item['id']}/revise", {"grade": "EASY"})
check("grade EASY advances to REVISION_2_DONE", graded2["status"] == "REVISION_2_DONE")

# Add revision retroactively
s, plain = req("POST", "/interview-items", {"title": "Plain item", "topicType": "LLD", "tags": []})
check("create plain item", plain["status"] == "DONE" and plain["revisionItemId"] is None)

s, retroactive = req("PUT", f"/interview-items/{plain['id']}", {"addToRevision": True})
check("retroactive revision opt-in", retroactive["status"] == "REVISION_PENDING" and retroactive["revisionItemId"] is not None)

# Note with revision card
s, note = req("POST", "/notes", {"title": "Note test", "content": "important", "revisionScheduled": True})
check("create note with revision", s == 201)

revs = req("GET", "/revisions")[1]
note_card = [r for r in revs if r.get("noteId") == note["id"]]
check("note-linked revision card exists", len(note_card) == 1)

# Delete note cleans up card
req("DELETE", f"/notes/{note['id']}")
revs_after = req("GET", "/revisions")[1]
check("note delete cleans revision card", not any(r.get("noteId") == note["id"] for r in revs_after))

# Interview item delete cleans its card
cards_before = len(req("GET", "/revisions")[1])
req("DELETE", f"/interview-items/{item['id']}")
cards_after = len(req("GET", "/revisions")[1])
check("interview item delete cleans its card", cards_after == cards_before - 1)

req("DELETE", f"/interview-items/{plain['id']}")

# === Search ===
print("\nSearch")
search = req("GET", "/search?q=lifecycle")[1]
check("search finds the task", any(r["title"] == "Lifecycle test" for r in search))

# Nasty queries don't 500
for q in ["two-pointer", 'say "hi"', "foo(bar)", "a OR b", "*"]:
    try:
        req("GET", f"/search?q={urllib.request.quote(q)}")
        check(f"search '{q}' no error", True)
    except:
        check(f"search '{q}' no error", False)

# === Settings ===
print("\nSettings")
s, settings = req("GET", "/settings")
check("settings readable", s == 200 and "userName" in settings)

s, saved = req("PUT", "/settings", {"pomodoroMinutes": "50"})
check("settings writable", saved.get("pomodoroMinutes") == "50")

# Restore
req("PUT", "/settings", {"pomodoroMinutes": "25"})

# === Study sessions ===
print("\nStudy sessions")
s, ss = req("POST", "/study-sessions", {"date": "2026-08-06", "minutes": 25, "taskId": task["id"]})
check("create study session", s == 201 and ss["minutes"] == 25)

# === Reflections ===
print("\nReflections")
s, refl = req("POST", "/reflections", {"date": "2026-08-06", "mood": 4, "learnedSummary": "test"})
check("create reflection", s in (200, 201))

# Upsert
s, refl2 = req("POST", "/reflections", {"date": "2026-08-06", "mood": 5})
check("upsert reflection", refl2["mood"] == 5)

# 404 for missing date
try:
    urllib.request.urlopen(BASE + "/reflections/1999-01-01")
    check("missing reflection 404s", False)
except urllib.error.HTTPError as e:
    check("missing reflection 404s", e.code == 404)

# === Cleanup ===
print("\nCleanup")
req("DELETE", f"/tasks/{task['id']}")
req("DELETE", f"/study-sessions/{ss['id']}")
req("DELETE", f"/reflections/{refl2['id']}")

final_tasks = req("GET", "/tasks")[1]
final_items = req("GET", "/interview-items")[1]
final_revs = req("GET", "/revisions")[1]
final_search = req("GET", "/search/status")[1]

check("no tasks left", len(final_tasks) == 0)
check("no interview items left", len(final_items) == 0)
check("no revision cards left", len(final_revs) == 0)
check("search index clean", final_search["total"] == 0)

print(f"\n{passed}/{passed + len(failed)} checks passed")
if failed:
    print("FAILED:", ", ".join(failed))
    raise SystemExit(1)
print("No bugs found.")
