import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X, BookOpen, Brain, AlertTriangle, Check, ListPlus, Briefcase } from 'lucide-react'
import { useFocusTimer } from '@client/hooks/useFocusTimer'
import { useTask } from '@client/hooks/useTasks'
import { useCategories } from '@client/hooks/useCategories'
import { useSettings } from '@client/hooks/useSettings'
import { useToast } from '@client/components/ui/toast'
import { api } from '@client/api/client'
import { useQueryClient } from '@tanstack/react-query'
import { todayISO, formatMinutes } from '@client/lib/date'
import {
  initialDraft, deriveNoteType, isDraftEmpty, buildEntry, appendEntry,
  mergeTags, parseTags, countEntries, NOTE_TYPES, type NoteType,
  initialUntitledDraft, isUntitledDraftValid, buildTaskFromSession,
} from '@client/lib/journal'
import { cn } from '@client/lib/utils'

const pretty = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')

const DEFAULT_TOPICS = ['DSA', 'SYSTEM_DESIGN', 'LLD']

function topicLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Offered after a session's time is already saved. Dismissing it costs nothing
 * but the write-up, which is why the sheet is free to be skipped.
 */
export default function SessionJournalSheet() {
  const { pendingJournal, dismissJournal } = useFocusTimer()
  const { toast } = useToast()
  const qc = useQueryClient()

  const { data: task } = useTask(pendingJournal?.taskId ?? '')
  const { data: categories = [] } = useCategories()
  const { data: settings } = useSettings()

  // Available interview topics
  const topics = (() => {
    let parsed: string[] = []
    try { parsed = settings?.interviewTopics ? JSON.parse(settings.interviewTopics) : [] } catch {}
    return parsed.length > 0 ? parsed : DEFAULT_TOPICS
  })()

  const [draft, setDraft] = useState(() => initialDraft(null))
  const [untitled, setUntitled] = useState(initialUntitledDraft)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [typeTouched, setTypeTouched] = useState(false)
  const [addToInterviewPrep, setAddToInterviewPrep] = useState(false)
  const [interviewTopic, setInterviewTopic] = useState('DSA')

  /** A general stopwatch: the work has no task yet, so it has to be named. */
  const needsTask = !!pendingJournal && !pendingJournal.taskId

  // Reseed whenever a new session arrives, prefilling from the task.
  useEffect(() => {
    if (!pendingJournal) return
    const seeded = initialDraft(task)
    setDraft(seeded)
    setUntitled(initialUntitledDraft())
    setTagInput(seeded.tags.join(', '))
    setTypeTouched(false)
    setAddToInterviewPrep(false)
    setInterviewTopic('DSA')
  }, [pendingJournal, task])

  const set = (patch: Partial<typeof draft>) => setDraft(d => ({ ...d, ...patch }))

  // The note type follows the content until the user overrides it.
  const effectiveType: NoteType = typeTouched
    ? draft.type
    : deriveNoteType(draft.mistake, draft.learned)

  const existingNoteId: string | undefined = task?.linkedNoteId || undefined
  const empty = isDraftEmpty(draft)

  // Naming an untitled session is worthwhile on its own; the write-up is not
  // required for it. A titled session has nothing to save unless prose exists.
  const canSave = needsTask ? isUntitledDraftValid(untitled) : !empty

  const entryCount = useMemo(() => countEntries(task?.attachedNotes), [task])

  /** Creates the task for a general session and re-points the logged time at it. */
  const materialiseTask = async () => {
    const created = await api.tasks.create(buildTaskFromSession({
      title: untitled.title,
      categoryId: untitled.categoryId,
      minutes: pendingJournal!.minutes,
      date: todayISO(),
      markComplete: untitled.markComplete,
    }))

    // The study session was logged before a task existed. Attribute it now, so
    // the time shows against this task and its category in Stats.
    if (pendingJournal!.studySessionId) {
      await api.studySessions.update(pendingJournal!.studySessionId, {
        taskId: created.id,
        categoryId: untitled.categoryId || null,
        note: `Focus session: ${created.title}`,
      }).catch(() => { /* the minutes are already recorded; attribution is a bonus */ })
    }

    return created
  }

  const save = async () => {
    if (!pendingJournal || !canSave) return
    setSaving(true)

    const entry = buildEntry({
      date: todayISO(),
      minutes: pendingJournal.minutes,
      mistake: draft.mistake,
      learned: draft.learned,
    })
    const tags = mergeTags(parseTags(tagInput), [])

    try {
      // A general session becomes a real task first.
      const createdTask = needsTask ? await materialiseTask() : null
      const noteTitle = createdTask?.title ?? pendingJournal.taskTitle ?? untitled.title
      const noteTaskId = createdTask?.id ?? pendingJournal.taskId

      // With no prose there is nothing to journal; the task alone is the record.
      if (needsTask && empty) {
        toast({
          title: `Logged ${formatMinutes(pendingJournal.minutes)}`,
          body: `Added "${noteTitle}" to today.`,
          tone: 'success',
        })
        qc.invalidateQueries({ queryKey: ['tasks'] })
        qc.invalidateQueries({ queryKey: ['studySessions'] })
        dismissJournal()
        return
      }

      if (existingNoteId) {
        // A second session on the same task extends its note rather than
        // spawning a near-duplicate. PUT preserves any revision progress.
        const existing = await api.notes.get(existingNoteId)
        await api.notes.update(existingNoteId, {
          title: existing.title,
          content: appendEntry(existing.content, entry),
          type: effectiveType,
          revisionScheduled: draft.scheduleRevision || !!existing.revisionScheduled,
          tags: mergeTags(existing.tags ?? [], tags),
        })
        toast({
          title: 'Added to your journal',
          body: `Appended to "${existing.title}".`,
          tone: 'success',
        })
      } else {
        const note = await api.notes.create({
          title: noteTitle,
          content: entry,
          type: effectiveType,
          categoryId: untitled.categoryId || pendingJournal.categoryId,
          revisionScheduled: draft.scheduleRevision,
          tags,
        })
        // Link it so the next session on this task appends here.
        if (noteTaskId) {
          await api.tasks.update(noteTaskId, { linkedNoteId: note.id })
        }
        toast({
          title: createdTask ? `Logged and journalled "${createdTask.title}"` : 'Saved to your journal',
          body: draft.scheduleRevision
            ? 'A revision card is queued for today.'
            : undefined,
          tone: 'success',
        })
      }

      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['revisions'] })
      qc.invalidateQueries({ queryKey: ['tasks'] })

      // Also add to Interview Prep if opted in
      if (addToInterviewPrep) {
        const itemTitle = createdTask?.title ?? pendingJournal.taskTitle ?? untitled.title
        api.interviewItems.create({
          title: itemTitle.trim(),
          topicType: interviewTopic,
          description: draft.mistake || draft.learned || '',
          link: '',
          tags: mergeTags(parseTags(tagInput), []),
          addToRevision: false,
        }).then(() => {
          qc.invalidateQueries({ queryKey: ['interviewItems'] })
        }).catch(() => {})
      }

      dismissJournal()
    } catch (e: any) {
      toast({ title: 'Could not save the note', body: e.message, tone: 'warning' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {pendingJournal && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={dismissJournal}
            className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 440, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-label="Log this session"
            className="fixed left-1/2 top-1/2 z-[86] flex max-h-[86vh] w-[min(520px,94vw)]
                       -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
                       bg-popover shadow-2xl ring-1 ring-border"
          >
            {/* Header states plainly that the time is already saved. */}
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 text-[14px] font-semibold">
                  <Check className="h-3.5 w-3.5 text-[var(--ev-green)]" strokeWidth={3} />
                  {formatMinutes(pendingJournal.minutes)} logged
                </h3>
                <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                  {needsTask ? 'What were you working on?' : pendingJournal.taskTitle}
                  {!needsTask && entryCount > 0
                    && ` · ${entryCount} earlier ${entryCount === 1 ? 'entry' : 'entries'}`}
                </p>
              </div>
              <button
                onClick={dismissJournal}
                aria-label="Skip journalling this session"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {/* A general session has to be named before anything else, since
                  the name becomes a real task carrying the tracked time. */}
              {needsTask && (
                <div className="space-y-3 rounded-lg bg-surface-3 p-3 ring-1 ring-border">
                  <div>
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-primary">
                      <ListPlus className="h-3 w-3" />
                      Task name
                    </label>
                    <input
                      autoFocus
                      value={untitled.title}
                      onChange={e => setUntitled(u => ({ ...u, title: e.target.value }))}
                      placeholder="Reviewed system design notes"
                      className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                    />
                    <p className="mt-1 text-[10.5px] text-muted-foreground">
                      Added to today with {formatMinutes(pendingJournal.minutes)} already tracked.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Category</label>
                      <select
                        value={untitled.categoryId}
                        onChange={e => setUntitled(u => ({ ...u, categoryId: e.target.value }))}
                        className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60"
                      >
                        <option value="">None</option>
                        {(categories as any[]).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex cursor-pointer items-center gap-2 pb-2 text-[12px]">
                        <input
                          type="checkbox"
                          checked={untitled.markComplete}
                          onChange={e => setUntitled(u => ({ ...u, markComplete: e.target.checked }))}
                          className="h-3.5 w-3.5 rounded accent-[var(--primary)]"
                        />
                        Mark as done
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* The mistake comes first: it is the part worth revisiting. */}
              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--ev-orange)]">
                  <AlertTriangle className="h-3 w-3" />
                  What went wrong?
                </label>
                <textarea
                  autoFocus={!needsTask}
                  rows={4}
                  value={draft.mistake}
                  onChange={e => set({ mistake: e.target.value })}
                  placeholder="Off-by-one shrinking the window. Forgot the running max from the right."
                  className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--ev-orange)]/50"
                />
                <p className="mt-1 text-[10.5px] text-muted-foreground">
                  The highest-value thing to capture. Leave blank if nothing tripped you up.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  What did you learn?
                </label>
                <textarea
                  rows={3}
                  value={draft.learned}
                  onChange={e => set({ learned: e.target.value })}
                  placeholder="Sliding window works when the constraint is monotonic."
                  className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Note type</label>
                  <select
                    value={effectiveType}
                    onChange={e => { setTypeTouched(true); set({ type: e.target.value as NoteType }) }}
                    className="mt-1.5 h-9 w-full rounded-lg border border-input bg-surface-3 px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    {NOTE_TYPES.map(t => <option key={t} value={t}>{pretty(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground">Tags</label>
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    placeholder="dsa, sliding-window"
                    className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                </div>
              </div>

              {/* Also add to Interview Prep */}
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-[12px]">
                  <input
                    type="checkbox"
                    checked={addToInterviewPrep}
                    onChange={e => setAddToInterviewPrep(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-[var(--primary)]"
                  />
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                  Also add to Interview Prep
                </label>
                {addToInterviewPrep && (
                  <select
                    value={interviewTopic}
                    onChange={e => setInterviewTopic(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-surface-3 px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60"
                  >
                    {topics.map(t => <option key={t} value={t}>{topicLabel(t)}</option>)}
                  </select>
                )}
              </div>

              {/* Revision is opt-in, off by default. */}
              <button
                type="button"
                onClick={() => set({ scheduleRevision: !draft.scheduleRevision })}
                aria-pressed={draft.scheduleRevision}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left ring-1 transition',
                  draft.scheduleRevision
                    ? 'ring-primary'
                    : 'bg-surface-3 ring-border hover:ring-input'
                )}
                style={draft.scheduleRevision ? { background: 'var(--grad-selected)' } : undefined}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded ring-1 transition',
                    draft.scheduleRevision
                      ? 'bg-white text-primary ring-white'
                      : 'text-transparent ring-input'
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={4} />
                </span>
                <span className="min-w-0">
                  <span className={cn('block text-[12.5px] font-medium', draft.scheduleRevision && 'text-white')}>
                    Add to my revision queue
                  </span>
                  <span className={cn(
                    'mt-0.5 block text-[10.5px] leading-relaxed',
                    draft.scheduleRevision ? 'text-white/75' : 'text-muted-foreground'
                  )}>
                    Creates a spaced-repetition card due today, then 1, 3, 7, 14, 30 and 90 days out.
                  </span>
                </span>
              </button>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
              <p className="flex-1 text-[10.5px] text-muted-foreground">
                {needsTask
                  ? `${formatMinutes(pendingJournal.minutes)} logged. Skipping leaves it unnamed.`
                  : `Your ${formatMinutes(pendingJournal.minutes)} is already saved.`}
              </p>
              <button
                onClick={dismissJournal}
                className="rounded-lg px-3 py-2 text-[12.5px] text-muted-foreground transition hover:text-foreground"
              >
                Skip
              </button>
              <button
                onClick={save}
                disabled={!canSave || saving}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--grad-selected)' }}
              >
                <BookOpen className="h-3.5 w-3.5" />
                {saving
                  ? 'Saving…'
                  : needsTask
                    ? (empty ? 'Add task' : 'Add task and journal')
                    : existingNoteId ? 'Append to note' : 'Save to journal'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
