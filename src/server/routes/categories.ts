import { Hono } from 'hono'
import { db } from '../db/connection'
import { categories } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { restoreDefaultCategories } from '../db/seed'

const categoriesRoute = new Hono()

categoriesRoute.get('/', async (c) => {
  const result = db.select().from(categories).orderBy(categories.position).all()
  return c.json(result)
})

categoriesRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  db.insert(categories).values({ id, ...body }).run()
  const created = db.select().from(categories).where(eq(categories.id, id)).get()
  return c.json(created, 201)
})

categoriesRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  db.update(categories).set(body).where(eq(categories.id, id)).run()
  const updated = db.select().from(categories).where(eq(categories.id, id)).get()
  return c.json(updated)
})

categoriesRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(categories).where(eq(categories.id, id)).run()
  return c.json({ success: true })
})

categoriesRoute.post('/restore-defaults', async (c) => {
  restoreDefaultCategories()
  const result = db.select().from(categories).orderBy(categories.position).all()
  return c.json(result)
})

export default categoriesRoute
