# Habit Garden — Requirements

A gamified habit tracker for Splanner. Habits are plants in a garden: they grow
as you keep them up, and visibly suffer when you don't.

Ships disabled by default. Existing databases are untouched.

---

## 1. Resolved design decisions

These were open or contradictory in the original idea. Each is settled here so
the schema and the pure logic have a single interpretation.

### D-1: Plant size and plant health are separate axes

The original derived growth stage from the **current streak**, while also
promising a wilted plant "retains previous level if recovered". Those cannot both
hold — a broken streak is zero, so one missed day would drop a 61-day plant to a
seed. That is the churn the health system exists to prevent.

Resolution:

- **Stage comes from total completions.** Monotonic. Never regresses. It
  represents cumulative investment.
- **Health comes from recency.** It is the only thing that degrades.

A neglected plant is therefore a large sick plant, not a seed, and a single
completion restores its appearance immediately.

Accepted tradeoff: nothing is ever permanently lost, so there is no downside
pressure beyond appearance. If the garden proves consequence-free in practice,
the follow-up is a decaying high-water mark (stage drops one level per full week
dead). Deliberately not in v1 — more stored state and more edge cases for a
problem we have not yet observed.

### D-2: Habits use the configured day boundary, not midnight

`rolloverHour` (0–6) already defines when the user's day ends for task rollover.
The client's `todayISO()` is plain wall-clock and knows nothing about it.

If habits used wall-clock time, a completion at 01:30 with `rolloverHour: 3`
would land on a different day than a task completed in the same minute, and
plants would begin wilting on a day the user has explicitly declared unfinished.

Resolution: one shared helper in `src/shared/day.ts`, consumed by both the client
and the server, so there is one definition of "today" and no drift.

### D-3: Statuses are `COMPLETED` and `SKIPPED` only

`FAILED` was specified but no mechanic read it, and the absence of a log after a
day has passed already carries the same meaning. Dropped.

### D-4: Skips bridge, missing days break

A `SKIPPED` log joins the completions on either side of it without adding to the
count. A day with **no log at all** breaks the streak. These are separate code
paths and both are covered by tests.

### D-5: All logs are sent to the client

Bounding the payload to 60 days contradicts computing lifetime figures from it —
longest streak and total completions would both be silently wrong once history
exceeded the window, and under D-1 that would corrupt plant size.

One row per habit per day is negligible at single-user scale (five habits over
two years is roughly 3,600 rows). If it ever matters, denormalise
`longestStreak` and `totalCompletions` onto the habit row.

### D-6: Logging is an explicit endpoint, not a toggle

An upsert-only `toggle` cannot undo a mis-tap. Replaced by
`POST /api/habits/:id/log` taking an explicit status, where `null` clears the day.

### D-7: Delete archives by default

Consistent with keeping revision and interview data when a tab is switched off.
Hard deletion requires an explicit flag.

### D-8: Vitest is added for the pure logic

The repository has no test runner. Skip-bridging streak logic is the fiddliest
pure function in the codebase, and two real scheduling bugs in the spaced
repetition ladder (a same-day reschedule loop and a duplicated interval) would
have been caught by tests. This feature is the right moment to add one, scoped to
`src/**/lib/*.ts` and `src/shared/*.ts`.

### D-9: Plant types are cosmetic in v1

Per-type mechanics (a cactus tolerating longer gaps, say) would push
type-specific thresholds into the pure function. Deferred.

---

## 2. Functional requirements

### FR-1: Habit management
- A habit SHALL have a title and a plant type.
- A habit MAY have a colour, referencing an existing `--ev-*` token.
- Creating, renaming, and changing plant type SHALL be supported.
- Deleting SHALL archive by default, preserving all logs.
- Archived habits SHALL NOT appear in the garden, the dashboard, or the palette.

### FR-2: Daily logging
- A day SHALL hold at most one log per habit, enforced by a unique index.
- A habit SHALL be markable `COMPLETED` or `SKIPPED` for any given day.
- Clearing a day SHALL remove its log entirely.
- Logging SHALL be optimistic — no spinner, per NFR-1 of the core spec.
- The "today" a log defaults to SHALL be the logical day (D-2).

### FR-3: Derived state
Given a habit's logs and a logical today, the system SHALL derive:

- **Current streak** — consecutive `COMPLETED` days counting back from today, or
  from yesterday when today is not yet logged. `SKIPPED` days are stepped over
  without incrementing. A gap with no log ends the count.
- **Longest streak** — the maximum such run in the habit's history.
- **Total completions** — lifetime count of `COMPLETED` logs.
- **Stage** — from total completions: `SEED` 0–3, `SPROUT` 4–14, `SAPLING` 15–30,
  `MATURE` 31–60, `BLOOMING` 61+.
- **Health** — from days since the last `COMPLETED` or `SKIPPED` log:
  `THRIVING` 0–1, `WILTED` 2–3, `DYING` 4–6, `DEAD` 7+.

A habit with no logs SHALL be `SEED` / `THRIVING`, not dead. A new habit must not
open in a failure state.

### FR-4: Garden view
- Active habits SHALL render as a responsive grid of plant cards.
- A card SHALL show the plant at its stage, the habit title, and current streak.
- `WILTED` and worse SHALL be visually distinct without relying on colour alone,
  per NFR-3 — desaturation plus a text state label.
- Clicking a card's primary control SHALL toggle today's completion.
- A context menu SHALL offer `SKIPPED`, clearing the day, editing, and archiving.
- Completion SHALL animate with a spring, consistent with existing motion use.

### FR-5: Analytics
- Opening a habit SHALL show a sheet containing a contribution-style heatmap,
  current and longest streak, total completions, and current stage with the
  distance to the next one.
- The heatmap SHALL reuse the existing `heatmapWeeks` helper.

### FR-6: Motivation banner
- The garden SHALL show one quote per logical day.
- The quote SHALL be chosen deterministically from the date, so it is stable
  across reloads without needing to be stored.

### FR-7: Integrations
- **Dashboard:** a compact row showing how many habits are done out of how many
  are due today, with inline completion. A tracker only reachable by navigation
  is a tracker that gets forgotten.
- **Command palette:** one command per active habit, `Complete habit: <title>`,
  registered as an ordinary command so the existing substring filter handles it.
  No new query syntax.
- **Reminders:** an evening nudge when habits remain incomplete, gated on a new
  `habitReminders` setting, following the existing reflection nudge pattern.
- **Settings:** `habit` joins `OPTIONAL_TABS` and is disabled by default for new
  installs.

### FR-8: No scheduled mutation
Health and stage SHALL be derived on read. Nothing about a habit requires a
scheduled job, a cron, or a rollover write. Wilting happens because the logical
day advanced, not because a row changed.

---

## 3. Out of scope

- Per-plant-type mechanics (D-9)
- Stage decay (D-1)
- Sub-daily habits ("three times a day")
- Weekly targets ("four times a week") — every habit here is daily
- Full-text search indexing of habits
- Reordering the garden by drag
