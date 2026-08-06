# Smart Planner — Requirements

#[[file:../../../../../../IdeaProjects/Smart Planner/SMART_PLANNER_FEATURES.md]]

## 1. Overview

Smart Planner (Splanner) is a local-first web application for interview preparation and daily planning. It runs on the user's own laptop with no cloud, no accounts, no sync, and no internet dependency. All data resides in a local SQLite database.

This document translates the source feature spec into testable requirements. The source was written against Android — behaviors are restated here for a web implementation.

---

## 2. Out of Scope (§7 Non-Goals)

- Cloud sync / multi-device
- User accounts / authentication
- Collaboration / sharing
- AI-powered features
- Mobile-specific features (notifications timing adapts to desktop equivalents)

---

## 3. Non-Functional Requirements

### NFR-1: Performance & Feel
- All local mutations SHALL be optimistic — no spinners on writes.
- UI interactions SHALL feel instant (<100ms perceived response).
- Reference apps: Linear (dense rows, keyboard-first), Mochi (centered card, reveal-then-grade), Sunsama (daily-plan ritual), Raycast (grouped fuzzy palette), Notion Calendar (muted grid, colored pills).

### NFR-2: Keyboard Layer
- `j`/`k` — navigate lists
- `x` — toggle task complete
- `c` — create new item
- `Cmd+K` — command palette (cross-entity search)
- `1`–`4` — grade revision cards during session
- All interactive elements SHALL be reachable by keyboard.

### NFR-3: Accessibility
- Focus rings, ARIA roles, and keyboard navigation via Radix primitives.
- Color is never the sole indicator of state.

### NFR-4: Theming
- Dark mode as default.
- System / Always Light / Always Dark setting.
- Multiple color palettes switchable via class swap on `<html>`.
- Radix Colors 12-step semantic scale: steps 1–2 backgrounds, 3/4/5 component states, 6/7/8 borders, 9–10 solids, 11–12 text.

### NFR-5: Data Safety
- Automatic `VACUUM INTO data/backups/splanner-YYYY-MM-DD.db` on startup, retaining last 14 days.
- Manual JSON export/import per §5.
- Server binds `127.0.0.1` ONLY — never `0.0.0.0`.

### NFR-6: Navigation
- Five main sections: Home (Dashboard), Planner, Journal, Revise, Stats.
- Secondary screens: Interview Prep, Settings, Search, Notifications, Reflection.
- Detail screens slide in from right; top-level sections cross-fade.

---

## 4. Functional Requirements — Data Foundation

### R1: Local Database
1. WHEN the app starts for the first time THEN create `data/splanner.db` and apply all migrations.
2. WHEN the app starts and the DB exists THEN apply only pending migrations without data loss.
3. SHALL set `journal_mode = WAL` and `busy_timeout` on every connection.
4. SHALL enable foreign key enforcement.
5. Calendar days stored as ISO `yyyy-MM-dd` TEXT; timestamps as epoch-ms INTEGER; enums as TEXT names.
6. All entity IDs are client-generated UUIDs.
7. Server binds `127.0.0.1` only, no authentication (acceptable given loopback binding).

### R2: Categories (§2.1)
1. WHEN database is created THEN seed five categories: Work & Projects (red), DSA & Coding (blue), System Design (purple), Learning & Reading (green), Health & Personal (amber).
2. Users CAN create, rename, recolor, reorder, and delete categories.
3. Each category has: id, name, color (ARGB), iconName, position.

### R3: Tags
1. Tags stored in a junction table (not JSON) for filter-by-tag and autocomplete.
2. Array fields that are never queried individually (`links`, `imageUris`, `keyTradeoffs`) stored as JSON columns.

### R4: Images
1. Image files stored in `data/attachments/` directory.
2. Only file paths stored in database `imageUris` JSON column.

---

## 5. Functional Requirements — Tasks (§2.2, §3.2, §3.3)

### R5: Task Entity
- Fields: id, title, description, priority (P1–P4), categoryId, tags[], estimatedMinutes (default 30), actualMinutes?, deadline?, reminderAt?, repeat (NONE/DAILY/WEEKLY/MONTHLY), attachedNotes, linkedNoteId?, status (TODO/IN_PROGRESS/COMPLETED/SNOOZED), date (yyyy-MM-dd), position, subtasks[], createdAt, updatedAt.
- Added field: `seriesId` (nullable) — links recurrence chain by identity, not title.
- Computed: `isOverdue` = incomplete + deadline in past. `subtaskProgress` = completed/total subtasks.

