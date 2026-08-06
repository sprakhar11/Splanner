import { Hono } from 'hono'
import { db } from '../db/connection'
import { settings } from '../db/schema'
import { eq } from 'drizzle-orm'

const settingsRoute = new Hono()

settingsRoute.get('/', async (c) => {
  const rows = db.select().from(settings).all()
  const obj: Record<string, string> = {}
  for (const row of rows) obj[row.key] = row.value
  return c.json(obj)
})

settingsRoute.put('/', async (c) => {
  const body = await c.req.json() as Record<string, string>
  for (const [key, value] of Object.entries(body)) {
    db.insert(settings).values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
      .run()
  }
  const rows = db.select().from(settings).all()
  const obj: Record<string, string> = {}
  for (const row of rows) obj[row.key] = row.value
  return c.json(obj)
})

export default settingsRoute
