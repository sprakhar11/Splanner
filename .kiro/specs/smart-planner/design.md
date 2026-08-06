# Smart Planner — Design

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React 19)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Dashboard │  │ Planner  │  │ Journal  │  │ Revise │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │  Stats   │  │ Settings │  │  Search  │  │Interview│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│                                                          │
│  TanStack Query (optimistic mutations, cache)            │
│  Hono RPC Client (end-to-end typed)                      │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTP (localhost:3001)
┌──────────────────────┴───────────────────────────────────┐
│                  Hono Server (Node.js)                     │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              Drizzle ORM (typed schema)              │ │
│  └──────────────────────┬──────────────────────────────┘ │
│                         │                                 │
│  ┌──────────────────────┴──────────────────────────────┐ │
│  │         better-sqlite3 (WAL mode, FTS5)             │ │
│  │              data/splanner.db                        │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                           │
│  Backup engine: VACUUM INTO data/backups/                 │
│  Static file server: data/attachments/                    │
└───────────────────────────────────────────────────────────┘
```

### Key Decisions
- **Vite + React 19** — instant HMR, no RSC caching to fight for a local tool.
- **Hono** (not Express) — RPC client gives end-to-end types with no codegen.
- **TanStack Query v5** — delivers "everything is reactive" with optimistic updates.
- **better-sqlite3 v13** — synchronous, fastest, FTS5 + JSON1 bundled. Requires Node ≥22.
- **Drizzle ORM** — native SQLite support, typed schema, handles migrations.
- **Server binds 127.0.0.1:3001** — single-user, no auth, loopback-only.

---

## 2. Tech Stack (versions verified)

| Layer | Package | Version | Purpose |
|-------|---------|---------|---------|
| Bundler | Vite | latest | Dev server + build |
| UI Framework | React | 19.x | Component model |
| Styling | Tailwind CSS | 4.x | Utility-first, CSS-variable theming |
| Components | shadcn/ui + Radix | latest | Accessible primitives, ARIA, focus rings |
| Animation | Motion | 12.x | layoutId, AnimatePresence for transitions |
| Data Fetching | TanStack Query | 5.x | Cache, optimistic updates, reactivity |
| API Client | Hono RPC Client | latest | Typed client from route definitions |
| Server | Hono | latest | Lightweight HTTP framework |
| ORM | Drizzle ORM | latest | Schema, migrations, typed queries |
| Database | better-sqlite3 | 13.x | SQLite with FTS5, JSON1, WAL |
| Package Manager | pnpm | latest | Fast, disk-efficient |
| Font | Inter / Geist | — | UI text |
| Mono Font | JetBrains Mono | — | Code snippets |

---

## 3. Data Model

### 3.1 Schema Design Principles
- IDs: UUID v4 strings, client-generated.
- Timestamps: epoch-ms INTEGER.
- Dates: ISO `yyyy-MM-dd` TEXT.
- Enums: TEXT with CHECK constraints.
- Tags: junction table (`entity_tags`) for queryable filtering + autocomplete.
- Arrays never queried individually: JSON TEXT columns (`links`, `imageUris`, `keyTradeoffs`).
- FTS5 virtual tables: hand-written migration with SQL triggers (Drizzle doesn't model virtual tables).

### 3.2 Tables

```
categories (id, name, color, iconName, position)

tasks (id, title, description, priority, categoryId, estimatedMinutes,
       actualMinutes, deadline, reminderAt, repeat, attachedNotes,
       linkedNoteId, status, date, position, seriesId, createdAt, updatedAt)

subtasks (id, taskId, title, isCompleted, position)

notes (id, title, content, type, categoryId, codeLanguage,
       links, imageUris, isFavorite, revisionScheduled, createdAt, updatedAt)

revision_items (id, noteId, title, concept, codeSnippet, currentStepIndex,
               nextDueDate, lastRevisedDate, totalRevisions)

revision_history (id, revisionItemId, date, grade, intervalDays)

reflections (id, date, tasksCompletedCount, hoursStudied, problemsSolvedCount,
            learnedSummary, struggledSummary, mood, gratitude)

dsa_problems (id, title, difficulty, platform, categoryPattern,
             timeTakenMinutes, mistakesNotes, solutionSnippet, url,
             revisionDue, status)

system_design (id, title, category, notes, keyTradeoffs, isRevised, lastRevised)

lld_designs (id, title, pattern, description, codeSnippet, status)

