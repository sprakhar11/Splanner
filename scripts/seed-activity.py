#!/usr/bin/env python3
"""Seeds study sessions and reflections so the Stats page charts have history.
Creates a realistic pattern: a solid recent streak, a gap, and earlier activity."""

import json
import random
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:3001/api"
random.seed(7)


def post(path, body):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode(),
                               method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode())


def get(path):
    with urllib.request.urlopen(BASE + path) as resp:
        return json.loads(resp.read().decode())


today = date.today()

# Clear prior seeded sessions so re-running does not pile up.
removed = 0
for s in get("/study-sessions"):
    if (s.get("note") or "").startswith("Seeded"):
        urllib.request.urlopen(urllib.request.Request(
            f"{BASE}/study-sessions/{s['id']}", method="DELETE"))
        removed += 1

# Day offsets to populate. Gaps are intentional so the streak logic is exercised.
# Last 9 days solid (a live streak), then a 3 day gap, then scattered history.
offsets = list(range(0, 9))
offsets += [12, 13, 14, 15, 16, 19, 20, 21, 25, 26, 27, 28]
offsets += [random.randint(30, 120) for _ in range(28)]
offsets = sorted(set(offsets))

sessions = 0
for off in offsets:
    d = (today - timedelta(days=off)).isoformat()
    # One or two sessions a day, pomodoro-ish lengths.
    for _ in range(random.choice([1, 1, 2])):
        post("/study-sessions", {
            "date": d,
            "minutes": random.choice([25, 25, 30, 45, 50, 60, 90]),
            "categoryId": None,
            "taskId": None,
            "note": "Seeded focus session",
        })
        sessions += 1

# Reflections for the last 14 days, with a plausible mood wobble.
reflections = 0
for off in range(0, 14):
    d = (today - timedelta(days=off)).isoformat()
    post("/reflections", {
        "date": d,
        "tasksCompletedCount": random.randint(1, 6),
        "hoursStudied": round(random.uniform(0.5, 4.0), 1),
        "problemsSolvedCount": random.randint(0, 4),
        "learnedSummary": "Seeded entry.",
        "struggledSummary": "",
        "mood": random.choice([3, 3, 4, 4, 4, 5, 2]),
        "gratitude": "",
    })
    reflections += 1

all_sessions = get("/study-sessions")
total_minutes = sum(s["minutes"] for s in all_sessions)
print(f"removed prior seeded sessions : {removed}")
print(f"study sessions created        : {sessions}")
print(f"reflections upserted          : {reflections}")
print(f"total sessions in db          : {len(all_sessions)}")
print(f"total minutes in db           : {total_minutes}")
print(f"distinct active days          : {len({s['date'] for s in all_sessions})}")
