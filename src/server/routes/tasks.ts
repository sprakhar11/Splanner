import { Hono } from 'hono'
import { db } from '../db/connection'
import { tasks, subtasks, taskTags, interviewItems } from '../db/schema'
import { eq, and, gte, lte, desc, inArray, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import {
  materialiseSeries, rescheduleSeries, pruneFutureOccurrences, deleteSeries,
} from '../services/task-series'
import { activateLinkedInterviewItems } from '../services/interview-activation'

const tasksRoute = new Hono()

// List tasks (optional date range filter)
tasksRoute.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')
  const categoryId = c.req.query('categoryId')
  const status = c.req.query('status')

  let query = db.select().from(tasks).$dynamic()

  const conditions: any[] = []
  if (from) conditions.push(gte(tasks.date, from))
  if (to) conditions.push(lte(tasks.date, to))
  if (categoryId) conditions.push(eq(tasks.categoryId, categoryId))
  if (status) conditions.push(eq(tasks.status, status as any))

  if (conditions.length > 0) {
    query = query.where(and(...conditions))
  }

  const result = query.orderBy(tasks.date, tasks.position).all()
  return c.json(result)
})

// Get single task with subtasks and tags
tasksRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!task) return c.json({ error: 'Not found' }, 404)

  const subs = db.select().from(subtasks).where(eq(subtasks.taskId, id)).orderBy(subtasks.position).all()
  const tags = db.select().from(taskTags).where(eq(taskTags.taskId, id)).all()

  return c.json({ ...task, subtasks: subs, tags: tags.map(t => t.tag) })
})

// Create task
tasksRoute.post('/', async (c) => {
  const body = await c.req.json()

  if (!body.title?.trim()) return c.json({ error: 'title is required' }, 400)
  if (!body.date) return c.json({ error: 'date is required' }, 400)

  const id = body.id || randomUUID()
  const now = Date.now()

  db.insert(tasks).values({
    id,
    title: body.title,
    description: body.description || '',
    priority: body.priority || 'P3',
    categoryId: body.categoryId || null,
    estimatedMinutes: body.estimatedMinutes ?? 30,
    actualMinutes: body.actualMinutes ?? null,
    deadline: body.deadline ?? null,
    reminderAt: body.reminderAt ?? null,
    repeat: body.repeat || 'NONE',
    attachedNotes: body.attachedNotes || '',
    linkedNoteId: body.linkedNoteId || null,
    status: body.status || 'TODO',
    date: body.date,
    position: body.position ?? 0,
    seriesId: body.seriesId || null,
    createdAt: now,
    updatedAt: now,
  }).run()

  // Insert tags
  if (body.tags && body.tags.length > 0) {
    for (const tag of body.tags) {
      db.insert(taskTags).values({ taskId: id, tag }).run()
    }
  }

  // Insert subtasks
  if (body.subtasks && body.subtasks.length > 0) {
    for (const sub of body.subtasks) {
      db.insert(subtasks).values({
        id: sub.id || randomUUID(),
        taskId: id,
        title: sub.title,
        isCompleted: sub.isCompleted || false,
        position: sub.position ?? 0,
      }).run()
    }
  }

  // A repeating task fans out into a materialised series.
  let generated = 0
  if ((body.repeat ?? 'NONE') !== 'NONE') {
    generated = materialiseSeries(id)
  }

  // Create a linked interview prep item if requested.
  if (body.addToInterviewPrep && body.title?.trim()) {
    const interviewId = randomUUID()
    const tags = Array.isArray(body.tags) ? body.tags : []
    db.insert(interviewItems).values({
      id: interviewId,
      topicType: body.interviewTopic || 'DSA',
      title: body.title.trim(),
      description: body.description || '',
      link: '',
      tags: JSON.stringify(tags),
      status: 'PENDING', // Waits for task completion
      revisionItemId: null,
      linkedTaskId: id,
      scheduleRevision: true,
      createdAt: Date.now(),
    }).run()
  }

  const created = db.select().from(tasks).where(eq(tasks.id, id)).get()
  return c.json({ ...created, occurrencesCreated: generated }, 201)
})

/**
 * Columns a client may set, split by how an empty value must be stored.
 * Nullable columns need '' coerced to NULL, otherwise SQLite rejects the
 * foreign key (categoryId) or stores a string where an integer belongs.
 */
const NULLABLE_FIELDS = [
  'categoryId', 'actualMinutes', 'deadline', 'reminderAt', 'linkedNoteId', 'seriesId',
] as const
const PLAIN_FIELDS = [
  'title', 'description', 'priority', 'estimatedMinutes', 'repeat',
  'attachedNotes', 'status', 'date', 'position',
] as const

