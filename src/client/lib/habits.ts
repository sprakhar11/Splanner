/**
 * Habit state derivation. Pure — no dates read from the clock, no I/O.
 *
 * Two axes, deliberately independent (see spec decision D-1):
 *
 *   size   comes from total completions, and never regresses
 *   health comes from recency, and is the only thing that degrades
 *
 * Deriving size from the *current streak* was the original design, but it
 * contradicts itself: a broken streak is zero, so one missed day would drop a
 * 61-day plant to a seed. Splitting the axes means a neglected plant is a large
 * sick plant rather than a lost one, and a single completion restores it.
 *
 * The accepted cost is that nothing is ever permanently lost. If the garden ever
 * feels consequence-free, the follow-up is a decaying high-water mark.
 */

import { addDays, daysBetween } from '@shared/day'

export type HabitStatus = 'COMPLETED' | 'SKIPPED'
export type Stage = 'SEED' | 'SPROUT' | 'SAPLING' | 'MATURE' | 'BLOOMING'
export type Health = 'THRIVING' | 'WILTED' | 'DYING' | 'DEAD'

export type HabitLog = {
  date: string // yyyy-MM-dd, a logical day
  status: HabitStatus
}

export type HabitState = {
  currentStreak: number
  longestStreak: number
  totalCompletions: number
  stage: Stage
  health: Health
  /** Completions still needed to reach the next stage. Null at BLOOMING. */
  toNextStage: number | null
  /** Today's log, if one exists. Drives the card's primary control. */
  todayStatus: HabitStatus | null
  /** Days since the last COMPLETED or SKIPPED log. Null when never logged. */
  daysSinceActivity: number | null
}

/**
 * Stage floors, by total completions. Ordered low to high.
 *
 * Exported so the UI can render the ladder and the distance to the next rung
 * without restating these numbers.
 */
export const STAGE_THRESHOLDS = [
  { stage: 'SEED', min: 0 },
  { stage: 'SPROUT', min: 4 },
  { stage: 'SAPLING', min: 15 },
  { stage: 'MATURE', min: 31 },
  { stage: 'BLOOMING', min: 61 },
] as const satisfies readonly { stage: Stage; min: number }[]

/**
 * Health ceilings, by days since the last activity. Ordered best to worst.
 *
 * A gap of 1 is still THRIVING: the user may simply not have logged today yet,
 * and a tracker that turns everything sick first thing in the morning is a
 * tracker people stop opening.
 */
export const HEALTH_THRESHOLDS = [
  { health: 'THRIVING', maxGap: 1 },
  { health: 'WILTED', maxGap: 3 },
  { health: 'DYING', maxGap: 6 },
  { health: 'DEAD', maxGap: Infinity },
] as const satisfies readonly { health: Health; maxGap: number }[]

export function stageFor(totalCompletions: number): Stage {
  let stage: Stage = 'SEED'
  for (const t of STAGE_THRESHOLDS) {
    if (totalCompletions >= t.min) stage = t.stage
  }
  return stage
}

/** Completions needed for the next rung, or null once at the top. */
export function toNextStageFor(totalCompletions: number): number | null {
  const next = STAGE_THRESHOLDS.find(t => t.min > totalCompletions)
  return next ? next.min - totalCompletions : null
}

export function healthFor(daysSinceActivity: number | null): Health {
  // Never logged is a fresh habit, not a dead one.
  if (daysSinceActivity === null) return 'THRIVING'
  for (const t of HEALTH_THRESHOLDS) {
    if (daysSinceActivity <= t.maxGap) return t.health
  }
  return 'DEAD'
}

/**
 * Derives everything the garden needs from a habit's logs.
 *
 * `today` is the *logical* day (see `@shared/day`), not the wall clock, so a
 * completion at 01:30 with a 3 AM boundary counts toward the day the user is
 * still finishing.
 */
export function computeHabitState(logs: HabitLog[], today: string): HabitState {
  const byDate = new Map<string, HabitStatus>()
  for (const log of logs) {
    // Last write wins. The unique index makes duplicates impossible in practice,
    // but an imported backup is not guaranteed to be clean.
    byDate.set(log.date, log.status)
  }

  const totalCompletions = [...byDate.values()].filter(s => s === 'COMPLETED').length
  const todayStatus = byDate.get(today) ?? null

  return {
    currentStreak: currentStreakFrom(byDate, today),
    longestStreak: longestStreakFrom(byDate),
    totalCompletions,
    stage: stageFor(totalCompletions),
    health: healthFor(daysSinceActivityFrom(byDate, today)),
    toNextStage: toNextStageFor(totalCompletions),
    todayStatus,
    daysSinceActivity: daysSinceActivityFrom(byDate, today),
  }
}

/**
 * Consecutive completions counting back from today.
 *
 * `computeStreaks` in `./streaks.ts` cannot be reused here. It treats any absent
 * date as a break, so passing only completions lets a skip break the run, and
 * passing completions plus skips lets a skip inflate it. Neither is what a
 * freeze day means.
 *
 * Rules:
 *   COMPLETED  counts, and the walk continues
 *   SKIPPED    does not count, but the walk continues  (it bridges)
 *   no log     ends the walk
 *
 * Starting at yesterday when today is blank mirrors the rule in `streaks.ts`:
 * the streak must not look broken merely because it is early in the day.
 */
function currentStreakFrom(byDate: Map<string, HabitStatus>, today: string): number {
  let cursor = byDate.has(today) ? today : addDays(today, -1)
  let streak = 0

  while (true) {
    const status = byDate.get(cursor)
    if (status === 'COMPLETED') streak++
    else if (status !== 'SKIPPED') break
    cursor = addDays(cursor, -1)
  }

  return streak
}

/**
 * The longest run anywhere in the habit's history, using the same bridging rule.
 *
 * Walks the logged days in date order. A run survives a one-or-more day span of
 * SKIPPED logs but ends at any day with no log at all. Leading and trailing
 * skips contribute nothing, since only completions increment.
 */
function longestStreakFrom(byDate: Map<string, HabitStatus>): number {
  const dates = [...byDate.keys()].sort()
  if (dates.length === 0) return 0

  let longest = 0
  let run = 0
  let prev: string | null = null

  for (const date of dates) {
    // A gap with no log at all resets; consecutive logged days continue the run.
    if (prev !== null && daysBetween(prev, date) > 1) run = 0
    if (byDate.get(date) === 'COMPLETED') run++
    if (run > longest) longest = run
    prev = date
  }

  return longest
}

/**
 * Days since the last log of either status.
 *
 * Skips count as activity: a sick day protects the plant's health as well as its
 * streak, which is the entire point of a freeze.
 */
function daysSinceActivityFrom(
  byDate: Map<string, HabitStatus>,
  today: string
): number | null {
  if (byDate.size === 0) return null

  let latest: string | null = null
  for (const date of byDate.keys()) {
    // Ignore anything dated in the future, which a backfill could produce.
    if (date > today) continue
    if (latest === null || date > latest) latest = date
  }

  return latest === null ? null : daysBetween(latest, today)
}
