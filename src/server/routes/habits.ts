import { Hono } from 'hono'
import { db } from '../db/connection'
import { habits, habitLogs } from '../db/schema'
import { eq, asc, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const habitsRoute = new Hono()

const STATUSES = ['COMPLETED', 'SKIPPED'] as const
type Status = typeof STATUSES[number]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Plant types the client offers. Cosmetic in v1 — no per-type mechanics. */
const PLANT_TYPES = ['OAK', 'SUNFLOWER', 'CACTUS', 'BONSAI', 'FERN', 'LAVENDER'] as const

/**
 * Habits with their full log history.
 *
 * Deliberately unbounded. Lifetime figures — longest streak, and total
 * completions, which drives plant size — cannot be computed from a truncated
 * window, and one row per habit per day is negligible at single-user scale.
 * If it ever matters, denormalise the aggregates onto the habit row.
 *
 * Derived state (streak, stage, health) is not returned. It depends on the
 * logical today, which depends on a setting the client already holds, and
 * computing it here would create a second definition of the same thing.
 */
habitsRoute.get('/', async (c) => {
  const includeArchived = c.req.query('includeArchived') === 'true'

  const rows = includeArchived
    ? db.select().from(habits).orderBy(asc(habits.position), asc(habits.createdAt)).all()
    : db.select().from(habits).where(eq(habits.archived, false))
        .orderBy(asc(habits.position), asc(habits.createdAt)).all()

  const logs = db.select().from(habitLogs).orderBy(asc(habitLogs.date)).all()

  const byHabit = new Map<string, { date: string; status: string }[]>()
  for (const log of logs) {
    if (!byHabit.has(log.habitId)) byHabit.set(log.habitId, [])
    byHabit.get(log.habitId)!.push({ date: log.date, status: log.status })
  }

  return c.json(rows.map(h => ({ ...h, logs: byHabit.get(h.id) ?? [] })))
})

habitsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const habit = db.select().from(habits).where(eq(habits.id, id)).get()
  if (!habit) return c.json({ error: 'Not found' }, 404)

  const logs = db.select().from(habitLogs)
    .where(eq(habitLogs.habitId, id))
    .orderBy(asc(habitLogs.date))
    .all()

  return c.json({ ...habit, logs: logs.map(l => ({ date: l.date, status: l.status })) })
})

habitsRoute.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.title?.trim()) return c.json({ error: 'title is required' }, 400)

  const plantType = body.plantType || 'OAK'
  if (!PLANT_TYPES.includes(plantType)) {
    return c.json({ error: `plantType must be one of ${PLANT_TYPES.join(', ')}` }, 400)
  }

  // Append to the end of the garden unless told otherwise.
  const count = db.select().from(habits).all().length
  const id = body.id || randomUUID()

  db.insert(habits).values({
    id,
    title: body.title.trim(),
    plantType,
    color: body.color || null,
    archived: false,
    position: typeof body.position === 'number' ? body.position : count,
    createdAt: Date.now(),
  }).run()

  const created = db.select().from(habits).where(eq(habits.id, id)).get()
  return c.json({ ...created, logs: [] }, 201)
})

habitsRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = db.select().from(habits).where(eq(habits.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const patch: Record<string, unknown> = {}
  if (typeof body.title === 'string') {
    if (!body.title.trim()) return c.json({ error: 'title cannot be empty' }, 400)
    patch.title = body.title.trim()
  }
  if (body.plantType !== undefined) {
    if (!PLANT_TYPES.includes(body.plantType)) {
      return c.json({ error: `plantType must be one of ${PLANT_TYPES.join(', ')}` }, 400)
    }
    patch.plantType = body.plantType
  }
  if (body.color !== undefined) patch.color = body.color || null
  if (typeof body.archived === 'boolean') patch.archived = body.archived
  if (typeof body.position === 'number') patch.position = body.position

  if (Object.keys(patch).length > 0) {
    db.update(habits).set(patch).where(eq(habits.id, id)).run()
  }

  const updated = db.select().from(habits).where(eq(habits.id, id)).get()
  return c.json(updated)
})

/**
 * Sets, changes, or clears one day's log.
 *
 * A plain "toggle" could not undo a mis-tap, so the status is explicit and
 * `null` clears the day. Upserts on the (habit_id, date) unique index, which
 * makes re-logging the same day idempotent rather than an error.
 *
 * The date is not validated against today: backfilling a day you forgot to tick
 * is legitimate, and so is correcting last week.
 */
habitsRoute.post('/:id/log', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const habit = db.select().from(habits).where(eq(habits.id, id)).get()
  if (!habit) return c.json({ error: 'Not found' }, 404)

  const date = body.date
  if (typeof date !== 'string' || !ISO_DATE.test(date)) {
    return c.json({ error: 'date must be yyyy-MM-dd' }, 400)
  }

  const status = body.status ?? null
  if (status !== null && !STATUSES.includes(status as Status)) {
    return c.json({ error: `status must be null, ${STATUSES.join(' or ')}` }, 400)
  }

  const where = and(eq(habitLogs.habitId, id), eq(habitLogs.date, date))

  if (status === null) {
    db.delete(habitLogs).where(where).run()
    return c.json({ habitId: id, date, status: null })
  }

  const existing = db.select().from(habitLogs).where(where).get()
  if (existing) {
    db.update(habitLogs).set({ status }).where(eq(habitLogs.id, existing.id)).run()
  } else {
    db.insert(habitLogs).values({
      id: randomUUID(),
      habitId: id,
      date,
      status,
      createdAt: Date.now(),
    }).run()
  }

  return c.json({ habitId: id, date, status })
})

/**
 * Archives by default, keeping every log.
 *
 * Consistent with how revision and interview data survive their tab being
 * switched off — a habit you stop doing is history worth keeping, and losing a
 * year of logs to a mis-click would be unrecoverable. `?hard=true` deletes for
 * real, cascading the logs.
 */
habitsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const hard = c.req.query('hard') === 'true'

  const existing = db.select().from(habits).where(eq(habits.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  if (hard) {
    db.delete(habits).where(eq(habits.id, id)).run()
    return c.json({ success: true, deleted: true })
  }

  db.update(habits).set({ archived: true }).where(eq(habits.id, id)).run()
  return c.json({ success: true, archived: true })
})

export default habitsRoute
