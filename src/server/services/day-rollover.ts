/**
 * Day rollover: moves incomplete tasks from past days to today.
 *
 * Runs once per calendar day, triggered either at server boot or on the first
 * API request of a new day. Idempotent — a second call on the same day is a
 * no-op that costs one settings read.
 *
 * What gets preserved:
 *   - actualMinutes (time tracked is never lost)
 *   - subtask completion state
 *   - tags, deadline, reminder, linked note
 *   - a rollover log entry for Stats visibility
 *
 * What does NOT move:
 *   - COMPLETED tasks (they stay on the day they were finished)
 *   - SNOOZED tasks (user explicitly deferred them)
 *   - Tasks in a repeating series (each occurrence owns its date)
 */

import { db, sqlite } from '../db/connection'
import { tasks, settings } from '../db/schema'
import { eq, and, lt, inArray, isNull } from 'drizzle-orm'
import { logicalToday } from '../../shared/day'

const ROLLOVER_KEY = 'lastRolloverDate'
const ROLLOVER_HOUR_KEY = 'rolloverHour'

/**
 * The "logical today" for rollover purposes.
 *
 * The offset itself lives in `@shared/day` because the client needs the identical
 * rule — a habit logged at 01:30 has to land on the same day as a task completed
 * in the same minute. This function only supplies the stored setting.
 *
 * Everything else in the app (task creation, calendar rendering, due dates) uses
 * the real date as always; only this boundary shifts.
 */
function rolloverToday(): string {
  const row = db.select().from(settings).where(eq(settings.key, ROLLOVER_HOUR_KEY)).get()
  return logicalToday(row?.value ?? 0)
}

/** Reads the last rollover date from the settings KV table. */
function getLastRolloverDate(): string | null {
  const row = db.select().from(settings).where(eq(settings.key, ROLLOVER_KEY)).get()
  return row?.value ?? null
}

/** Writes today as the last rollover date. */
function setLastRolloverDate(date: string) {
  const existing = db.select().from(settings).where(eq(settings.key, ROLLOVER_KEY)).get()
  if (existing) {
    db.update(settings).set({ value: date }).where(eq(settings.key, ROLLOVER_KEY)).run()
  } else {
    db.insert(settings).values({ key: ROLLOVER_KEY, value: date }).run()
  }
}

/** Ensures the rollover log table exists (created once, never migrated). */
export function ensureRolloverTable() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_rollovers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id TEXT NOT NULL,
      from_date TEXT NOT NULL,
      to_date TEXT NOT NULL,
      rolled_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    )
  `)
}

export type RolloverResult = {
  ran: boolean
  moved: number
  today: string
  fromDates: string[]
}

/**
 * True when a rollover has not yet run for the current local day.
 *
 * Lets a caller do something before the move happens — taking the daily backup,
 * for instance — without paying for it on every request.
 */
export function isRolloverPending(): boolean {
  return getLastRolloverDate() !== rolloverToday()
}

/**
 * Checks whether a rollover is needed and executes it if so.
 * Safe to call on every request — returns immediately when already done today.
 */
export function checkAndRollover(): RolloverResult {
  const today = rolloverToday()
  const last = getLastRolloverDate()

  // Already done today — fast path.
  if (last === today) {
    return { ran: false, moved: 0, today, fromDates: [] }
  }

  ensureRolloverTable()

  // Find all incomplete tasks dated before today that are NOT part of a series.
  // Series tasks stay on their own date — their recurrence system handles cadence.
  const overdue = db.select().from(tasks)
    .where(and(
      lt(tasks.date, today),
      inArray(tasks.status, ['TODO', 'IN_PROGRESS']),
      // Exclude series occurrences: they have their own rhythm.
      isNull(tasks.seriesId),
    ))
    .all()

  if (overdue.length === 0) {
    setLastRolloverDate(today)
    return { ran: true, moved: 0, today, fromDates: [] }
  }

  const fromDates = [...new Set(overdue.map(t => t.date))].sort()
  const now = Date.now()

  // Move each task and log the rollover.
  for (const task of overdue) {
    // Log before moving so Stats can reconstruct history.
    sqlite.prepare(
      `INSERT INTO task_rollovers (task_id, from_date, to_date, rolled_at) VALUES (?, ?, ?, ?)`
    ).run(task.id, task.date, today, now)

    db.update(tasks).set({ date: today, updatedAt: now }).where(eq(tasks.id, task.id)).run()
  }

  setLastRolloverDate(today)

  console.log(
    `[rollover] Moved ${overdue.length} incomplete task${overdue.length === 1 ? '' : 's'} from ${fromDates.join(', ')} to ${today}.`
  )

  return { ran: true, moved: overdue.length, today, fromDates }
}

/** Exposed for the API: force a rollover check and return the result. */
export function forceRollover(): RolloverResult {
  // Reset the flag so checkAndRollover actually runs.
  //
  // This has to compare against the *logical* day, not the wall clock. Comparing
  // against the wall clock made this a silent no-op inside the pre-cutoff window:
  // the stored date was yesterday's logical day, the wall clock said today, they
  // never matched, so the flag was left alone and checkAndRollover then found its
  // own logical day already done and returned without doing anything.
  const today = rolloverToday()
  const last = getLastRolloverDate()
  if (last === today) {
    // Even if "done", re-check in case tasks were added in the past after the rollover.
    setLastRolloverDate('')
  }
  return checkAndRollover()
}
