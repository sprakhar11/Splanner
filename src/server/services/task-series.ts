import { randomUUID } from 'crypto'
import { and, eq, gt, inArray } from 'drizzle-orm'
import { db } from '../db/connection'
import { tasks, subtasks, taskTags } from '../db/schema'
import {
  missingOccurrences, nextOccurrence, HORIZON_DAYS, type Repeat,
} from './recurrence'

/** Server-local today as yyyy-MM-dd. */
export function todayISO() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type TaskRow = typeof tasks.$inferSelect

/** Columns copied onto each generated occurrence. */
function templateFrom(seed: TaskRow, date: string) {
  return {
    id: randomUUID(),
    title: seed.title,
    description: seed.description,
    priority: seed.priority,
    categoryId: seed.categoryId,
    estimatedMinutes: seed.estimatedMinutes,
    // Time actually spent belongs to the occurrence that was worked on.
    actualMinutes: null,
    // A per-occurrence deadline/reminder is shifted to match its own date.
    deadline: shiftStamp(seed.deadline, seed.date, date),
    reminderAt: shiftStamp(seed.reminderAt, seed.date, date),
    repeat: seed.repeat,
    attachedNotes: seed.attachedNotes,
    linkedNoteId: seed.linkedNoteId,
    // Each occurrence starts fresh.
    status: 'TODO' as const,
    date,
    position: seed.position,
    seriesId: seed.seriesId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/**
 * Moves an epoch-ms stamp onto a new date while keeping its time of day.
 * A 9am reminder on the seed stays a 9am reminder on every occurrence.
 */
function shiftStamp(stamp: number | null, seedDate: string, newDate: string): number | null {
  if (!stamp) return null
  const original = new Date(stamp)
  const [y, m, d] = newDate.split('-').map(Number)
  const shifted = new Date(
    y, m - 1, d,
    original.getHours(), original.getMinutes(), original.getSeconds(), 0
  )
  // Guard against an invalid seedDate producing NaN.
  return Number.isNaN(shifted.getTime()) ? null : shifted.getTime()
}

/** Subtask titles are copied so each occurrence gets its own unchecked checklist. */
function copySubtasks(fromTaskId: string, toTaskId: string) {
  const source = db.select().from(subtasks)
    .where(eq(subtasks.taskId, fromTaskId))
    .orderBy(subtasks.position)
    .all()

  for (const s of source) {
    db.insert(subtasks).values({
      id: randomUUID(),
      taskId: toTaskId,
      title: s.title,
      isCompleted: false,
      position: s.position,
    }).run()
  }
}

function copyTags(fromTaskId: string, toTaskId: string) {
  const source = db.select().from(taskTags).where(eq(taskTags.taskId, fromTaskId)).all()
  for (const t of source) {
    db.insert(taskTags).values({ taskId: toTaskId, tag: t.tag }).run()
  }
}

/**
 * Ensures a repeating task has a seriesId, then fills the series forward to the
 * horizon. Idempotent: dedup is by (seriesId, date), so re-running adds nothing.
 * Returns the number of occurrences created.
 */
export function materialiseSeries(taskId: string, horizonDays = HORIZON_DAYS): number {
  const seed = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!seed) return 0
  if (seed.repeat === 'NONE') return 0

  // A task that repeats but has no series yet becomes the head of one.
  let seriesId = seed.seriesId
  if (!seriesId) {
    seriesId = randomUUID()
    db.update(tasks).set({ seriesId }).where(eq(tasks.id, taskId)).run()
  }

  const siblings = db.select().from(tasks).where(eq(tasks.seriesId, seriesId)).all()
  const existing = siblings.map(t => t.date)

  const dates = missingOccurrences(
    seed.date, seed.repeat as Repeat, existing, todayISO(), horizonDays
  )
  if (dates.length === 0) return 0

  const withSeries = { ...seed, seriesId }
  // Drizzle's better-sqlite3 driver runs the callback immediately and returns
  // its result, so this is not a deferred function to invoke.
  db.transaction(() => {
    for (const date of dates) {
      const row = templateFrom(withSeries as TaskRow, date)
      db.insert(tasks).values(row).run()
      copySubtasks(taskId, row.id)
      copyTags(taskId, row.id)
    }
  })

  return dates.length
}

/** Tops up every active series. Called at boot so the horizon rolls forward. */
export function topUpAllSeries(horizonDays = HORIZON_DAYS): { series: number; created: number } {
  const repeating = db.select().from(tasks)
    .where(inArray(tasks.repeat, ['DAILY', 'WEEKLY', 'MONTHLY']))
    .all()

  // One representative per series is enough; pick the earliest so the cadence
  // is measured from the original seed.
  const heads = new Map<string, TaskRow>()
  for (const t of repeating) {
    const key = t.seriesId ?? `solo:${t.id}`
    const current = heads.get(key)
    if (!current || t.date < current.date) heads.set(key, t)
  }

  let created = 0
  for (const head of heads.values()) {
    created += materialiseSeries(head.id, horizonDays)
  }
  return { series: heads.size, created }
}

/**
 * Deletes future, untouched occurrences of a series.
 * Completed and in-progress rows are kept: they are a record of work done.
 */
export function pruneFutureOccurrences(seriesId: string, afterDate: string): number {
  const doomed = db.select().from(tasks)
    .where(and(
      eq(tasks.seriesId, seriesId),
      gt(tasks.date, afterDate),
      eq(tasks.status, 'TODO'),
    ))
    .all()

  for (const t of doomed) {
    db.delete(tasks).where(eq(tasks.id, t.id)).run()
  }
  return doomed.length
}

/** Deletes an entire series regardless of status. */
export function deleteSeries(seriesId: string): number {
  const rows = db.select().from(tasks).where(eq(tasks.seriesId, seriesId)).all()
  for (const t of rows) {
    db.delete(tasks).where(eq(tasks.id, t.id)).run()
  }
  return rows.length
}

/**
 * Reconciles a series after its repeat rule changed.
 * Future TODO rows are dropped and regenerated on the new cadence.
 */
export function rescheduleSeries(taskId: string): { removed: number; created: number } {
  const seed = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!seed) return { removed: 0, created: 0 }

  const removed = seed.seriesId
    ? pruneFutureOccurrences(seed.seriesId, seed.date)
    : 0

  if (seed.repeat === 'NONE') {
    // No longer repeating: detach so it stops being treated as a series head.
    db.update(tasks).set({ seriesId: null }).where(eq(tasks.id, taskId)).run()
    return { removed, created: 0 }
  }

  return { removed, created: materialiseSeries(taskId) }
}

export { nextOccurrence }
