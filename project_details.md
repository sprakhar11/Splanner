# Splanner — Project Details

This document is a comprehensive reference for any AI or developer picking up this codebase. It covers architecture, data model, business logic, conventions, and known edge cases.

---

## 1. Project Overview

**Splanner** is a local-first interview preparation and daily planning web app. It runs entirely on the user's machine with no cloud, no accounts, and no external network calls.

- **Frontend:** React 19 + Vite + Tailwind CSS v4 + Motion (Framer Motion) + TanStack Query + React Router
- **Backend:** Hono (Node.js) + better-sqlite3 + Drizzle ORM
- **Database:** SQLite with WAL mode, FTS5 full-text search
- **Server binds:** `127.0.0.1:3001` (API), Vite dev server on `localhost:5173` (or 5174 if occupied)
- **Run command:** `pnpm dev` (starts both via concurrently)

---

## 2. Directory Structure

```
src/
├── client/                    # React frontend
│   ├── api/client.ts          # Centralized API client (all fetch calls)
│   ├── components/
│   │   ├── focus/             # FocusDock, ClockFace, SessionJournalSheet
│   │   ├── layout/            # IconRail, TopBar, MainContent, Sidebar
│   │   ├── palette/           # CommandPalette (Cmd+K)
│   │   ├── planner/           # MonthGrid, AgendaPanel
│   │   ├── stats/             # charts.tsx (Panel, Gauge, Heatmap, etc.)
│   │   ├── tasks/             # TaskEditor, TaskItem, SubtaskList
│   │   └── ui/               # shadcn-style primitives (Button, Input, toast, etc.)
│   ├── hooks/
│   │   ├── useAnalytics.ts    # useStudySessions, useReflections
│   │   ├── useAppearance.ts   # Dark/light mode + font scale
│   │   ├── useCategories.ts   # CRUD hooks for categories
│   │   ├── useCommandPalette.tsx  # Cmd+K provider
│   │   ├── useFocusTimer.tsx  # Timer provider (stopwatch + countdown + PiP)
│   │   ├── useInterviewItems.ts   # Unified interview prep hooks
│   │   ├── useKeyboard.ts     # Global keyboard shortcuts
│   │   ├── useNotes.ts        # Journal notes CRUD
│   │   ├── usePictureInPicture.tsx  # Document PiP floating window
│   │   ├── useReflection.ts   # Daily reflection hooks
│   │   ├── useReminders.ts    # Polling for reminders/overdue/nudges
│   │   ├── useRevisions.ts    # SRS revision card hooks
│   │   ├── useSearch.ts       # FTS5 search hook
│   │   ├── useSettings.ts     # Settings KV read/write
│   │   └── useTasks.ts        # Tasks + subtasks CRUD
│   ├── lib/
│   │   ├── constants.ts       # Daily quotes, SRS intervals
│   │   ├── date.ts            # Date math (toISO, monthGrid, formatClock, etc.)
│   │   ├── focus.ts           # Pure timer math (elapsedMsOf, sessionMinutes, etc.)
│   │   ├── journal.ts         # Journal sheet logic (threshold, entry building, etc.)
│   │   ├── palette.ts         # Command palette helpers (parseSnippet, groupHits, etc.)
│   │   ├── readiness.ts       # Interview readiness score (legacy, partially used)
│   │   ├── reflection.ts      # Reflection prefill logic
│   │   ├── settings.ts        # Typed settings layer (readSetting, clampSetting, etc.)
│   │   ├── streaks.ts         # Streak computation, heatmap, minutesByDay
│   │   └── utils.ts           # cn() classname merger
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── InterviewPrep.tsx  # Unified interview items with dynamic topic tabs
│   │   ├── Journal.tsx        # Notes with rich editor (contentEditable, links)
│   │   ├── Life.tsx           # Dot life calendar, time cards, goals
│   │   ├── Planner.tsx        # Calendar + agenda + year view
│   │   ├── Reflection.tsx     # End-of-day review (defaults to yesterday)
│   │   ├── Revise.tsx         # SRS flashcard sessions with mastery breakdown
│   │   ├── Settings.tsx       # All configuration panels
│   │   └── Stats.tsx          # Charts, streaks, interview progress
│   └── styles/globals.css     # Tailwind v4 theme (oklch dark/light)
├── server/
│   ├── db/
│   │   ├── connection.ts      # SQLite connection + WAL pragmas
│   │   ├── migrate-interview.ts  # Migrates legacy DSA/SD/LLD → interview_items
│   │   ├── schema.ts          # Drizzle schema (all tables)
│   │   ├── search-index.ts    # FTS5 self-healing index management
│   │   └── seed.ts            # Default categories + settings backfill
│   ├── routes/
│   │   ├── backup.ts          # JSON export/import
│   │   ├── categories.ts
│   │   ├── dsa.ts             # Legacy (kept for backward compat)
│   │   ├── hr-stories.ts      # Legacy
│   │   ├── interview-items.ts # Unified interview prep CRUD + revision lifecycle
│   │   ├── lld.ts             # Legacy
│   │   ├── notes.ts           # Journal notes with tag join + revision sync
│   │   ├── reflections.ts     # Daily reflections upsert
│   │   ├── revisions.ts       # SRS cards + grading
│   │   ├── search.ts          # FTS5 search with safe query escaping
│   │   ├── settings.ts        # KV settings store
│   │   ├── study-sessions.ts  # Focus time logs
│   │   ├── system-design.ts   # Legacy
│   │   └── tasks.ts           # Tasks + subtasks + series + interview linking
│   └── services/
│       ├── backup.ts          # VACUUM INTO + JSON export/import
│       ├── day-rollover.ts    # Moves incomplete tasks to today
│       ├── interview-activation.ts  # Task completion → interview item activation
│       ├── recurrence.ts      # Pure date math for repeating tasks
│       ├── spaced-repetition.ts    # SRS algorithm (intervals, grading, card sync)
│       └── task-series.ts     # Materializes repeating task occurrences
data/                          # SQLite DB + daily backups (git-ignored)
drizzle/                       # SQL migrations (schema history)
scripts/                       # Verification + seed + planning scripts
```