/** Builds a partial update from only the keys the client actually sent. */
function buildTaskPatch(body: Record<string, any>) {
  const patch: Record<string, any> = {}
  for (const k of PLAIN_FIELDS) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  for (const k of NULLABLE_FIELDS) {
    if (body[k] !== undefined) patch[k] = body[k] === '' ? null : body[k]
  }
  return patch
}

// Update task
tasksRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const before = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!before) return c.json({ error: 'Not found' }, 404)

  db.update(tasks).set({
    ...buildTaskPatch(body),
    updatedAt: Date.now(),
  }).where(eq(tasks.id, id)).run()

  // Update tags if provided
  if (body.tags !== undefined) {
    db.delete(taskTags).where(eq(taskTags.taskId, id)).run()
    for (const tag of body.tags) {
      db.insert(taskTags).values({ taskId: id, tag }).run()
    }
  }

  // Replace the checklist wholesale when the client sends one.
  if (body.subtasks !== undefined) {
    db.delete(subtasks).where(eq(subtasks.taskId, id)).run()
    body.subtasks.forEach((sub: any, i: number) => {
      if (!sub?.title?.trim()) return
      db.insert(subtasks).values({
        id: sub.id || randomUUID(),
        taskId: id,
        title: sub.title.trim(),
        isCompleted: !!sub.isCompleted,
        position: sub.position ?? i,
      }).run()
    })
  }

  // Changing the repeat rule reshapes the series.
  let series: { removed: number; created: number } | undefined
  if (body.repeat !== undefined && body.repeat !== before.repeat) {
    series = rescheduleSeries(id)
  }

  // When a task is completed, activate any linked interview items:
  // PENDING → REVISION_PENDING, and create the revision card (due day 1).
  const updated = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (updated?.status === 'COMPLETED' && before.status !== 'COMPLETED') {
    activateLinkedInterviewItems(id)
  }

  return c.json({ ...updated, ...(series ? { series } : {}) })
})

/**
 * Delete a task. `?scope=series` removes every occurrence in its series,
 * `?scope=future` removes this one plus later untouched occurrences.
 */
tasksRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const scope = c.req.query('scope') ?? 'one'

  const task = db.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!task) return c.json({ error: 'Not found' }, 404)

  if (scope === 'series' && task.seriesId) {
    const removed = deleteSeries(task.seriesId)
    return c.json({ success: true, scope, removed })
  }

  if (scope === 'future' && task.seriesId) {
    const later = pruneFutureOccurrences(task.seriesId, task.date)
    db.delete(tasks).where(eq(tasks.id, id)).run()
    return c.json({ success: true, scope, removed: later + 1 })
  }

  db.delete(tasks).where(eq(tasks.id, id)).run()
  return c.json({ success: true, scope: 'one', removed: 1 })
})

/* ------------------------------------------------------------- subtasks */

tasksRoute.get('/:id/subtasks', async (c) => {
  const rows = db.select().from(subtasks)
    .where(eq(subtasks.taskId, c.req.param('id')))
    .orderBy(subtasks.position)
    .all()
  return c.json(rows)
})

tasksRoute.post('/:id/subtasks', async (c) => {
  const taskId = c.req.param('id')
  const body = await c.req.json()
  if (!body.title?.trim()) return c.json({ error: 'title is required' }, 400)

  const parent = db.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!parent) return c.json({ error: 'Task not found' }, 404)

  const siblings = db.select().from(subtasks).where(eq(subtasks.taskId, taskId)).all()
  const id = body.id || randomUUID()

  db.insert(subtasks).values({
    id,
    taskId,
    title: body.title.trim(),
    isCompleted: !!body.isCompleted,
    position: body.position ?? siblings.length,
  }).run()

  return c.json(db.select().from(subtasks).where(eq(subtasks.id, id)).get(), 201)
})

tasksRoute.put('/:id/subtasks/:subId', async (c) => {
  const subId = c.req.param('subId')
  const body = await c.req.json()

  const patch: Record<string, any> = {}
  if (body.title !== undefined) patch.title = String(body.title).trim()
  if (body.isCompleted !== undefined) patch.isCompleted = !!body.isCompleted
  if (body.position !== undefined) patch.position = body.position

  if (Object.keys(patch).length === 0) return c.json({ error: 'Nothing to update' }, 400)

  db.update(subtasks).set(patch).where(eq(subtasks.id, subId)).run()
  const updated = db.select().from(subtasks).where(eq(subtasks.id, subId)).get()
  if (!updated) return c.json({ error: 'Not found' }, 404)
  return c.json(updated)
})

tasksRoute.delete('/:id/subtasks/:subId', async (c) => {
  db.delete(subtasks).where(eq(subtasks.id, c.req.param('subId'))).run()
  return c.json({ success: true })
})

export default tasksRoute
