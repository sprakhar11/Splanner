# Habit Garden — Design

Implements the requirements in `requirements.md`. Decision references (D-n, FR-n)
point back to that document.

---

## 1. Shared day boundary (D-2)

`src/shared/` is aliased as `@shared/*` in both `tsconfig.json` and
`vite.config.ts` but is currently empty. This is its first resident, because the
logical day must mean the same thing on both sides of the wire.

```ts
// src/shared/day.ts

/** yyyy-MM-dd for a Date, in local time. */
export function toISO(d: Date): string

/**
 * The logical day, honouring the configured rollover hour.
 *
 * Before the cutoff the user's previous day has not ended, so the date reads as
 * yesterday. `rolloverHour: 0` is plain wall-clock. Range is clamped to 0–6 to
 * match the setting.
 */
export function logicalToday(rolloverHour: number, now?: Date): string

/** True when `iso` is the logical today. */
export function isLogicalToday(iso: string, rolloverHour: number): boolean

/** Whole days between two yyyy-MM-dd strings. */
export function daysBetween(fromISO: string, toISO: string): number
```

`src/server/services/day-rollover.ts` currently owns a private `rolloverToday()`
that duplicates this. It is refactored to call `logicalToday()` so the two can
never drift. Behaviour is unchanged — the existing rollover tests in
`scripts/test-rollover.py` must still pass.

On the client, habits read `rolloverHour` from `useSettings()` and pass it in.
`lib/date.ts`'s `todayISO()` is left alone; the rest of the app keeps wall-clock
semantics, which is correct for calendar rendering.

---

## 2. Schema

Two tables, following the existing Drizzle conventions in
`src/server/db/schema.ts`.

```ts
export const habits = sqliteTable('habits', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  plantType: text('plant_type').notNull().default('OAK'),
  color: text('color'),                       // an --ev-* token name, nullable
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  position: integer('position').notNull().default(0),
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
})

export const habitLogs = sqliteTable('habit_logs', {
  id: text('id').primaryKey(),
  habitId: text('habit_id').notNull()
    .references(() => habits.id, { onDelete: 'cascade' }),
  date: text('date').notNull(),               // yyyy-MM-dd, logical day
  status: text('status').notNull(),           // COMPLETED | SKIPPED  (D-3)
  createdAt: integer('created_at').notNull().$defaultFn(() => Date.now()),
}, t => ({
  habitDayUnique: uniqueIndex('habit_logs_habit_date_idx').on(t.habitId, t.date),
}))
```

`position` is not in the original idea but costs one column now and avoids a
migration later when the garden wants manual ordering.

### Table creation

The project does not apply Drizzle migrations at runtime — `migrate-interview.ts`
and `ensureRolloverTable()` both use hand-rolled `CREATE TABLE IF NOT EXISTS` at
boot. Habits follow that pattern with `ensureHabitTables()` in
`src/server/db/migrate-habits.ts`, called from `index.ts` after
`migrateInterviewItems()`. This is what makes the feature appear on an existing
database without a manual step.

The unique index is created in the same call:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS habit_logs_habit_date_idx
  ON habit_logs (habit_id, date);
```

### Backup coverage

`exportAsJson()` and `importFromJson()` must include both tables, or restoring a
backup silently drops the entire garden — the exact bug just fixed for
`interview_items`. Export version goes to 3; v1 and v2 files still import, since
every table is read behind a presence check.

---

## 3. Pure logic

```ts
// src/client/lib/habits.ts

export type HabitStatus = 'COMPLETED' | 'SKIPPED'
export type HabitLog = { date: string; status: HabitStatus }

export type Stage = 'SEED' | 'SPROUT' | 'SAPLING' | 'MATURE' | 'BLOOMING'
export type Health = 'THRIVING' | 'WILTED' | 'DYING' | 'DEAD'

export type HabitState = {
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  stage: Stage
  health: Health
  /** Completions needed for the next stage; null at BLOOMING. */
  toNextStage: number | null
  /** Logical today's log, if any. Drives the card's primary control. */
  todayStatus: HabitStatus | null
}