---

## 3. Database Schema (Key Tables)

### tasks
```sql
id TEXT PK, title TEXT, description TEXT, priority (P1-P4), categoryId FK,
estimatedMinutes INT, actualMinutes INT, deadline INT (epoch-ms),
reminderAt INT (epoch-ms), repeat (NONE|DAILY|WEEKLY|MONTHLY),
status (TODO|IN_PROGRESS|COMPLETED|SNOOZED), date TEXT (yyyy-MM-dd),
position INT, seriesId TEXT, linkedNoteId TEXT, createdAt INT, updatedAt INT
```

### subtasks
```sql
id TEXT PK, taskId FK (cascade), title TEXT, isCompleted BOOL, position INT
```

### interview_items (unified)
```sql
id TEXT PK, topicType TEXT (DSA|SYSTEM_DESIGN|LLD|CONTEST|custom...),
title TEXT, description TEXT, link TEXT, tags TEXT (JSON array),
status TEXT (PENDING|DONE|REVISION_PENDING|REVISION_1_DONE|REVISION_2_DONE|...),
revisionItemId TEXT FK, linkedTaskId TEXT FK, scheduleRevision BOOL, createdAt INT
```

**Status lifecycle:**
- `PENDING` — linked task not yet completed
- `DONE` — completed, no revision requested
- `REVISION_PENDING` — in the queue, awaiting first review
- `REVISION_N_DONE` — N revisions completed (N = totalRevisions on the card)

### revision_items (SRS cards)
```sql
id TEXT PK, noteId TEXT FK (nullable), title TEXT, concept TEXT,
codeSnippet TEXT, currentStepIndex INT (0-6), nextDueDate TEXT (yyyy-MM-dd),
lastRevisedDate TEXT, totalRevisions INT
```

**SRS intervals:** [0, 1, 3, 7, 14, 30, 90] days
**Grading:** AGAIN→stage 1, HARD→hold, GOOD→+1, EASY→+2, all clamped at 6

### notes (journal)
```sql
id TEXT PK, title TEXT, content TEXT, type (CONCEPT|INTERVIEW_QUESTION|CODE_SNIPPET|MISTAKE|GENERAL),
categoryId FK, isFavorite BOOL, revisionScheduled BOOL, createdAt INT, updatedAt INT
```

### reflections
```sql
id TEXT PK, date TEXT UNIQUE, tasksCompletedCount INT, hoursStudied REAL,
problemsSolvedCount INT, learnedSummary TEXT, struggledSummary TEXT,
mood INT (1-5), gratitude TEXT
```

### study_sessions
```sql
id TEXT PK, date TEXT, minutes INT, categoryId FK, taskId FK (nullable), note TEXT
```