### R6: Subtasks (§2.3)
- Fields: id, taskId, title, isCompleted, position.

### R7: Planner (§3.2)
- Day/Week/Month views.
- Date navigation, filters (category, priority, hide completed).
- Drag-to-reorder tasks (updates position).
- Toggle completion inline; open task editor; create on selected date.

### R8: Task Editor (§3.3)
- Full CRUD for tasks with all fields.
- Repeating task completion creates next occurrence using `seriesId` match (not title).
- Month-end rollover: Jan 31 + MONTHLY → Feb 28/29 (last day of month).
- Double-completion of same task is idempotent.
- Subtasks cloned with `isCompleted` reset on recurrence.

### R9: Repeating Tasks (§4.1) — Resolved Ambiguities
1. Dedup uses `seriesId + date` (not title). Title edits are harmless.
2. Jan 31 + MONTHLY → last day of target month.
3. Completing an already-completed repeating task is a no-op.
4. Deadline and reminder shift by the same offset to the new date.

---

## 6. Functional Requirements — Notes & Revision (§2.4–§2.6, §3.4–§3.7)

### R10: Notes (§2.4, §3.4, §3.5)
- Fields: id, title, content (markdown), type (CONCEPT/INTERVIEW_QUESTION/CODE_SNIPPET/MISTAKE/GENERAL), categoryId, tags[], codeLanguage?, links[] (JSON), imageUris[] (JSON), isFavorite, revisionScheduled, createdAt, updatedAt.
- List sorted: favorites first, then by updatedAt desc.
- Full-text search across title, content, tags.
- Filters: by type, by tag, favorites-only.

### R11: Note → Revision Card Lifecycle (§4.2) — Resolved Ambiguities
1. When `revisionScheduled = true` on save: auto-create/update revision card linked by noteId.
2. Card title = note title; concept = first 240 chars of content WITH fenced code blocks stripped; codeSnippet = first fenced code block extracted.
3. Editing note updates card display fields but PRESERVES schedule progress (currentStepIndex, nextDueDate, history).
4. Toggling `revisionScheduled` OFF deletes the linked card AND its history permanently. Toggling back ON creates a fresh card at stage 0.

### R12: Revision Items (§2.5, §3.6)
- Fields: id, noteId?, title, concept, codeSnippet?, tags[], currentStepIndex (0–6), nextDueDate, lastRevisedDate?, totalRevisions, history[].
- Overview: due today count, total items, lifetime revisions, mastery breakdown by stage, due list, upcoming list.
- Session: one card at a time, reveal button, grade (AGAIN/HARD/GOOD/EASY), skip, advance.

### R13: Spaced Repetition Algorithm (§3.7) — Resolved Ambiguities
- Interval ladder: [0 (same day), 1, 3, 7, 14, 30, 90] days.
- AGAIN → stage 1 (yes, this moves a stage-0 card forward — confirmed intentional: stage 0 means "brand new today," AGAIN means "try tomorrow").
- HARD → stay at current stage (repeat same interval).
- GOOD → advance +1 stage.
- EASY → advance +2 stages, capped at stage 6.
- At stage 5: EASY → stage 6 (cap). At stage 6: EASY → remains stage 6.
- Mastery = currentStepIndex / 6.

### R14: Revision History (§2.6)
- Fields: id, revisionItemId, date, grade (AGAIN/HARD/GOOD/EASY), intervalDays.

---

## 7. Functional Requirements — Interview Prep (§2.8–§2.11, §3.8)

### R15: DSA Problems (§2.8)
- Fields: id, title, difficulty (EASY/MEDIUM/HARD), platform (LEETCODE/GEEKSFORGEEKS/CODEFORCES/INTERVIEWBIT/OTHER), categoryPattern, timeTakenMinutes, mistakesNotes, solutionSnippet, url, revisionDue, status (SOLVED/ATTEMPTED/TO_REVISE).

### R16: System Design Topics (§2.9)
- Fields: id, title, category (DISTRIBUTED_SYSTEMS/DATABASES/NETWORKING/CACHING/ARCHITECTURE_PATTERNS), notes, keyTradeoffs[] (JSON), isRevised, lastRevised?.

### R17: LLD Designs (§2.10)
- Fields: id, title, pattern (STRATEGY/OBSERVER/FACTORY/DECORATOR/SOLID/SYSTEM_DESIGN), description, codeSnippet, status (IMPLEMENTED/IN_PROGRESS/BACKLOG).

### R18: HR / Behavioural Stories (§2.11)
- Fields: id, title, questionCategory (LEADERSHIP/CONFLICT_RESOLUTION/FAILURE_AND_GROWTH/PROBLEM_SOLVING/BEHAVIORAL), situation, task, action, result, tags[].

