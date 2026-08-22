# Habit Garden — Tasks

Ordered by dependency. Each group leaves the build green.

---

## 1. Foundation — shared day boundary

- [x] Create `src/shared/day.ts` with `toISO`, `logicalToday`, `isLogicalToday`,
      `daysBetween`
- [x] Refactor `src/server/services/day-rollover.ts` to call `logicalToday()`
      instead of its private `rolloverToday()`
- [x] Confirm `scripts/test-rollover.py` still passes — rollover behaviour must be
      unchanged

## 2. Test harness

- [x] Add `vitest` as a dev dependency and a `test` script
- [x] Config scoped to `src/**/lib/*.test.ts` and `src/shared/*.test.ts`, no jsdom
- [x] `src/shared/day.test.ts` — cutoff behaviour for `rolloverHour` 0 / 3 / 6,
      plus clamping

## 3. Pure logic

- [x] `src/client/lib/habits.ts` — types, `STAGE_THRESHOLDS`,
      `HEALTH_THRESHOLDS`, `computeHabitState`
- [x] `src/client/lib/habits.test.ts` — the full list in design §7, including the
      explicit assertion that stage never regresses
- [x] `src/client/lib/quotes.ts` — quote list and deterministic pick from a date

## 4. Persistence

- [x] Add `habits` and `habitLogs` to `src/server/db/schema.ts`, with the unique
      index on `(habitId, date)`
- [x] `src/server/db/migrate-habits.ts` — `ensureHabitTables()` using
      `CREATE TABLE IF NOT EXISTS` plus the unique index
- [x] Call it from `src/server/index.ts` after `migrateInterviewItems()`
- [x] Add both tables to `exportAsJson()` and `importFromJson()`, bump export to
      v3, keep v1 and v2 importable
- [x] Verify a round-trip on a `VACUUM INTO` copy, never the live database

## 5. API

- [x] `src/server/routes/habits.ts` — the five endpoints in design §4
- [x] Mount at `/api/habits` in `index.ts`
- [x] Validate `date` format and `status` on the log endpoint, 400 on bad input
- [x] `status: null` deletes the row
- [x] `DELETE` archives; `?hard=true` deletes with cascade

## 6. UI primitives

- [x] Add `src/client/components/ui/sheet.tsx`, built on Radix Dialog rather than
      the raw `position: fixed` pattern, so it gets focus trapping, Escape and
      scroll locking
- [x] Export it from `ui/index.ts`
- [ ] Repoint `SessionJournalSheet` at the primitive — **deferred.** It is a pure
      refactor of a working flow with several fiddly bits (autofocus that moves
      depending on whether the session needs naming, nested selects, a sticky
      footer) and no user-facing gain. Better done on its own, with the journal
      flow exercised in the browser, than bundled into a feature commit.

## 7. Garden

- [x] `src/client/hooks/useHabits.ts` — query plus optimistic log mutation that
      patches the cached `logs` array
- [x] `src/client/components/habits/Plant.tsx` — SVG by type, stage and health
- [x] `src/client/components/habits/PlantCard.tsx` — primary toggle, kebab menu,
      spring animation, text state label, `aria-label` carrying health
- [x] `src/client/pages/Habits.tsx` — responsive grid, motivation banner, empty
      state using the existing `empty-state` component
- [x] `src/client/components/habits/HabitEditor.tsx` — create and edit, plant type
      picker, colour from `--ev-*` tokens
- [x] `src/client/components/habits/HabitSheet.tsx` — heatmap via `heatmapWeeks`,
      streak and completion stats, stage ladder with distance to next
- [x] Route `/habits` in `App.tsx` with a `SUBTITLES` entry

## 8. Integrations

- [x] `habit` added to `OPTIONAL_TABS` and `TAB_LABELS` in `lib/settings.ts`
- [x] `habit` appended to the seed's `disabledTabs` default
- [x] Rail entry in `IconRail.tsx`, filtered by the existing disabled-tab logic
- [x] `HabitStrip` on the dashboard, hidden when the tab is off
- [x] Habit commands in `CommandPalette.tsx`
- [x] `habitReminders` setting, plus the evening nudge in `useReminders`
- [x] Settings toggle row for `habitReminders`

## 9. Verification

- [x] `pnpm test` green
- [x] `pnpm build` clean
- [ ] Manual pass in the browser: create, complete, skip, clear, backfill a past
      day, archive
- [x] Confirm the tab is hidden on a fresh database and the existing one is
      untouched
- [ ] Confirm the garden blurs with the privacy toggle
- [x] Confirm a completion from the palette updates the garden without a reload
- [x] Delete any scratch data created while testing

---

## Deferred

- Stage decay for dead plants (requirements D-1)
- Per-plant-type mechanics (D-9)
- Drag reordering — the `position` column exists, nothing writes it yet
- Weekly-target habits
