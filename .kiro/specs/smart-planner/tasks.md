# Smart Planner — Implementation Tasks

Ordered for incremental delivery. Each task builds on the previous. No task should be started until its dependencies are complete.

---

## Phase 1: Foundation

### Task 1: Project Scaffold
- [ ] Initialize pnpm project with `package.json`
- [ ] Configure TypeScript (`tsconfig.json` for server + client)
- [ ] Set up Vite with React 19
- [ ] Set up Hono server entry point binding `127.0.0.1:3001`
- [ ] Configure concurrent dev scripts (Vite + Hono dev server)
- [ ] Add `.env` with `DB_FILE_NAME=data/splanner.db`
- [ ] Add `.gitignore` (data/, node_modules/, dist/)
- [ ] Verify: `pnpm dev` starts both server and client without errors

### Task 2: Tailwind v4 + Theme + App Shell
- [ ] Install Tailwind CSS v4 and configure with Vite
- [ ] Define Radix Colors 12-step tokens as CSS variables (dark + light)
- [ ] Implement theme palette switcher (class swap on `<html>`)
- [ ] Implement dark/light/system mode toggle
- [ ] Set up Inter/Geist font + JetBrains Mono for code
- [ ] Build app shell: collapsible sidebar + main content area
- [ ] Add five main nav items (Home, Planner, Journal, Revise, Stats) + secondary items (Interview Prep, Settings, Search, Notifications, Reflection)
- [ ] Add client-side routing (React Router or TanStack Router)
- [ ] Add `AnimatePresence` route transitions (slide-in for detail, cross-fade for top-level)
- [ ] Verify: app loads with themed sidebar, navigation works between empty pages

### Task 3: Install + Configure shadcn/ui
- [ ] Initialize shadcn/ui with Radix primitives
- [ ] Add core components: Button, Input, Select, Checkbox, Dialog, Sheet, Popover, Command, Calendar, Progress, Badge, Card, Tabs, Tooltip, DropdownMenu, ScrollArea, Separator
- [ ] Verify: components render correctly in dark/light modes with focus rings

---

## Phase 2: Database & API Layer

### Task 4: Drizzle Schema — All 13 Entities
- [ ] Install Drizzle ORM + better-sqlite3 + drizzle-kit
- [ ] Create `src/server/db/connection.ts` (WAL mode, busy_timeout, foreign keys)
- [ ] Define schema for all tables: categories, tasks, subtasks, notes, revision_items, revision_history, reflections, dsa_problems, system_design, lld_designs, hr_stories, study_sessions, notifications
- [ ] Define junction tables: task_tags, note_tags, revision_item_tags, dsa_problem_tags, hr_story_tags
- [ ] Create `drizzle.config.ts`
- [ ] Generate and apply initial migration (`drizzle/0000_initial.sql`)
- [ ] Verify: database creates with all tables, foreign keys enforced

### Task 5: FTS5 Virtual Table + Triggers
- [ ] Hand-write migration `drizzle/0001_fts5.sql`
- [ ] Create FTS5 virtual table `search_index(entity_type, entity_id, searchable_text)`
- [ ] Write INSERT/UPDATE/DELETE triggers for: tasks, notes, revision_items, dsa_problems, system_design, lld_designs, hr_stories
- [ ] Apply migration
- [ ] Verify: inserting a task populates search_index; MATCH query returns results

### Task 6: Category Seed + Settings Store
- [ ] Create `src/server/db/seed.ts` — seed 5 default categories on first run
- [ ] Create settings table (key-value store for user preferences)
- [ ] Seed default settings (userName, theme, darkMode, dailyStudyGoal, notification toggles)
- [ ] Verify: first run seeds categories and settings; second run is idempotent

### Task 7: Backup Service
- [ ] Implement `VACUUM INTO data/backups/splanner-YYYY-MM-DD.db` on server start
- [ ] Implement cleanup: retain last 14 backup files, delete older
- [ ] Implement JSON export endpoint (serialize all tables)
- [ ] Implement JSON import endpoint (replace or merge by ID)
- [ ] Verify: backups created on start, export/import roundtrips data correctly

### Task 8: Hono API — All Route Groups
- [ ] Create route files for all 15 route groups (tasks, subtasks, notes, revisions, revision-history, dsa, system-design, lld, hr-stories, study-sessions, reflections, categories, notifications, search, analytics, settings, backup)
- [ ] Implement CRUD for each entity
- [ ] Implement special endpoints: tasks list-by-date-range, revisions due-today, revisions grade, analytics computed-stats, search FTS5-query
- [ ] Wire all routes into main Hono app
- [ ] Verify: all CRUD endpoints respond correctly via curl/Postman

### Task 9: TanStack Query + Hono RPC Client
- [ ] Set up Hono RPC client in `src/client/api/client.ts`
- [ ] Create TanStack Query hooks for each entity (useQuery, useMutation with optimistic updates)
- [ ] Configure QueryClient with appropriate staleTime/cacheTime for local-first
- [ ] Verify: client can fetch/create/update/delete tasks with optimistic UI

---

## Phase 3: Core Screens

### Task 10: Task Editor + Planner
- [ ] Build TaskEditor component (all fields: title, description, priority, category, tags, estimated min, deadline, reminder, repeat, attached notes, subtask list)
- [ ] Build Planner page with Day view (date picker, task list for selected date)
- [ ] Implement Week view (7-day spread)
- [ ] Implement Month view (calendar grid with task counts)
- [ ] Implement filters: category, priority, hide completed
- [ ] Implement drag-to-reorder (Motion layoutId)
- [ ] Implement toggle completion inline
- [ ] Implement repeating task logic (seriesId, next occurrence creation)
- [ ] Verify: can create/edit/complete/reorder tasks; repeating tasks generate next occurrence

