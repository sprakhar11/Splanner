import { Hono } from 'hono'
import { db } from '../db/connection'
import { reflections } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const reflectionsRoute = new Hono()

reflectionsRoute.get('/', async (c) => {
  const result = db.select().from(reflections).all()
  return c.json(result)
})

reflectionsRoute.get('/:date', async (c) => {
  const date = c.req.param('date')
  const item = db.select().from(reflections)
    .where(eq(reflections.date, date)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

/**
 * Writable columns. Anything else the client sends is dropped rather than passed
 * into the statement, where an unknown key throws a SqliteError.
 */
const FIELDS = [
  'date', 'tasksCompletedCount', 'hoursStudied', 'problemsSolvedCount',
  'learnedSummary', 'struggledSummary', 'mood', 'gratitude',
] as const

function buildPatch(body: Record<string, any>) {
  const patch: Record<string, any> = {}
  for (const k of FIELDS) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  return patch
}

// Upsert by date
reflectionsRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()

  if (!body.date) return c.json({ error: 'date is required' }, 400)

  const existing = db.select().from(reflections)
    .where(eq(reflections.date, body.date)).get()

  if (existing) {
    db.update(reflections).set(buildPatch(body))
      .where(eq(reflections.id, existing.id)).run()
    const updated = db.select().from(reflections)
      .where(eq(reflections.id, existing.id)).get()
    return c.json(updated)
  }

  db.insert(reflections).values({ id, ...buildPatch(body) }).run()
  const created = db.select().from(reflections)
    .where(eq(reflections.id, id)).get()
  return c.json(created, 201)
})

reflectionsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(reflections).where(eq(reflections.id, id)).run()
  return c.json({ success: true })
})

export default reflectionsRoute