---

## 8. Functional Requirements — Analytics & Scoring (§3.9, §4.4)

### R19: Interview Readiness Score — Resolved Defect
- Formula: `score = 100 × Σ(wᵢ × vᵢ) / Σ(wᵢ)` over eligible components.
- A component is eligible when its denominator > 0.
- Weights: DSA 40% (`min(solved/150, 1)`), System Design 20% (`revised/total`), LLD 15% (`implemented/total`), Revisions 15% (`min(totalRevisions/100, 1)`), Consistency 10% (`min(streak/30, 1)`).
- DSA, Revisions, Consistency divide by constants → always eligible.
- Day-one example (no SD, no LLD): renormalizes across 65 → DSA ~61.5%, Revisions ~23%, Consistency ~15.4%.

### R20: Analytics (§3.9)
- Time ranges: 7, 30, 90 days.
- Charts: study minutes/day, completed task minutes/day, time by category.
- Metrics: current streak, longest streak, revision stage distribution, total revisions, DSA solved + by difficulty, note count, SD revised/total, LLD implemented/total.

### R21: Streak Calculation (§4.3) — Resolved Ambiguities
- A "streak day" = calendar day where at least one task was completed OR one study session was logged.
- Streak anchors on today if today qualifies; else on yesterday (early-in-day grace).
- First-ever use: streak = 1 if today qualifies, else 0.
- Midnight boundary is local time (user's system timezone).
- Gaps break the streak.

---

## 9. Functional Requirements — Daily Reflection & Study Sessions (§2.7, §2.12, §3.10)

### R22: Daily Reflection (§2.7, §3.10)
- Fields: id, date (one per day, upsert), tasksCompletedCount, hoursStudied, problemsSolvedCount, learnedSummary, struggledSummary, mood (1–5), gratitude.
- Pre-filled with actual completed task count.

### R23: Study Sessions (§2.12)
- Fields: id, date, minutes, categoryId?, taskId?, note.

---

## 10. Functional Requirements — Search (§3.11)

### R24: Cross-Entity Search
- Uses SQLite FTS5 with SQL triggers for sync.
- Searches: Tasks (title, description, tags), Notes (title, content, tags), Revision Items (title, concept, tags), DSA (title, pattern, mistakesNotes), System Design (title, notes), LLD (title, description), HR Stories (title, situation, result).
- Result types labeled: TASK, NOTE, REVISION, DSA, SYSTEM_DESIGN, LLD, HR.
- Clicking a result navigates to the appropriate editor/screen.
- Search is instant and local.

---

## 11. Functional Requirements — Notifications (§2.13, §3.12, §3.14)

### R25: Notifications — Platform Translation
- §3.12's "survives reboot," "exact alarms," and periodic 6-hour overdue sweep do NOT apply in web delivery.
- Replacement behavior:
  - Overdue counts, revision-due badges, and reflection prompt compute ON APP LOAD and render as persistent UI badges.
  - If tab is open, browser Notifications API fires for task reminders and hydration nudges.
  - Silent hours (10 PM–8 AM) respected for hydration nudges.
  - Evening reflection prompt at 9 PM (configurable) if tab is open and reflection not written.
- Notification table (§2.13) and all trigger logic built exactly as specified so a background scheduler can later drop in as a transport change.
- In-app notification center: scrollable list (newest first, limit 60), unread badge, mark read, mark all read, delete.

---

## 12. Functional Requirements — Settings (§3.13)

### R26: Settings
- User name (dashboard greeting).
- Theme palette selection.
- Dark mode: System / Always Light / Always Dark.
- Font scale: Default, Large, Extra Large.
- Daily study goal (hours/day, default 4).
- Notification toggles (master, task reminders, revision, water/break, reflection, weekly planning, monthly review).
- Export backup (JSON), Import backup (replace or merge), Restore default categories, Clear all data (destructive — requires confirmation).

---

## 13. Functional Requirements — Dashboard (§3.1)

### R27: Dashboard
- Greeting with user name.
- Daily quote (deterministic per date from built-in bank of 12 quotes, rotates at local midnight).
- Today's progress: completed/total tasks (progress bar).
- Current task: in-progress or next unfinished.
- Upcoming tasks for today.
- Streak (consecutive qualifying days).
- Study progress: minutes today vs daily goal.
- Revisions due count.
- Overdue task count.
- Reflection status (written or not).
- Actions: toggle completion, start task, open editor, navigate to planner/revision/reflection.