### Task 11: Dashboard
- [ ] Build Dashboard page
- [ ] Greeting with user name + daily quote (deterministic per date, 12 quotes)
- [ ] Today's progress bar (completed/total tasks)
- [ ] Current task (in-progress or next unfinished)
- [ ] Upcoming tasks list
- [ ] Streak counter (consecutive qualifying days)
- [ ] Study progress (minutes today vs daily goal)
- [ ] Revisions due badge
- [ ] Overdue count badge
- [ ] Reflection status (written/not)
- [ ] Action buttons: toggle completion, start task, navigate
- [ ] Verify: dashboard shows accurate live data, actions work

### Task 12: Journal + Note Editor
- [ ] Build Journal page (list view: favorites first, then by updatedAt)
- [ ] Implement search across title/content/tags
- [ ] Implement filters: by type, by tag, favorites-only
- [ ] Build NoteEditor component (title, markdown content with preview toggle, type, category, tags, code language, links, images, favorite toggle, revision scheduled toggle)
- [ ] Implement markdown preview mode
- [ ] Implement note → revision card lifecycle (auto-create/update/delete linked card)
- [ ] Verify: can create/edit/search/filter notes; revision cards auto-managed

### Task 13: Revision System
- [ ] Build Revise overview page (due count, total items, lifetime revisions, mastery breakdown, due list, upcoming list)
- [ ] Build revision session flow (one card at a time, reveal, grade 1–4 keys, skip)
- [ ] Implement spaced repetition algorithm (interval ladder, grade effects, stage caps)
- [ ] Record revision history entries on grade
- [ ] Build mastery progress indicator per card
- [ ] Verify: can start session, grade cards, verify correct next due date calculation

---

## Phase 4: Interview Prep + Analytics

### Task 14: Interview Prep — DSA Tab
- [ ] Build DSA tab (list, filter by difficulty, solved counts, pattern distribution, avg solve time, revision due list)
- [ ] Build DSA editor (all fields)
- [ ] Verify: CRUD works, stats compute correctly

### Task 15: Interview Prep — System Design Tab
- [ ] Build System Design tab (list, revised count, create/edit/delete)
- [ ] Build editor (title, category, notes in page body, key tradeoffs, is-revised toggle, last revised date)
- [ ] Verify: CRUD works, revised count accurate

### Task 16: Interview Prep — LLD Tab
- [ ] Build LLD tab (list, implemented count, create/edit/delete)
- [ ] Build editor (title, pattern, description, code snippet, status)
- [ ] Verify: CRUD works, implemented count accurate

### Task 17: Interview Prep — HR/Behavioural Tab
- [ ] Build HR tab (list, total count, create/edit/delete)
- [ ] Build editor (title, question category, STAR fields, tags)
- [ ] Verify: CRUD works

### Task 18: Analytics + Readiness Score
- [ ] Build Stats page with time range selector (7/30/90 days)
- [ ] Implement charts: study minutes/day, completed task minutes/day, time by category (using native chart library — Recharts or similar)
- [ ] Display: current streak, longest streak, revision stage distribution, totals
- [ ] Implement Interview Readiness Score with renormalization formula
- [ ] Display score with breakdown by component
- [ ] Verify: charts render with real data, score computes correctly including day-one case

### Task 19: Daily Reflection
- [ ] Build Reflection page/modal (all fields)
- [ ] Implement upsert by date
- [ ] Pre-fill tasksCompletedCount from actual data
- [ ] Verify: one reflection per day, pre-fill works, data persists

---

## Phase 5: Search, Notifications, Settings, Polish

### Task 20: Command Palette (Search)
- [ ] Build Cmd+K command palette (using shadcn Command component)
- [ ] Implement FTS5 search across all 7 entity types
- [ ] Group results by type (TASK, NOTE, REVISION, DSA, SYSTEM_DESIGN, LLD, HR)
- [ ] Navigate to appropriate editor/screen on result click
- [ ] Verify: search is instant, results grouped and navigable

### Task 21: Notifications
- [ ] Build notification center (sidebar badge + scrollable list, limit 60)
- [ ] Implement on-load computation: overdue count, revision due, reflection status
- [ ] Implement browser Notification API (permission request, task reminders, hydration nudges)
- [ ] Implement silent hours (10 PM–8 AM)
- [ ] Implement mark read, mark all read, delete
- [ ] Verify: badges show correct counts, browser notifications fire when tab open

### Task 22: Settings
- [ ] Build Settings page with all sections
- [ ] User name, theme palette, dark mode, font scale
- [ ] Daily study goal
- [ ] Notification toggles
- [ ] Export/Import buttons (trigger backup API)
- [ ] Restore default categories, Clear all data (with confirmation dialog)
- [ ] Verify: all settings persist and take effect immediately

### Task 23: Keyboard Layer
- [ ] Implement `j`/`k` list navigation on all list views
- [ ] Implement `x` toggle complete on focused task
- [ ] Implement `c` create new item (context-aware by current page)
- [ ] Implement `Cmd+K` command palette trigger
- [ ] Implement `1`–`4` grade keys during revision session
- [ ] Implement `Escape` to close dialogs/sheets
- [ ] Verify: all keyboard shortcuts work without conflicting with text input

### Task 24: Motion & Polish Pass
- [ ] Route transitions: slide-in from right for detail, cross-fade for top-level
- [ ] Task completion animation (scale + opacity)
- [ ] Drag reorder animation (layoutId)
- [ ] Revision card reveal animation
- [ ] Loading states: skeleton components (not spinners)
- [ ] Empty states: illustrated placeholders for each section
- [ ] Responsive: ensure usable at 1024px minimum width
- [ ] Verify: all animations feel smooth (150ms micro, 250ms page), no layout shift
