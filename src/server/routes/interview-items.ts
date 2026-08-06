import { Hono } from 'hono'
import { db, sqlite } from '../db/connection'
import { interviewItems } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { gradeCard, todayISO } from '../services/spaced-repetition'
import { revisionItems } from '../db/schema'

const interviewItemsRoute = new Hono()

// List all, or filter by topicType
interviewItemsRoute.get('/', async (c) => {
  const topic = c.req.query('topic')
  let results
  if (topic) {
    results = db.select().from(interviewItems)
      .where(eq(interviewItems.topicType, topic))
      .orderBy(interviewItems.createdAt)
      .all()
  } else {
    results = db.select().from(interviewItems)
      .orderBy(interviewItems.createdAt)
      .all()
  }
  // Parse tags JSON for the client
  return c.json(results.map(r => ({ ...r, tags: safeParseTags(r.tags) })))
})

interviewItemsRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  return c.json({ ...item, tags: safeParseTags(item.tags) })
})

interviewItemsRoute.post('/', async (c) => {
  const body = await c.req.json()
  if (!body.title?.trim()) return c.json({ error: 'title is required' }, 400)
  if (!body.topicType?.trim()) return c.json({ error: 'topicType is required' }, 400)

  const id = body.id || randomUUID()
  const addToRevision = !!body.addToRevision

  db.insert(interviewItems).values({
    id,
    topicType: body.topicType.trim(),
    title: body.title.trim(),
    description: body.description || '',
    link: body.link || '',
    tags: JSON.stringify(Array.isArray(body.tags) ? body.tags : []),
    status: addToRevision ? 'REVISION_PENDING' : 'DONE',
    revisionItemId: null,
    createdAt: Date.now(),
  }).run()

  // Create a revision card if opted in
  let revId: string | null = null
  if (addToRevision) {
    revId = randomUUID()
    db.insert(revisionItems).values({
      id: revId,
      noteId: null,
      title: body.title.trim(),
      concept: body.description || '',
      codeSnippet: null,
      currentStepIndex: 0,
      nextDueDate: todayISO(),
      lastRevisedDate: null,
      totalRevisions: 0,
    }).run()
    db.update(interviewItems).set({ revisionItemId: revId }).where(eq(interviewItems.id, id)).run()
  }

  const created = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  return c.json({ ...created!, tags: safeParseTags(created!.tags) }, 201)
})

interviewItemsRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const existing = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const patch: Record<string, any> = {}
  if (body.title !== undefined) patch.title = body.title.trim()
  if (body.description !== undefined) patch.description = body.description
  if (body.link !== undefined) patch.link = body.link
  if (body.topicType !== undefined) patch.topicType = body.topicType
  if (body.tags !== undefined) patch.tags = JSON.stringify(Array.isArray(body.tags) ? body.tags : [])
  if (body.status !== undefined) patch.status = body.status

  // Opt into revision retroactively
  if (body.addToRevision && !existing.revisionItemId) {
    const revId = randomUUID()
    db.insert(revisionItems).values({
      id: revId,
      noteId: null,
      title: patch.title ?? existing.title,
      concept: patch.description ?? existing.description ?? '',
      codeSnippet: null,
      currentStepIndex: 0,
      nextDueDate: todayISO(),
      lastRevisedDate: null,
      totalRevisions: 0,
    }).run()
    patch.revisionItemId = revId
    patch.status = 'REVISION_PENDING'
  }

  if (Object.keys(patch).length > 0) {
    db.update(interviewItems).set(patch).where(eq(interviewItems.id, id)).run()
  }

  const updated = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  return c.json({ ...updated!, tags: safeParseTags(updated!.tags) })
})

/**
 * Grade a revision for an interview item. Advances the SRS stage and updates
 * the item's status to reflect how many revisions have been completed.
 */
interviewItemsRoute.post('/:id/revise', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const grade = body.grade

  if (!['AGAIN', 'HARD', 'GOOD', 'EASY'].includes(grade)) {
    return c.json({ error: 'grade must be AGAIN|HARD|GOOD|EASY' }, 400)
  }

  const item = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  if (!item) return c.json({ error: 'Not found' }, 404)
  if (!item.revisionItemId) return c.json({ error: 'Item is not in the revision queue' }, 400)

  const result = gradeCard(item.revisionItemId, grade)

  // Update the item's status to reflect the new revision count
  const card = db.select().from(revisionItems).where(eq(revisionItems.id, item.revisionItemId)).get()
  if (card) {
    const revCount = card.totalRevisions
    const newStatus = revCount === 0 ? 'REVISION_PENDING' : `REVISION_${revCount}_DONE`
    db.update(interviewItems).set({ status: newStatus }).where(eq(interviewItems.id, id)).run()
  }

  const updated = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  return c.json({ ...updated!, tags: safeParseTags(updated!.tags), revision: result })
})

interviewItemsRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const item = db.select().from(interviewItems).where(eq(interviewItems.id, id)).get()
  if (item?.revisionItemId) {
    db.delete(revisionItems).where(eq(revisionItems.id, item.revisionItemId)).run()
  }
  db.delete(interviewItems).where(eq(interviewItems.id, id)).run()
  return c.json({ success: true })
})

/** Stats: counts per topic and per status */
interviewItemsRoute.get('/stats/summary', async (c) => {
  const all = db.select().from(interviewItems).all()
  const today = todayISO()
  const monthStart = today.slice(0, 7) + '-01'

  const byTopic: Record<string, { total: number; today: number; month: number; revised: number }> = {}
  for (const item of all) {
    const t = item.topicType
    if (!byTopic[t]) byTopic[t] = { total: 0, today: 0, month: 0, revised: 0 }
    byTopic[t].total++

    const created = new Date(item.createdAt).toISOString().slice(0, 10)
    if (created === today) byTopic[t].today++
    if (created >= monthStart) byTopic[t].month++
    if (item.status !== 'DONE' && item.status !== 'REVISION_PENDING') byTopic[t].revised++
  }

  return c.json({ byTopic, totalItems: all.length })
})

function safeParseTags(raw: string | null | undefined): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [] }
}

export default interviewItemsRoute
