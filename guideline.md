# Splanner — Task & Interview Prep Creation Guidelines

This document is for any AI assistant helping the user add tasks, interview prep items, or study plans to Splanner. Follow these rules exactly.

---

## 1. API Base

```
http://127.0.0.1:3001/api
```

The server must be running (`pnpm dev` in the project directory).

---

## 2. Creating a Task (Planner)

```http
POST /api/tasks
Content-Type: application/json
```

**Required fields:**
```json
{
  "title": "Task name",
  "date": "2026-08-10"  // yyyy-MM-dd format, REQUIRED
}
```

**Optional fields:**
```json
{
  "description": "Details about the task",
  "estimatedMinutes": 60,          // default: 30
  "priority": "P2",                // P1 (urgent) | P2 (high) | P3 (medium) | P4 (low)
  "tags": ["system-design", "redis"],
  "status": "TODO",                // TODO | IN_PROGRESS | COMPLETED | SNOOZED
  "repeat": "NONE",               // NONE | DAILY | WEEKLY | MONTHLY
  "deadline": 1786000000000,       // epoch-ms, optional
  "reminderAt": 1786000000000,     // epoch-ms, optional
  "addToInterviewPrep": true,      // creates a linked interview item
  "interviewTopic": "SYSTEM_DESIGN" // required if addToInterviewPrep is true
}
```

**Rules:**
- `title` must be non-empty (server returns 400 otherwise)
- `date` must be provided (server returns 400 otherwise)
- If `addToInterviewPrep: true`, the server automatically creates an interview item with status `PENDING` linked to this task. The revision card is created only when the task is marked COMPLETED.

---

## 3. Creating an Interview Prep Item (standalone)

Use this when adding items directly to interview prep WITHOUT a planner task.

```http
POST /api/interview-items
Content-Type: application/json
```

```json
{
  "title": "Topic name",           // REQUIRED
  "topicType": "SYSTEM_DESIGN",    // REQUIRED — see available topics below
  "description": "Tracks: Cache Strategies, Eviction & Invalidation",
  "link": "https://...",           // optional URL
  "tags": ["caching", "redis"],    // optional array
  "addToRevision": true,           // creates a revision card immediately
  "linkedTaskId": null             // set to a task ID to link (status becomes PENDING)
}
```

**Status logic:**
- If `linkedTaskId` is set → status = `PENDING` (waits for task completion)
- If `linkedTaskId` is null AND `addToRevision: true` → status = `REVISION_PENDING`, card created due tomorrow
- If `linkedTaskId` is null AND `addToRevision: false` → status = `DONE`

---

## 4. Available Topic Types

Default topics: `DSA`, `SYSTEM_DESIGN`, `LLD`

Custom topics the user may have added (check with):
```http
GET /api/settings
```
Look at the `interviewTopics` key (JSON array string). If set, that IS the full list. If empty/missing, use the 3 defaults.

Currently also has: `CONTEST`, `ARTICLE` (user-added)

---

## 5. Bulk Planning Pattern

When the user asks to plan multiple days, write a Python script in `scripts/` and run it. Pattern:

```python
#!/usr/bin/env python3
import json
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:3001/api"

def req(m, p, b=None):
    d = json.dumps(b).encode() if b else None
    r = urllib.request.Request(BASE + p, data=d, method=m, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return resp.status, json.loads(resp.read().decode())

# Create tasks...
for task in tasks:
    req("POST", "/tasks", task)
```

**Important:** Always write the script to a file first, then run it. Inline Python in the shell tends to timeout.

```bash
/opt/homebrew/bin/python3 scripts/your-script.py
```

---

## 6. Planning Rules (User Preferences)

### General:
- **Always ask** which days of the week before assuming
- **Always draft first** — show the plan to the user before executing
- **Append only** — never delete existing data unless explicitly asked
- **No revision for recurring practice tasks** (e.g. AI interviews) unless asked

### Task naming conventions:
- Study plans: `"Topic Name Day N"` (e.g. "Redis Day 1", "Caching Day 2")
- Interviews: `"AI Interview Practice #N"`
- Contests: `"Upsolve [Platform] [Contest Name]"`
- Include tracks/topics in the `description` field

### Interview Prep linking:
- When adding study tasks, set `addToInterviewPrep: true` + `interviewTopic`
- The interview item starts as `PENDING` and only enters the revision queue when the task is completed
- This is the CORRECT flow — do NOT create revision cards for incomplete work

### Time estimates:
- System design topics: 60 min
- DSA problems: 90 min
- AI interviews: 45 min
- Ask the user if not obvious

### Priority:
- Interview practice: P1
- Study tasks: P2
- Nice-to-have: P3

---

## 7. Scheduling Patterns

### Consecutive days:
```python
current_date = start_date
for task in tasks:
    req("POST", "/tasks", {"title": task, "date": current_date.isoformat(), ...})
    current_date += timedelta(days=1)
```

### Alternate days:
```python
current_date += timedelta(days=2)  # skip one day
```

### Specific days of week (e.g. Sun/Wed/Fri):
```python
# Find next Monday as week anchor
week_start = next_monday + timedelta(weeks=week)
days = [
    week_start + timedelta(days=6),  # Sunday
    week_start + timedelta(days=2),  # Wednesday  
    week_start + timedelta(days=4),  # Friday
]
```

