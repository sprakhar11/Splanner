import { db } from '../db/connection'
import { revisionItems, revisionHistory, revisionItemTags, noteTags } from '../db/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'

/** Fixed expanding interval ladder (days). Index = stage. */
export const INTERVALS = [0, 1, 3, 7, 14, 30, 90]
export const MAX_STAGE = INTERVALS.length - 1

export type Grade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY'

export function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Applies a grade to a stage index.
 * AGAIN -> 1 (review tomorrow, regardless of current stage)
 * HARD  -> unchanged (repeat same interval)
 * GOOD  -> +1, capped
 * EASY  -> +2, capped
 */
export function nextStage(current: number, grade: Grade): number {
  switch (grade) {
    case 'AGAIN': return 1
    case 'HARD': return Math.min(current, MAX_STAGE)
    case 'GOOD': return Math.min(current + 1, MAX_STAGE)
    case 'EASY': return Math.min(current + 2, MAX_STAGE)
  }
}

/** Strips fenced code blocks, then returns the first `limit` chars of prose. */
export function deriveConcept(content: string, limit = 240) {
  const prose = (content || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim()
  return prose.length > limit ? prose.slice(0, limit).trimEnd() + '…' : prose
}

/** Extracts the first fenced code block, plus its language tag if present. */
export function deriveCodeSnippet(content: string): { code: string | null; lang: string | null } {
  const match = /```([\w+-]*)\n?([\s\S]*?)```/.exec(content || '')
  if (!match) return { code: null, lang: null }
  const lang = match[1]?.trim() || null
  const code = match[2]?.replace(/\s+$/, '') || null
  return { code: code && code.length > 0 ? code : null, lang }
}

/**
 * Keeps a note's linked revision card in sync.
 *
 * - scheduled=true and no card  -> create at stage 0, due today
 * - scheduled=true and card     -> refresh display fields, PRESERVE schedule progress
 * - scheduled=false and card    -> delete card (history cascades)
 */
export function syncNoteRevisionCard(noteId: string, opts: {
  scheduled: boolean
  title: string
  content: string
}) {
  const existing = db.select().from(revisionItems)
    .where(eq(revisionItems.noteId, noteId)).get()

  if (!opts.scheduled) {
    if (existing) {
      db.delete(revisionItems).where(eq(revisionItems.id, existing.id)).run()
    }
    return { action: 'deleted' as const, card: null }
  }

  const concept = deriveConcept(opts.content)
  const { code } = deriveCodeSnippet(opts.content)

  if (existing) {
    // Refresh what is shown, keep the schedule intact.
    db.update(revisionItems).set({
      title: opts.title,
      concept,
      codeSnippet: code,
    }).where(eq(revisionItems.id, existing.id)).run()

    syncCardTags(existing.id, noteId)
    const card = db.select().from(revisionItems).where(eq(revisionItems.id, existing.id)).get()
    return { action: 'updated' as const, card }
  }

  const id = randomUUID()
  db.insert(revisionItems).values({
    id,
    noteId,
    title: opts.title,
    concept,
    codeSnippet: code,
    currentStepIndex: 0,
    nextDueDate: todayISO(),
    lastRevisedDate: null,
    totalRevisions: 0,
  }).run()

  syncCardTags(id, noteId)
  const card = db.select().from(revisionItems).where(eq(revisionItems.id, id)).get()
  return { action: 'created' as const, card }
}

/** Mirrors the note's tags onto the card. */
function syncCardTags(cardId: string, noteId: string) {
  const tags = db.select().from(noteTags).where(eq(noteTags.noteId, noteId)).all()
  db.delete(revisionItemTags).where(eq(revisionItemTags.revisionItemId, cardId)).run()
  for (const t of tags) {
    db.insert(revisionItemTags).values({ revisionItemId: cardId, tag: t.tag }).run()
  }
}

/** Grades a card, advances its schedule, and records history. */
export function gradeCard(id: string, grade: Grade) {
  const item = db.select().from(revisionItems).where(eq(revisionItems.id, id)).get()
  if (!item) return null

  const stage = nextStage(item.currentStepIndex, grade)
  const intervalDays = INTERVALS[stage]
  const today = todayISO()

  db.update(revisionItems).set({
    currentStepIndex: stage,
    nextDueDate: addDaysISO(today, intervalDays),
    lastRevisedDate: today,
    totalRevisions: item.totalRevisions + 1,
  }).where(eq(revisionItems.id, id)).run()

  db.insert(revisionHistory).values({
    id: randomUUID(),
    revisionItemId: id,
    date: today,
    grade,
    intervalDays,
  }).run()

  return db.select().from(revisionItems).where(eq(revisionItems.id, id)).get()
}