hr_stories (id, title, questionCategory, situation, task, action, result)

study_sessions (id, date, minutes, categoryId, taskId, note)

notifications (id, title, body, type, taskId, revisionItemId, timestamp, isRead)

-- Junction tables
task_tags (taskId, tag)
note_tags (noteId, tag)
revision_item_tags (revisionItemId, tag)
dsa_problem_tags (dsaProblemId, tag)  -- categoryPattern used as primary, tags for extra
hr_story_tags (hrStoryId, tag)

-- FTS5 virtual table
search_index (entity_type, entity_id, searchable_text)
```

### 3.3 FTS5 Strategy
- Single virtual table `search_index` with columns: `entity_type`, `entity_id`, `searchable_text`.
- SQL triggers on INSERT/UPDATE/DELETE for each searchable entity keep it in sync.
- Query: `SELECT * FROM search_index WHERE searchable_text MATCH ? ORDER BY rank`.
- Covers 7 entity types: TASK, NOTE, REVISION, DSA, SYSTEM_DESIGN, LLD, HR.

---

## 4. API Design

### 4.1 Hono RPC Pattern
```typescript
// server: src/server/routes/tasks.ts
const tasksRoute = new Hono()
  .get('/', async (c) => { /* list tasks */ })
  .get('/:id', async (c) => { /* get task */ })
  .post('/', async (c) => { /* create task */ })
  .put('/:id', async (c) => { /* update task */ })
  .delete('/:id', async (c) => { /* delete task */ })

