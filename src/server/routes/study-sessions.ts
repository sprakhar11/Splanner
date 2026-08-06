import { Hono } from 'hono'
import { db } from '../db/connection'
import { studySessions } from '../db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const studySessionsRoute = new Hono()

studySessionsRoute.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')

  const conditions: any[] = []
  if (from) conditions.push(gte(studySessions.date, from))
  if (to) conditions.push(lte(studySessions.date, to))

  let query = db.select().from(studySessions).$dynamic()
  if (conditions.length > 0) query = query.where(and(...conditions))

  const result = query.orderBy(studySessions.date).all()
  return c.json(result)
})

studySessionsRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  db.insert(studySessions).values({ id, ...body }).run()
  const created = db.select().from(studySessions).where(eq(studySessions.id, id)).get()
  return c.json(created, 201)
})

studySessionsRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  db.update(studySessions).set(body).where(eq(studySessions.id, id)).run()
  const updated = db.select().from(studySessions).where(eq(studySessions.id, id)).get()
  return c.json(updated)
})

studySessionsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(studySessions).where(eq(studySessions.id, id)).run()
  return c.json({ success: true })
})

export default studySessionsRoute
