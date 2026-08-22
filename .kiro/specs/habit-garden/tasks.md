# Habit Garden — Tasks

Ordered by dependency. Each group leaves the build green.

---

## 1. Foundation — shared day boundary

- [ ] Create `src/shared/day.ts` with `toISO`, `logicalToday`, `isLogicalToday`,
      `daysBetween`
- [ ] Refactor `src/server/services/day-rollover.ts` to call `logicalToday()`
      instead of its private `rolloverToday()`
- [ ] Confirm `scripts/test-rollover.py` still passes — rollover behaviour must be
      unchanged

## 2. Test harness

- [ ] Add `vitest` as a dev dependency and a `test` script
- [ ] Config scoped to `src/**/lib/*.test.ts` and `src/shared/*.test.ts`, no jsdom
- [ ] `src/shared/day.test.ts` — cutoff behaviour for `rolloverHour` 0 / 3 / 6,
      plus clamping

## 3. Pure logic

- [ ] `src/client/lib/habits.ts` — types, `STAGE_THRESHOLDS`,
      `HEALTH_THRESHOLDS`, `computeHabitState`
- [ ] `src/client/lib/habits.test.ts` — the full list in design §7, including the
      explicit assertion that stage never regresses
- [ ] `src/client/lib/quotes.ts` — quote list and deterministic pick from a date

## 4. Persistence

- [ ] Add `habits` and `habitLogs` to `src/server/db/schema.ts`, with the unique
      index on `(habitId, date)`
- [ ] `src/server/db/migrate-habits.ts` — `ensureHabitTables()` using
      `CREATE TABLE IF NOT EXISTS` plus the unique index
- [ ] Call it from `src/server/index.ts` after `migrateInterviewItems()`
- [ ] Add both tables to `exportAsJson()` and `importFromJson()`, bump export to
      v3, keep v1 and v2 importable
- [ ] Verify a round-trip on a `VACUUM INTO` copy, never the live database

## 5. API

- [ ] `src/server/routes/habits.ts` — the five endpoints in design §4
- [ ] Mount at `/api/habits` in `index.ts`
- [ ] Validate `date` format and `status` on the log endpoint, 400 on bad input
- [ ] `status: null` deletes the row
- [ ] `DELETE` archives; `?hard=true` deletes with cascade

## 6. UI primitives

- [ ] Extract `src/client/components/ui/sheet.tsx` from the pattern in
      `components/focus/SessionJournalSheet.tsx`
- [ ] Export it from `ui/index.ts`
- [ ] Repoint `SessionJournalSheet` at the primitive so there is only one
      implementation

## 7. Garden

- [ ] `src/client/hooks/useHabits.ts` — query plus optimistic log mutation that
      patches the cached `logs` array
- [ ] `src/client/components/habits/Plant.tsx` — SVG by type, stage and health
- [ ] `src/client/components/habits/PlantCard.tsx` — primary toggle, kebab menu,
      spring animation, text state label, `aria-label` carrying health
- [ ] `src/client/pages/Habits.tsx` — responsive grid, motivation banner, empty
      state using the existing `empty-state` component
- [ ] `src/client/components/habits/HabitEditor.tsx` — create and edit, plant type
      picker, colour from `--ev-*` tokens
- [ ] `src/client/components/habits/HabitSheet.tsx` — heatmap via `heatmapWeeks`,
      streak and completion stats, stage ladder with distance to next
- [ ] Route `/habits` in `App.tsx` with a `SUBTITLES` entry

## 8. Integrations

- [ ] `habit` added to `OPTIONAL_TABS` and `TAB_LABELS` in `lib/settings.ts`
- [ ] `habit` appended to the seed's `disabledTabs` default
- [ ] Rail entry in `IconRail.tsx`, filtered by the existing disabled-tab logic
- [ ] `HabitStrip` on the dashboard, hidden when the tab is off
- [ ] Habit commands in `CommandPalette.tsx`
- [ ] `habitReminders` setting, plus the evening nudge in `useReminders`
- [ ] Settings toggle row for `habitReminders`

## 9. Verification

- [ ] `pnpm test` green
- [ ] `pnpm build` clean
- [ ] Manual pass in the browser: create, complete, skip, clear, backfill a past
      day, archive
- [ ] Confirm the tab is hidden on a fresh database and the existing one is
      untouched
- [ ] Confirm the garden blurs with the privacy toggle
- [ ] Confirm a completion from the palette updates the garden without a reload
- [ ] Delete any scratch data created while testing

---

## Deferred

- Stage decay for dead plants (requirements D-1)
- Per-plant-type mechanics (D-9)
- Drag reordering — the `position` column exists, nothing writes it yet
- Weekly-target habits
