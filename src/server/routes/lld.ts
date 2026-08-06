import { Hono } from 'hono'
import { db } from '../db/connection'
import { lldDesigns } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const lldRoute = new Hono()

lldRoute.get('/', async (c) => {
  const result = db.select().from(lldDesigns).all()
  return c.json(result)
})

lldRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(lldDesigns).where(eq(lldDesigns.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

lldRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  db.insert(lldDesigns).values({ id, ...body }).run()
  const created = db.select().from(lldDesigns).where(eq(lldDesigns.id, id)).get()
  return c.json(created, 201)
})

lldRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  db.update(lldDesigns).set(body).where(eq(lldDesigns.id, id)).run()
  const updated = db.select().from(lldDesigns).where(eq(lldDesigns.id, id)).get()
  return c.json(updated)
})

lldRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(lldDesigns).where(eq(lldDesigns.id, id)).run()
  return c.json({ success: true })
})

export default lldRoute