// client: auto-typed via hc<typeof tasksRoute>
```

### 4.2 Route Groups
- `/api/tasks` — CRUD + list by date range
- `/api/subtasks` — CRUD scoped to task
- `/api/notes` — CRUD + search
- `/api/revisions` — CRUD + due today + grade
- `/api/revision-history` — list by item
- `/api/dsa` — CRUD + stats
- `/api/system-design` — CRUD
- `/api/lld` — CRUD
- `/api/hr-stories` — CRUD
- `/api/study-sessions` — CRUD + stats by range
- `/api/reflections` — CRUD (upsert by date)
- `/api/categories` — CRUD + reorder
- `/api/notifications` — list + mark read + delete
- `/api/search` — FTS5 query
- `/api/analytics` — computed stats by range
- `/api/settings` — get/put user preferences
- `/api/backup` — export JSON / import JSON

---

## 5. UI/UX Design

### 5.1 Layout Structure
```
┌─────────────────────────────────────────────────┐
│ Sidebar (collapsible)  │  Main Content Area      │
│                        │                         │
│ • Home                 │  [Page content with     │
│ • Planner              │   AnimatePresence for   │
│ • Journal              │   route transitions]    │
│ • Revise               │                         │
│ • Stats                │                         │
│ ─────────────────────  │                         │
│ • Interview Prep       │                         │
│ • Settings             │                         │
│ ─────────────────────  │                         │
│ • Search (Cmd+K)       │                         │
│ • Notifications        │                         │
└─────────────────────────────────────────────────┘
```

### 5.2 Design Tokens (Radix Colors mapped to Tailwind v4)
```css
/* Example: Blue palette mapped */
--color-bg-app: var(--blue-1);
--color-bg-subtle: var(--blue-2);
--color-bg-component: var(--blue-3);
--color-bg-hover: var(--blue-4);
--color-bg-active: var(--blue-5);
--color-border-subtle: var(--blue-6);
--color-border-interactive: var(--blue-7);
--color-border-focus: var(--blue-8);
--color-solid: var(--blue-9);
--color-solid-hover: var(--blue-10);
--color-text-low: var(--blue-11);
--color-text-high: var(--blue-12);
```

### 5.3 Category Colors
Each of the 5 default categories gets its own Radix color scale:
- Work & Projects → Red
- DSA & Coding → Blue
- System Design → Purple
- Learning & Reading → Green
- Health & Personal → Amber/Yellow

Rendered as colored pills in task/note lists (step 9 solid backgrounds).

### 5.4 Component Patterns
- **Task rows**: ~36px dense, priority pip + category pill + title + deadline chip + estimated/actual time.
- **Priority queue**: Tasks sorted by Score formula descending in default view.
- **Progress bars**: Native `<progress>` styled with Tailwind, colored by threshold.
- **Revision cards**: Centered, generous whitespace, reveal-then-grade, keys 1–4.
- **Command palette**: Cmd+K opens Raycast-style grouped search results.
- **Drag reorder**: Motion `layoutId` for animated position changes.

### 5.5 Animations (Motion v12)
- Route transitions: `AnimatePresence` with slide-in-from-right for detail, cross-fade for top-level.
- List reorder: `layoutId` on each row for smooth position animation.
- Task completion: scale + opacity transition.
- Revision card flip: Y-axis rotate on reveal.
- Duration: 150ms for micro-interactions, 250ms for page transitions.

---

## 6. Backup & Restore

### 6.1 Automatic Binary Backup
- On server start: `VACUUM INTO 'data/backups/splanner-YYYY-MM-DD.db'`.
- Retain last 14 files, delete older ones.
- Atomic — safe even if app crashes mid-session.

### 6.2 Manual JSON Export (§5)
```json
{
  "version": 1,
  "exportedAt": 1722000000000,
  "categories": [...],
  "tasks": [...],
  "subtasks": [...],
  "notes": [...],
  "revisions": [...],
  "revisionHistory": [...],
  "reflections": [...],
  "dsa": [...],
  "systemDesign": [...],
  "lld": [...],
  "hrStories": [...],
  "studySessions": [...]
}
```

### 6.3 Import
- Option to REPLACE all existing data or MERGE (upsert by ID).
- Version field for forward-compatible imports.

---

## 7. Notification Strategy

### 7.1 In-App (always works)
- On load: compute overdue count, revision-due count, reflection status.
- Render as badges in sidebar navigation items.
- Notification center shows history (limit 60, newest first).

### 7.2 Browser Notifications (opportunistic, tab must be open)
- Request permission on first use.
- Task reminders fire at `reminderAt` time via `setTimeout` diff.
- Hydration nudge every 90 minutes (silent 10 PM–8 AM).
- Reflection prompt at 9 PM if not written.
- All notification triggers also write to the notifications table for history.

---

## 8. Project Structure

```
splanner/
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── drizzle.config.ts
├── tsconfig.json
├── .env
├── data/                    # gitignored
│   ├── splanner.db
│   ├── backups/
│   └── attachments/
├── drizzle/                 # migrations
│   ├── 0000_initial.sql
│   └── 0001_fts5.sql       # hand-written FTS5 + triggers
├── src/
│   ├── server/
│   │   ├── index.ts         # Hono app, binds 127.0.0.1:3001
│   │   ├── db/
│   │   │   ├── schema.ts    # Drizzle schema (all tables)
│   │   │   ├── connection.ts # better-sqlite3 + WAL setup
│   │   │   └── seed.ts      # default categories
│   │   ├── routes/
│   │   │   ├── tasks.ts
│   │   │   ├── notes.ts
│   │   │   ├── revisions.ts
│   │   │   ├── dsa.ts
│   │   │   ├── system-design.ts
│   │   │   ├── lld.ts
│   │   │   ├── hr-stories.ts
│   │   │   ├── study-sessions.ts
│   │   │   ├── reflections.ts
│   │   │   ├── categories.ts
│   │   │   ├── notifications.ts
│   │   │   ├── search.ts
│   │   │   ├── analytics.ts
│   │   │   ├── settings.ts
│   │   │   └── backup.ts
│   │   └── services/
│   │       ├── backup.ts     # VACUUM INTO + cleanup
│   │       ├── notifications.ts
│   │       └── spaced-repetition.ts
│   ├── client/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/              # Hono RPC client setup
│   │   │   └── client.ts
│   │   ├── hooks/            # TanStack Query hooks per entity
│   │   ├── components/
│   │   │   ├── ui/           # shadcn/ui components
│   │   │   ├── layout/       # Sidebar, MainContent, CommandPalette
│   │   │   ├── tasks/
│   │   │   ├── notes/
│   │   │   ├── revisions/
│   │   │   ├── interview/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Planner.tsx
│   │   │   ├── Journal.tsx
│   │   │   ├── Revise.tsx
│   │   │   ├── Stats.tsx
│   │   │   ├── InterviewPrep.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── Search.tsx
│   │   │   └── Reflection.tsx
│   │   ├── styles/
│   │   │   ├── globals.css   # Tailwind + Radix color tokens
│   │   │   └── themes/       # palette variants
│   │   └── lib/
│   │       ├── constants.ts  # quotes, intervals, etc.
│   │       └── utils.ts
│   └── shared/
│       └── types.ts          # shared types between client/server
└── .kiro/
    └── specs/
        └── smart-planner/
```