export function computeHabitState(logs: HabitLog[], today: string): HabitState
```

### Thresholds

Single source of truth, exported so the UI can render the ladder without
restating it:

```ts
export const STAGE_THRESHOLDS = [
  { stage: 'SEED',     min: 0  },
  { stage: 'SPROUT',   min: 4  },
  { stage: 'SAPLING',  min: 15 },
  { stage: 'MATURE',   min: 31 },
  { stage: 'BLOOMING', min: 61 },
] as const

export const HEALTH_THRESHOLDS = [
  { health: 'THRIVING', maxGap: 1 },
  { health: 'WILTED',   maxGap: 3 },
  { health: 'DYING',    maxGap: 6 },
  { health: 'DEAD',     maxGap: Infinity },
] as const
```

### Current streak algorithm (D-4)

The subtlety that earns the tests. `computeStreaks` in `lib/streaks.ts` cannot be
reused here: it treats any absent date as a break, so passing only completions
lets a skip break the run, and passing completions plus skips lets a skip inflate
it. Neither is correct.

```
statusByDate = Map<date, status>

cursor = today if today is logged else today - 1
streak  = 0

loop:
  status = statusByDate[cursor]
  if status is COMPLETED  -> streak++,  cursor -= 1 day,  continue
  if status is SKIPPED    ->            cursor -= 1 day,  continue   // bridges
  otherwise               -> stop                                    // no log
```

Starting at yesterday when today is blank mirrors the established rule in
`computeStreaks` — the streak must not appear broken merely because the user
opened the app in the morning.

`longestStreak` scans the date-sorted log list with the same bridging rule and
keeps the maximum run. A skip at the very start or end of a run contributes
nothing.

`health` is derived from the gap between `today` and the most recent log of
**either** status, so a skip protects health as well as the streak. That is the
point of a sick day. A habit with no logs at all returns `THRIVING` (FR-3) rather
than falling through to `DEAD`.

### Heatmap feed

`heatmapWeeks(activity: Map<string, number>, today, weeks)` is reused as-is
(FR-5). For a binary habit the generic `intensity()` bucketing is wrong, so values
are mapped directly: `COMPLETED → 4`, `SKIPPED → 2`, absent → `0`. The existing
renderer already treats the value as a bucket index.

---

## 4. API

`src/server/routes/habits.ts`, mounted at `/api/habits` in `index.ts`.

| Method | Path | Behaviour |
|---|---|---|
| `GET` | `/api/habits` | Unarchived habits, each with its **full** log history (D-5). `?includeArchived=true` to widen. |
| `POST` | `/api/habits` | Create. `title` required; `plantType` defaults to `OAK`. |
| `PUT` | `/api/habits/:id` | Update title, plantType, color, position, archived. |
| `POST` | `/api/habits/:id/log` | Body `{ date, status }`. `status: null` deletes the row. Upsert keyed on the unique index (D-6). |
| `DELETE` | `/api/habits/:id` | Archives. `?hard=true` deletes, cascading logs (D-7). |

`GET` shape:

```json
[{ "id": "…", "title": "Read 10 pages", "plantType": "OAK", "color": "ev-green",
   "archived": false, "position": 0, "createdAt": 1786000000000,
   "logs": [{ "date": "2026-08-16", "status": "COMPLETED" }] }]