### Finding next Monday:
```python
today = date.today()
days_until_monday = (7 - today.weekday()) % 7
if days_until_monday == 0:
    days_until_monday = 7
next_monday = today + timedelta(days=days_until_monday)
```

---

## 8. Adding a New Topic Type

If the user wants a new topic (e.g. "BEHAVIORAL"):

```http
PUT /api/settings
Content-Type: application/json

{
  "interviewTopics": "[\"DSA\",\"SYSTEM_DESIGN\",\"LLD\",\"CONTEST\",\"BEHAVIORAL\"]"
}
```

**Important:** Read the current value first, parse it, append, re-serialize. Don't overwrite blindly.

---

## 9. Querying Existing Data

### List all tasks for a date range:
```http
GET /api/tasks?from=2026-08-10&to=2026-08-17
```

### List interview items by topic:
```http
GET /api/interview-items?topic=SYSTEM_DESIGN
```

### Get interview prep stats:
```http
GET /api/interview-items/stats/summary
```

### Check settings:
```http
GET /api/settings
```

---

## 10. Deleting Tasks

```http
DELETE /api/tasks/:id
```

To delete all tasks matching a pattern, fetch all then filter:
```python
_, all_tasks = req("GET", "/tasks")
for t in all_tasks:
    if "AI Interview" in t["title"]:
        req("DELETE", f"/tasks/{t['id']}")
```

For series tasks, use `?scope=series` or `?scope=future`:
```http
DELETE /api/tasks/:id?scope=series   # deletes all occurrences
DELETE /api/tasks/:id?scope=future   # deletes this + future untouched ones
```

---

## 11. Marking a Task Complete

```http
PUT /api/tasks/:id
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

This triggers `activateLinkedInterviewItems()` — any linked interview prep items will:
- Flip from `PENDING` → `REVISION_PENDING`
- Get a revision card created (due tomorrow)

---

## 12. Revision / SRS System

**Intervals:** 1, 3, 7, 14, 30, 90 days (from completion date)

**Grading:**
```http
POST /api/interview-items/:id/revise
Content-Type: application/json

{"grade": "GOOD"}  // AGAIN | HARD | GOOD | EASY
```

- AGAIN → stage resets to 1
- HARD → stage holds (same interval)
- GOOD → stage +1
- EASY → stage +2

**Status progression:** `REVISION_PENDING` → `REVISION_1_DONE` → `REVISION_2_DONE` → ... → `REVISION_7_DONE`

---

## 13. Common Mistakes to Avoid

1. **Don't create revision cards for incomplete work** — use `linkedTaskId` so the card only appears after completion
2. **Don't assume days of the week** — always ask the user
3. **Don't use inline Python with curl** — it times out in the shell; write a script file
4. **Don't hardcode topic lists** — read from settings first
5. **Don't forget the `date` field** on tasks — the server will 400
6. **Don't use `addToRevision: true` without thinking** — only if the user explicitly wants spaced repetition
7. **Always draft first** — show the plan table to the user before running the script
8. **Append only** — never delete existing data unless the user says to

---

## 14. Example: Planning a Study Schedule

User says: "Add Module X topics, 2 tracks per day, starting Monday, mark for revision, add to System Design"

Steps:
1. List the topics and tracks
2. Group into days (2 tracks each)
3. Draft a table showing date + task name + description
4. Show to user for approval
5. Write a Python script with the plan
6. Run it
7. Report results

Script template:
```python
tasks = [
    {"title": "Topic Day 1", "description": "Tracks: X, Y", "tags": ["system-design", "topic"]},
    {"title": "Topic Day 2", "description": "Tracks: Z", "tags": ["system-design", "topic"]},
]

current_date = start_date
for t in tasks:
    req("POST", "/tasks", {
        "title": t["title"],
        "description": t["description"],
        "date": current_date.isoformat(),
        "estimatedMinutes": 60,
        "priority": "P2",
        "tags": t["tags"],
        "addToInterviewPrep": True,
        "interviewTopic": "SYSTEM_DESIGN",
    })
    current_date += timedelta(days=1)
```

---

## 15. Example: Adding Recurring Practice

User says: "Add 3 AI interviews per week for 3 months on Sun/Wed/Fri"

```python
for week in range(13):
    week_start = next_monday + timedelta(weeks=week)
    days = [
        week_start + timedelta(days=6),  # Sunday
        week_start + timedelta(days=2),  # Wednesday
        week_start + timedelta(days=4),  # Friday
    ]
    days.sort()
    for d in days:
        req("POST", "/tasks", {
            "title": f"AI Interview Practice #{num}",
            "date": d.isoformat(),
            "estimatedMinutes": 45,
            "priority": "P1",
            "tags": ["interview", "mock"],
        })
        # NO addToInterviewPrep for recurring practice
```

---

## 16. User's Current Setup

- **Interview topics:** DSA, SYSTEM_DESIGN, LLD, CONTEST (+ any custom)
- **AI Interview days:** Sun, Wed, Fri
- **Study time per topic:** Usually 1 hour
- **Preferred start day:** Monday (for study blocks)
- **Reflection:** Defaults to yesterday (not today)
- **Day rollover:** Incomplete tasks auto-move to today on next app open