### settings (key-value)
```sql
key TEXT PK, value TEXT
```

### search_index (FTS5)
```sql
entity_type TEXT, entity_id TEXT, searchable_text TEXT
-- Tokenizer: porter unicode61
-- Kept in sync via triggers on INSERT/UPDATE/DELETE of source tables
```

### task_rollovers (log)
```sql
id INTEGER PK AUTOINCREMENT, task_id TEXT, from_date TEXT, to_date TEXT, rolled_at INT
```

---

## 4. Key Business Logic

### 4.1 Focus Timer
- **Provider:** `useFocusTimer.tsx` wraps the entire app
- **State:** persisted to `localStorage` key `splanner.focus`
- **Elapsed time:** derived from wall-clock (`accumulatedMs + (now - runningSince)`), NOT stored
- **Modes:** Stopwatch (no duration, counts up) or Timer (has `timerDurationMs`, counts down, auto-stops at 0)
- **Start without a task:** creates a general session; on stop, the journal sheet asks for a task name and creates one retroactively
- **Stop flow:** time is committed FIRST (task update + study session), THEN the journal sheet appears. Dismissing the sheet never loses tracked time.
- **Threshold:** journal prompt only appears for sessions ≥ 10 minutes (untitled sessions always prompt)
- **PiP:** Document Picture-in-Picture window opened on start (via user gesture). Chromium-only; `useOptionalPictureInPicture` returns a no-op elsewhere.

### 4.2 Interview Prep ↔ Task Linking
- When creating a task with "Also add to Interview Prep" checked, the server creates the interview item with `linkedTaskId` set and status `PENDING`
- When the task is marked `COMPLETED` → `activateLinkedInterviewItems()` runs:
  - Flips status from `PENDING` → `REVISION_PENDING`
  - Creates a revision card with `nextDueDate = tomorrow` (day 1 of SRS)
- If no linked task (e.g. logging something already done), the card is created immediately

### 4.3 Day Rollover
- **Flag:** `lastRolloverDate` in settings KV table
- **Trigger:** checked on EVERY API request via middleware + at server boot
- **Logic:** if `lastRolloverDate < today`, move all TODO/IN_PROGRESS tasks with `date < today` and `seriesId IS NULL` to today
- **Preserves:** actualMinutes, subtasks, tags, deadline, reminder — everything
- **Does NOT move:** COMPLETED, SNOOZED, or tasks in a repeating series
- **Logs:** each move to `task_rollovers` table for Stats visibility

### 4.4 Repeating Tasks
- Occurrences are MATERIALIZED as real rows sharing a `seriesId`
- Generated at task creation + topped up at boot (`topUpAllSeries`)
- Horizon: 60 days ahead
- Each occurrence gets its own subtasks (copied, unchecked), tags, deadline/reminder shifted to its own date
- `scope=future` delete preserves completed occurrences
- Month-end clamping: Jan 31 + 1 month = Feb 28 (not Mar 3)

### 4.5 FTS5 Search
- Self-healing at boot (`ensureSearchIndex`): detects contentless table, drift, missing table
- Triggers on 7 entity types: TASK, NOTE, REVISION, DSA, SYSTEM_DESIGN, LLD, HR
- Query escaping: `buildMatchQuery()` splits on non-word chars, wraps each token in double quotes, appends `*` to last token for prefix search
- Results join back to source tables for title/meta (not stored in the FTS table)

### 4.6 Settings
- Stored as TEXT in a KV table
- Client reads via `readSetting(settings, key)` which coerces by the default's type
- **Backfill:** on every boot, any missing keys are INSERT-ed with their defaults (existing values never overwritten)
- **Complex settings stored as JSON strings:** `interviewTopics`, `interviewTargets`, `noteTypes`, `lifeGoals`, `dob`, `lifeExpectedYears`

### 4.7 Notifications / Reminders
- Polled every 30 seconds by `useReminders`
- Fires in-app toasts + OS `Notification` (if permission granted)
- Gated by settings: `taskReminders`, `revisionReminders`, `reflectionReminder`, `notificationsEnabled`
- Deduped via `localStorage` key `splanner.firedReminders` (pruned to 7 days)
- OS notification permission requested on first load if `notificationsEnabled` is true

### 4.8 Appearance
- CSS: `:root` = dark theme, `.light` = light overrides
- `useAppearance` toggles `.light` class on `<html>` based on `darkMode` setting (system/light/dark)
- Font scale: 100% / 112.5% / 125% on `document.documentElement.style.fontSize`

