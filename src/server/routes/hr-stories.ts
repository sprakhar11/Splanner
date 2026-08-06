import { Hono } from 'hono'
import { db } from '../db/connection'
import { hrStories, hrStoryTags } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

const hrStoriesRoute = new Hono()

hrStoriesRoute.get('/', async (c) => {
  const result = db.select().from(hrStories).all()
  const allTags = db.select().from(hrStoryTags).all()
  const byStory = new Map<string, string[]>()
  for (const t of allTags) {
    const list = byStory.get(t.hrStoryId)
    if (list) list.push(t.tag)
    else byStory.set(t.hrStoryId, [t.tag])
  }
  return c.json(result.map(s => ({ ...s, tags: byStory.get(s.id) ?? [] })))
})

hrStoriesRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(hrStories).where(eq(hrStories.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  const tags = db.select().from(hrStoryTags).where(eq(hrStoryTags.hrStoryId, id)).all()
  return c.json({ ...item, tags: tags.map(t => t.tag) })
})

hrStoriesRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  const { tags, ...data } = body
  db.insert(hrStories).values({ id, ...data }).run()
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      db.insert(hrStoryTags).values({ hrStoryId: id, tag }).run()
    }
  }
  const created = db.select().from(hrStories).where(eq(hrStories.id, id)).get()
  return c.json(created, 201)
})

hrStoriesRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { tags, ...data } = body
  db.update(hrStories).set(data).where(eq(hrStories.id, id)).run()
  if (tags !== undefined) {
    db.delete(hrStoryTags).where(eq(hrStoryTags.hrStoryId, id)).run()
    for (const tag of tags) {
      db.insert(hrStoryTags).values({ hrStoryId: id, tag }).run()
    }
  }
  const updated = db.select().from(hrStories).where(eq(hrStories.id, id)).get()
  return c.json(updated)
})

hrStoriesRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(hrStories).where(eq(hrStories.id, id)).run()
  return c.json({ success: true })
})

export default hrStoriesRoute
