/**
 * Pure rules for turning a finished focus session into a journal note.
 *
 * Kept separate from the UI so the decisions that matter — when to prompt, what
 * kind of note this is, and how repeat sessions on one task accumulate — are
 * testable without a DOM.
 */

/**
 * Sessions shorter than this do not prompt. A four minute session does not
 * warrant a journal entry, and prompting anyway trains you to dismiss the
 * sheet reflexively, which then costs you the entries that mattered.
 */
export const JOURNAL_PROMPT_MIN_MINUTES = 10

export type NoteType = 'CONCEPT' | 'INTERVIEW_QUESTION' | 'CODE_SNIPPET' | 'MISTAKE' | 'GENERAL'

export const NOTE_TYPES: NoteType[] = [
  'MISTAKE', 'CONCEPT', 'INTERVIEW_QUESTION', 'CODE_SNIPPET', 'GENERAL',
]

export type JournalDraft = {
  mistake: string
  learned: string
  type: NoteType
  tags: string[]
  scheduleRevision: boolean
}

/**
 * A session attached to a task has already been recorded against it, so a short
 * one can pass without comment. An UNTITLED session has nothing but elapsed
 * minutes: skip the prompt and the time is orphaned with no name and no task.
 * So an untitled session always prompts, however short.
 */
export function shouldPromptJournal(
  minutes: number,
  opts: { hasTask?: boolean; threshold?: number } = {}
) {
  const { hasTask = true, threshold = JOURNAL_PROMPT_MIN_MINUTES } = opts
  if (!hasTask) return true
  return minutes >= threshold
}

/**
 * A session with a recorded mistake is a MISTAKE note: that is the part worth
 * revisiting. Otherwise it is a concept note, and an empty draft stays GENERAL.
 */
export function deriveNoteType(mistake: string, learned: string): NoteType {
  if (mistake.trim()) return 'MISTAKE'
  if (learned.trim()) return 'CONCEPT'
  return 'GENERAL'
}

/** Nothing to save when both prose fields are blank. */
export function isDraftEmpty(draft: Pick<JournalDraft, 'mistake' | 'learned'>) {
  return !draft.mistake.trim() && !draft.learned.trim()
}

const HEADING_RE = /^## /

/**
 * One session's entry, as markdown. The date and duration head the section so a
 * note accumulating several sessions reads as a log.
 */
export function buildEntry(opts: {
  date: string
  minutes: number
  mistake: string
  learned: string
}) {
  const lines: string[] = [`## ${opts.date} · ${opts.minutes}m`]

  if (opts.learned.trim()) {
    lines.push('', '**Learned**', opts.learned.trim())
  }
  if (opts.mistake.trim()) {
    lines.push('', '**Went wrong**', opts.mistake.trim())
  }

  return lines.join('\n')
}

/**
 * Appends a new entry to an existing note, newest last so the note reads
 * chronologically. A blank existing note is replaced rather than padded.
 */
export function appendEntry(existing: string | null | undefined, entry: string) {
  const base = (existing ?? '').trim()
  if (!base) return entry
  return `${base}\n\n${entry}`
}

/** Tags are merged case-insensitively so repeat sessions do not duplicate them. */
export function mergeTags(existing: string[], incoming: string[]) {
  const seen = new Map<string, string>()
  for (const t of [...existing, ...incoming]) {
    const clean = t.trim().replace(/^#/, '')
    if (!clean) continue
    const key = clean.toLowerCase()
    if (!seen.has(key)) seen.set(key, clean)
  }
  return [...seen.values()]
}

/** Parses the comma-separated tag input. */
export function parseTags(raw: string) {
  return mergeTags([], raw.split(','))
}

/**
 * Seeds the sheet from the task that was just worked on, so the common case is
 * a couple of sentences rather than filling in a form.
 */
export function initialDraft(task: { tags?: string[] } | null | undefined): JournalDraft {
  return {
    mistake: '',
    learned: '',
    type: 'GENERAL',
    tags: Array.isArray(task?.tags) ? mergeTags([], task!.tags!) : [],
    // Opt-in on purpose: if every session becomes a card the revision queue
    // floods and stops being credible.
    scheduleRevision: false,
  }
}

/** How many session entries a note already holds. */
export function countEntries(content: string | null | undefined) {
  if (!content) return 0
  return content.split('\n').filter(l => HEADING_RE.test(l)).length
}

/* ------------------------------------------------ untitled (general) sessions */

/**
 * A stopwatch started without picking a task first. On stop the user names what
 * they were doing, and that becomes a real task carrying the tracked time, so
 * ad-hoc work still shows up in the planner and the stats.
 */
export type UntitledDraft = {
  title: string
  categoryId: string
  /** Retroactive logging usually means the work is finished. */
  markComplete: boolean
}

export function initialUntitledDraft(): UntitledDraft {
  return { title: '', categoryId: '', markComplete: true }
}

export function isUntitledDraftValid(draft: Pick<UntitledDraft, 'title'>) {
  return draft.title.trim().length > 0
}

/**
 * The task to create for an untitled session.
 *
 * The estimate is set to the time actually spent: there was no forecast, so
 * pretending to one would corrupt the estimate-accuracy figure on the Stats
 * page. Setting them equal keeps that metric honest.
 */
export function buildTaskFromSession(opts: {
  title: string
  categoryId: string
  minutes: number
  date: string
  markComplete: boolean
}) {
  return {
    title: opts.title.trim(),
    date: opts.date,
    categoryId: opts.categoryId || null,
    estimatedMinutes: opts.minutes,
    actualMinutes: opts.minutes,
    status: opts.markComplete ? ('COMPLETED' as const) : ('IN_PROGRESS' as const),
    priority: 'P3' as const,
  }
}