---

## 5. API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | Health check |
| GET/POST/PUT/DELETE | /api/tasks | Tasks CRUD + series generation |
| GET/POST/PUT/DELETE | /api/tasks/:id/subtasks | Subtask CRUD |
| POST | /api/tasks/:id (with `addToInterviewPrep`) | Creates linked interview item |
| GET/POST/PUT/DELETE | /api/notes | Journal notes (list includes tags) |
| GET | /api/notes/count-by-type | Note counts per type |
| GET/POST | /api/revisions | SRS cards |
| POST | /api/revisions/:id/grade | Grade a card (AGAIN/HARD/GOOD/EASY) |
| GET/POST/PUT/DELETE | /api/interview-items | Unified interview prep |
| POST | /api/interview-items/:id/revise | Grade an interview item's card |
| GET | /api/interview-items/stats/summary | Per-topic counts |
| GET/POST | /api/reflections | Daily reflections (upsert by date) |
| GET/POST/PUT/DELETE | /api/study-sessions | Focus time logs |
| GET/PUT | /api/settings | KV settings |
| GET/POST/PUT/DELETE | /api/categories | Task categories |
| GET | /api/search?q= | FTS5 full-text search |
| GET | /api/search/status | Index health |
| POST | /api/search/reindex | Force reindex |
| GET | /api/backup/export | JSON backup download |
| POST | /api/backup/import?mode=replace|merge | Restore from JSON |

---

## 6. Input Validation

- `POST /tasks` — requires non-empty `title` AND `date` (returns 400 otherwise)
- `POST /interview-items` — requires non-empty `title` AND `topicType`
- `POST /reflections` — requires `date`
- `PUT /tasks` — uses `buildTaskPatch()` whitelist; `categoryId: ''` → NULL (FK safety)
- `PUT /notes` — uses FIELDS whitelist; unknown keys dropped
- `PUT /reflections` — uses FIELDS whitelist

---

## 7. CORS & Proxy

- CORS: `origin: '*'` (local-only app, no auth)
- Vite proxies `/api/*` to `http://127.0.0.1:3001` so the browser talks to one origin
- Vite binds `localhost` (IPv6); API binds `127.0.0.1` (IPv4 only)

---

## 8. Styling Conventions

- **Theme:** Deep navy oklch dark theme in `:root`, light overrides in `.light`
- **Color tokens:** `--surface`, `--surface-2`, `--surface-3` for layered backgrounds
- **Event colors:** `--ev-red`, `--ev-orange`, `--ev-yellow`, `--ev-green`, `--ev-teal`, `--ev-blue`, `--ev-purple`, `--ev-pink`
- **Gradient:** `--grad-selected` for active states (buttons, pills, tabs)
- **Font sizes:** mostly `text-[Npx]` (e.g. `text-[12.5px]`, `text-[11px]`)
- **Animations:** Motion (framer-motion) with spring transitions (`stiffness: 420-480, damping: 32-36`)
- **Icons:** Lucide React, 18px stroke-2 in the sidebar rail

---

## 9. Key Patterns & Conventions

1. **Pure logic files** (`src/client/lib/`) are testable without DOM — they export functions, not components
2. **Hooks with providers** (`useFocusTimer`, `useCommandPalette`, `usePictureInPicture`) use React Context
3. **Fire-and-forget API calls** for non-critical side effects (interview item creation alongside tasks)
4. **Sticky submit bars** on long forms so the save button stays reachable
5. **`useOptionalX` pattern** for providers that are enhancements, not requirements (PiP)
6. **Settings as JSON strings** for complex structures (arrays, objects) stored in the TEXT KV table
7. **Topics are dynamic** — read from `interviewTopics` setting; if empty, fall back to `['DSA', 'SYSTEM_DESIGN', 'LLD']`
8. **Note types are dynamic** — read from `noteTypes` setting; if empty, fall back to defaults
9. **Boot-time reconciliation** — seed, migrate, search index, rollover, series top-up all run idempotently at startup

---

## 10. Known Limitations & Edge Cases

