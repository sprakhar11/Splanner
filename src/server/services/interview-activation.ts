/**
 * When a task is completed, its linked interview prep items should transition
 * from PENDING → REVISION_PENDING, and a revision card should be created
 * with the first due date at day+1 (start of the 1, 3, 7, 14, 30, 90 schedule).
 *
 * This keeps the revision queue honest: you only get asked to recall something
 * you've actually done.
 */

import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../db/connection'
import { interviewItems, revisionItems } from '../db/schema'
import { todayISO } from './spaced-repetition'

/** Adds days to a yyyy-MM-dd string. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Activates all interview items linked to the given task.
 * Called when a task transitions to COMPLETED.
 */
export function activateLinkedInterviewItems(taskId: string): number {
  const linked = db.select().from(interviewItems)
    .where(eq(interviewItems.linkedTaskId, taskId))
    .all()

  let activated = 0

  for (const item of linked) {
    // Only activate PENDING items that want revision
    if (item.status !== 'PENDING') continue

    if (item.scheduleRevision && !item.revisionItemId) {
      // Create the revision card, due tomorrow (day 1 of the SRS intervals).
      //
      // Starts at stage 1, not 0, because stage *is* the ladder rung that has
      // been assigned — and a due date of tomorrow is the 1-day rung
      // (INTERVALS[1]). Starting at 0 would make the first GOOD advance to
      // stage 1, whose interval is also 1 day, so the card would be asked
      // twice in two days before the ladder opened up.
      const revId = randomUUID()
      db.insert(revisionItems).values({
        id: revId,
        noteId: null,
        title: item.title,
        concept: item.description || '',
        codeSnippet: null,
        currentStepIndex: 1,
        nextDueDate: addDays(todayISO(), 1), // First revision: tomorrow
        lastRevisedDate: null,
        totalRevisions: 0,
      }).run()

      db.update(interviewItems).set({
        status: 'REVISION_PENDING',
        revisionItemId: revId,
      }).where(eq(interviewItems.id, item.id)).run()
    } else {
      // No revision wanted — just mark as done
      db.update(interviewItems).set({
        status: 'DONE',
      }).where(eq(interviewItems.id, item.id)).run()
    }

    activated++
  }

  if (activated > 0) {
    console.log(`[interview] Activated ${activated} item(s) linked to task ${taskId.slice(0, 8)}…`)
  }

  return activated
}
