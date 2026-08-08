import { Hono } from 'hono'
import { db } from '../db/connection'
import { notes, noteTags, revisionItems } from '../db/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { syncNoteRevisionCard } from '../services/spaced-repetition'

const notesRoute = new Hono()

notesRoute.get('/', async (c) => {
  const result = db.select().from(notes)
    .orderBy(desc(notes.isFavorite), desc(notes.updatedAt))
    .all()
  const allTags = db.select().from(noteTags).all()
  const byNote = new Map<string, string[]>()
  for (const t of allTags) {
    const list = byNote.get(t.noteId)
    if (list) list.push(t.tag)
    else byNote.set(t.noteId, [t.tag])
  }
  return c.json(result.map(n => ({ ...n, tags: byNote.get(n.id) ?? [] })))
})

notesRoute.get('/count-by-type', async (c) => {
  const result = db.select().from(notes).all()
  const counts: Record<string, number> = {}
  for (const n of result) {
    counts[n.type] = (counts[n.type] || 0) + 1
  }
  return c.json(counts)
})

notesRoute.get('/:id', async (c) => {
  const id = c.req.param('id')
  const note = db.select().from(notes).where(eq(notes.id, id)).get()
  if (!note) return c.json({ error: 'Not found' }, 404)
  const tags = db.select().from(noteTags).where(eq(noteTags.noteId, id)).all()
  return c.json({ ...note, tags: tags.map(t => t.tag) })
})

notesRoute.post('/', async (c) => {
  const body = await c.req.json()
  const id = body.id || randomUUID()
  const now = Date.now()

  db.insert(notes).values({
    id,
    title: body.title,
    content: body.content || '',
    type: body.type || 'GENERAL',
    categoryId: body.categoryId || null,
    codeLanguage: body.codeLanguage || null,
    links: JSON.stringify(body.links || []),
    imageUris: JSON.stringify(body.imageUris || []),
    isFavorite: body.isFavorite || false,
    revisionScheduled: body.revisionScheduled || false,
    createdAt: now,
    updatedAt: now,
  }).run()

  if (body.tags && body.tags.length > 0) {
    for (const tag of body.tags) {
      db.insert(noteTags).values({ noteId: id, tag }).run()
    }
  }

  // Keep the linked revision card in sync
  syncNoteRevisionCard(id, {
    scheduled: !!body.revisionScheduled,
    title: body.title,
    content: body.content || '',
  })

  const created = db.select().from(notes).where(eq(notes.id, id)).get()
  return c.json(created, 201)
})

/**
 * Writable columns. Anything else the client sends is dropped rather than
 * spread into the statement, where an unknown key throws a SqliteError.
 */
const FIELDS = [
  'title', 'content', 'type', 'codeLanguage', 'isFavorite', 'revisionScheduled',
] as const
const NULLABLE_FIELDS = ['categoryId'] as const

notesRoute.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  const updateData: any = { updatedAt: Date.now() }
  for (const k of FIELDS) {
    if (body[k] !== undefined) updateData[k] = body[k]
  }
  for (const k of NULLABLE_FIELDS) {
    if (body[k] !== undefined) updateData[k] = body[k] === '' ? null : body[k]
  }
  // JSON columns are stored as text.
  if (body.links !== undefined) updateData.links = JSON.stringify(body.links)
  if (body.imageUris !== undefined) updateData.imageUris = JSON.stringify(body.imageUris)

  db.update(notes).set(updateData).where(eq(notes.id, id)).run()

  if (body.tags !== undefined) {
    db.delete(noteTags).where(eq(noteTags.noteId, id)).run()
    for (const tag of body.tags) {
      db.insert(noteTags).values({ noteId: id, tag }).run()
    }
  }

  const updated = db.select().from(notes).where(eq(notes.id, id)).get()

  // Keep the linked revision card in sync (preserves schedule progress)
  if (updated) {
    syncNoteRevisionCard(id, {
      scheduled: !!updated.revisionScheduled,
      title: updated.title,
      content: updated.content || '',
    })
  }

  return c.json(updated)
})

notesRoute.delete('/:id', async (c) => {
  const id = c.req.param('id')

  // The FK is ON DELETE SET NULL so that standalone cards remain possible, but
  // that means a note's DERIVED card would otherwise survive as an orphan:
  // stuck in the revision queue with no source to edit or trace back to.
  // syncNoteRevisionCard owns this relationship, so let it do the removal.
  syncNoteRevisionCard(id, { scheduled: false, title: '', content: '' })

  db.delete(notes).where(eq(notes.id, id)).run()
  return c.json({ success: true })
})

export default notesRoute
