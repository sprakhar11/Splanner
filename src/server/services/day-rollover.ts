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

const ROLLOVER_KEY = 'lastRolloverDate'
const ROLLOVER_HOUR_KEY = 'rolloverHour'

/**
 * Returns the configured hour (0–23) at which the day "ends" for task movement.
 * Default is 0 (midnight). If a user studies until 2 AM, they can set this to 3
 * so incomplete tasks don't vanish while they're still working.
 */
function getRolloverHour(): number {
  const row = db.select().from(settings).where(eq(settings.key, ROLLOVER_HOUR_KEY)).get()
  const n = Number(row?.value ?? '0')
  return Number.isFinite(n) && n >= 0 && n <= 6 ? Math.floor(n) : 0
}

/**
 * The "logical today" for rollover purposes.
 *
 * If the current wall-clock time is before the rollover hour, we still consider
 * it "yesterday" — the user's day hasn't ended yet, so nothing should move.
 * Everything else in the app (task creation, calendar view, due dates) uses the
 * real date as always; only the rollover boundary shifts.
 */
function rolloverToday(): string {
  const now = new Date()
  const hour = getRolloverHour()
  // Before the cutoff → still yesterday's "day"
  if (hour > 0 && now.getHours() < hour) {
    now.setDate(now.getDate() - 1)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Server-local today as yyyy-MM-dd. */
function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
  const today = todayISO()
  const last = getLastRolloverDate()
  if (last === today) {
    // Even if "done", re-check in case tasks were added in the past after the rollover.
    setLastRolloverDate('')
  }
  return checkAndRollover()
}
