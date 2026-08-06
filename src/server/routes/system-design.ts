import { Hono } from 'hono'
import { db } from '../db/connection'
import { systemDesign } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const systemDesignRoute = new Hono()

systemDesignRoute.get('/', async (c) => {
  const result = db.select().from(systemDesign).all()
  return c.json(result)
})

systemDesignRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(systemDesign).where(eq(systemDesign.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json(item)
})

systemDesignRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  db.insert(systemDesign).values({
    id,
    ...body,
    keyTradeoffs: JSON.stringify(body.keyTradeoffs || []),
  }).run()
  const created = db.select().from(systemDesign).where(eq(systemDesign.id, id)).get()
  return c.json(created, 201)
})

systemDesignRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  if (body.keyTradeoffs) body.keyTradeoffs = JSON.stringify(body.keyTradeoffs)
  db.update(systemDesign).set(body).where(eq(systemDesign.id, id)).run()
  const updated = db.select().from(systemDesign).where(eq(systemDesign.id, id)).get()
  return c.json(updated)
})

systemDesignRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(systemDesign).where(eq(systemDesign.id, id)).run()
  return c.json({ success: true })
})

export default systemDesignRoute
