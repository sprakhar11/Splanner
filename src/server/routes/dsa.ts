import { Hono } from 'hono'
import { db } from '../db/connection'
import { dsaProblems } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const dsaRoute = new Hono()

dsaRoute.get('/', async (c) => {
  const result = db.select().from(dsaProblems).all()
  return c.json(result)
})

dsaRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(dsaProblems).where(eq(dsaProblems.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

dsaRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  db.insert(dsaProblems).values({ id, ...body }).run()
  const created = db.select().from(dsaProblems).where(eq(dsaProblems.id, id)).get()
  return c.json(created, 201)
})

dsaRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  db.update(dsaProblems).set(body).where(eq(dsaProblems.id, id)).run()
  const updated = db.select().from(dsaProblems).where(eq(dsaProblems.id, id)).get()
  return c.json(updated)
})

dsaRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(dsaProblems).where(eq(dsaProblems.id, id)).run()
  return c.json({ success: true })
})

export default dsaRoute