```

Derived state is deliberately **not** returned. It depends on the logical today,
which depends on a setting the client already holds, and computing it server-side
would mean a second definition of the same thing.

`POST /:id/log` validates `date` against `yyyy-MM-dd` and `status` against the
two-value set, rejecting anything else with 400. It does not validate the date
against the logical today — backfilling a missed day is legitimate.

---

## 5. Frontend

```
src/client/hooks/useHabits.ts              query + optimistic mutations
src/client/pages/Habits.tsx                garden view
src/client/components/habits/PlantCard.tsx one habit
src/client/components/habits/Plant.tsx     the SVG, by type + stage + health
src/client/components/habits/HabitSheet.tsx analytics
src/client/components/habits/HabitEditor.tsx create / edit
src/client/components/ui/sheet.tsx          extracted primitive
src/client/lib/quotes.ts                    the quote list + daily pick
```

### Sheet primitive

There is no Sheet or Dialog in `components/ui/` — eleven components, none of them
this. `@radix-ui/react-dialog` is already a dependency and
`components/focus/SessionJournalSheet.tsx` implements a slide-out ad hoc. That
pattern is extracted into `ui/sheet.tsx` and exported from `ui/index.ts`, then
consumed by both. Extraction happens first so the habit sheet is not a third copy.

### Optimistic logging

`useHabits` follows the existing TanStack Query pattern: cancel outstanding
queries, snapshot the cache, patch the habit's `logs` array in place, roll back on
error, invalidate on settle. Because every derived value is computed from `logs`,
patching that one array makes the streak, stage, and health all update in the same
frame — no server round trip before the plant reacts.

### Plant rendering

`Plant.tsx` takes `{ plantType, stage, health }` and returns inline SVG. Stage
selects the shape, health selects the treatment:

- `THRIVING` — full colour
- `WILTED` — `grayscale opacity-60`, slight droop transform
- `DYING` — heavier desaturation, more droop
- `DEAD` — bare silhouette

Colour alone never carries the state (NFR-3): the card always shows a text label
next to the streak, and `aria-label` states health in words.

### Interaction

- The card's primary button toggles today between `COMPLETED` and cleared.
- Right-click, and a visible kebab for keyboard and touch, opens the menu:
  `Skip today`, `Clear today`, `Edit`, `Archive`. A right-click-only affordance
  would be unreachable by keyboard.
- Completion animates with a spring at `stiffness: 400, damping: 30`, consistent
  with the rail's existing active-pill motion.

### Privacy blur

The habits page renders inside the routed content region, which already carries
`data-private`, so the garden blurs with everything else. No work needed.

---

## 6. Integrations

**Dashboard (FR-7).** A `HabitStrip` component above or beside the task list:
`3 of 5 today`, with each habit as a small tappable dot showing its plant at
current stage. Hidden entirely when the tab is disabled.

**Command palette.** `CommandPalette.tsx` gains habit commands built from the
active list — `Complete habit: <title>`, running the same mutation. They are
ordinary `{ kind: 'command' }` entries, so `filterCommands` picks them up with no
new parsing. Habits are not added to `ROUTE_FOR` / `GROUP_LABEL` / `TYPE_COLOR`,
because they are not FTS-indexed.

**Reminders.** `useReminders` already polls every 30s and gates each nudge on a
setting. A habit nudge joins it, gated on `habitReminders`, firing after
`REFLECTION_NUDGE_HOUR` when any habit is still unlogged for the logical day. It
uses the same `firedRef` ledger so it cannot repeat within a day.

**Settings.** `habit` is appended to `OPTIONAL_TABS` with the label `Habits`, and
to the seed's `disabledTabs` default alongside `life,revise,reflection`. The seed
only backfills missing keys, so existing databases keep their current value and
the tab stays off for new clones without touching anyone's setup.

---

## 7. Testing (D-8)

`vitest` is added as a dev dependency with a `test` script. Scope is the pure
layer only — no component or DOM testing, no jsdom.

`src/client/lib/habits.test.ts` covers:

- Empty logs → `SEED` / `THRIVING`, streak 0
- An unbroken run, counted from today and from yesterday-when-today-is-blank
- A skip bridging two completions: streak spans it, does not increment for it
- A skip at the head and tail of a run
- A genuine no-log gap breaking the count
- Health at each boundary: gaps of 1, 2, 3, 4, 6, 7 days
- A skip protecting health, not just the streak
- Stage at every threshold edge: 3/4, 14/15, 30/31, 60/61
- `toNextStage` arithmetic, and `null` at `BLOOMING`
- Stage not regressing after a long gap (the D-1 guarantee, asserted directly)

`src/shared/day.test.ts` covers `logicalToday` either side of the cutoff for
`rolloverHour` 0, 3 and 6, and the clamping of out-of-range values.
