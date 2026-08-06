import { Hono } from 'hono'
import { db } from '../db/connection'
import { revisionItems, revisionHistory, revisionItemTags } from '../db/schema'
import { eq, lte, asc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { gradeCard, todayISO, type Grade } from '../services/spaced-repetition'

const revisionsRoute = new Hono()

revisionsRoute.get('/', async (c) => {
  const result = db.select().from(revisionItems)
    .orderBy(asc(revisionItems.nextDueDate)).all()
  return c.json(result)
})

revisionsRoute.get('/due', async (c) => {
  const result = db.select().from(revisionItems)
    .where(lte(revisionItems.nextDueDate, todayISO()))
    .orderBy(asc(revisionItems.nextDueDate))
    .all()
  return c.json(result)
})

revisionsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(revisionItems).where(eq(revisionItems.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)

  const history = db.select().from(revisionHistory)
    .where(eq(revisionHistory.revisionItemId, id)).all()
  const tags = db.select().from(revisionItemTags)
    .where(eq(revisionItemTags.revisionItemId, id)).all()

  return c.json({ ...item, history, tags: tags.map(t => t.tag) })
})

revisionsRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()

  db.insert(revisionItems).values({
    id,
    noteId: body.noteId || null,
    title: body.title,
    concept: body.concept || '',
    codeSnippet: body.codeSnippet || null,
    currentStepIndex: 0,
    nextDueDate: todayISO(),
    lastRevisedDate: null,
    totalRevisions: 0,
  }).run()

  if (body.tags?.length) {
    for (const tag of body.tags) {
      db.insert(revisionItemTags).values({ revisionItemId: id, tag }).run()
    }
  }

  const created = db.select().from(revisionItems).where(eq(revisionItems.id, id)).get()
  return c.json(created, 201)
})

revisionsRoute.post('/:id/grade', async (c) => {
  const id = c.req.param('id')
  const { grade } = await c.req.json() as { grade: Grade }

  const updated = gradeCard(id, grade)
  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json(updated)
})

revisionsRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const { tags, history, ...data } = body
  db.update(revisionItems).set(data).where(eq(revisionItems.id, id)).run()
  const updated = db.select().from(revisionItems).where(eq(revisionItems.id, id)).get()
  return c.json(updated)
})

revisionsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  db.delete(revisionItems).where(eq(revisionItems.id, id)).run()
  return c.json({ success: true })
})

export default revisionsRoute