- **No auth** — anyone on localhost can access it
- **Document PiP** — Chromium-only; `useOptionalPictureInPicture` returns no-op elsewhere
- **Bundle size** — 650KB JS (no code splitting yet)
- **TypeScript config** — `npx tsc --noEmit` fails due to TS5102 (baseUrl removed in TS 7); use `npx vite build` for type checking
- **Heredocs in execute_bash** — fail silently; always write a script file instead
- **Vite binds IPv6** — use `http://localhost:5174` not `http://127.0.0.1:5174` for browser tools
- **FTS5 contentless bug** — was fixed; `ensureSearchIndex` auto-rebuilds if detected
- **Blind-spread in PUT routes** — was a recurring bug class; all routes now use explicit FIELD whitelists
- **Inline Python with curl** — tends to time out in the shell; write a `.py` file and run it instead

---

## 11. Testing / Verification

All verification scripts are in `scripts/` and run via `npx tsx` or `python3`:

| Script | What it tests |
|--------|---------------|
| `verify-srs.py` | Spaced repetition algorithm |
| `verify-interview.py` | Interview items CRUD (legacy) |
| `verify-focus.ts` | Timer math + task/session commit |
| `verify-stats.ts` | Readiness score + streak math |
| `verify-stats-live.ts` | Stats against live API |
| `verify-stats-render.tsx` | Stats page SSR render |
| `verify-settings-reflection.tsx` | Settings, reflection, week-start grid |
| `verify-palette.tsx` | FTS5 escaping + palette render |
| `verify-fts-selfheal.py` | Index recovery from 4 broken states |
| `verify-recurrence.tsx` | Recurring tasks + subtask copying |
| `verify-journal.tsx` | Journal flow + PiP degradation |
| `final-check.py` | Full API smoke test (36 checks) |
| `test-revision-lifecycle.py` | Interview item revision lifecycle |
| `test-rollover.py` | Day rollover mechanism |
| `test-activation.py` | Task completion → interview activation |

---

## 12. Startup Sequence (server)

```
1. seedDatabase()          — categories + settings backfill
2. migrateInterviewItems() — legacy table migration + column adds
3. ensureSearchIndex()     — FTS5 table creation / rebuild / drift fix
4. checkAndRollover()      — move past-due tasks to today
5. topUpAllSeries()        — extend repeating task horizons
6. performAutoBackup()     — VACUUM INTO daily snapshot
```

Plus: every request hits the rollover middleware (one settings read, fast no-op if already done today).

---

## 13. How to Add a New Feature

1. **Schema:** Add to `src/server/db/schema.ts`. If adding a column to an existing table, also add an `ALTER TABLE` try/catch in the relevant migrate file.
2. **Route:** Create in `src/server/routes/`. Use FIELD whitelists for PUT. Register in `src/server/index.ts`.
3. **API client:** Add to `src/client/api/client.ts`.
4. **Hook:** Create in `src/client/hooks/`. Use TanStack Query with proper cache keys.
5. **Page/Component:** Create the UI. Use existing primitives from `components/ui/`.
6. **Settings:** Add to `DEFAULTS` in `src/client/lib/settings.ts` AND to `DEFAULT_SETTINGS` in `src/server/db/seed.ts` (they must stay in sync). The backfill mechanism handles existing databases.
7. **Verify:** Write a script in `scripts/` — assertion-based, no test framework needed.

---

## 14. Data Flow Examples

### Adding a task with Interview Prep:
```
User clicks "Create task" with "Also add to Interview Prep" checked
→ POST /tasks { title, date, tags, addToInterviewPrep: true, interviewTopic: "DSA" }
→ Server creates task row
→ Server creates interview_items row with linkedTaskId, status: PENDING, scheduleRevision: true
→ No revision card yet

User marks task COMPLETED
→ PUT /tasks/:id { status: "COMPLETED" }
→ activateLinkedInterviewItems(taskId) fires
→ Interview item: PENDING → REVISION_PENDING
→ Revision card created with nextDueDate = tomorrow
→ Card appears in Revise tab next day
```

### Focus session flow:
```
User clicks Stopwatch (no task)
→ start() called with no args → session.taskId = null
→ PiP window opens (if setting enabled + Chromium)
→ Title bar shows "00:45 · Stopwatch"

User clicks Stop
→ studySession created with taskId: null
→ Journal sheet appears (always for untitled sessions)
→ User types task name + checks "Also add to Interview Prep"
→ Task created with actualMinutes = session length
→ studySession re-pointed to the new task
→ Interview item created linked to the task (PENDING)
```

---

## 15. Environment

- Node 26.x, pnpm 10.x
- macOS (darwin, zsh)
- better-sqlite3 13.x (FTS5 confirmed)
- Drizzle ORM 0.45.x
- React 19, Vite 8, Tailwind v4, Motion 13, TanStack Query 5
