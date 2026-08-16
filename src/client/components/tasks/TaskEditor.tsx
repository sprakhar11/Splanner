import { useState, useEffect } from 'react'
import { Bell, CalendarClock, Play, X, Repeat2, Briefcase } from 'lucide-react'
import { Button, Input } from '@client/components/ui'
import SubtaskList from '@client/components/tasks/SubtaskList'
import { useCategories } from '@client/hooks/useCategories'
import { useSettings } from '@client/hooks/useSettings'
import { useFocusTimer } from '@client/hooks/useFocusTimer'
import { readSetting, isTabEnabled } from '@client/lib/settings'
import { api } from '@client/api/client'
import { toLocalInput, fromLocalInput, atTimeOn, relativeTime, formatMinutes } from '@client/lib/date'
import { cn } from '@client/lib/utils'

interface TaskEditorProps {
  task?: any
  date: string
  onSave: (data: any) => void
  onClose: () => void
}

const PRIORITIES = [
  { value: 'P1', label: 'P1 · Urgent', dot: 'bg-red-500' },
  { value: 'P2', label: 'P2 · High', dot: 'bg-orange-500' },
  { value: 'P3', label: 'P3 · Medium', dot: 'bg-yellow-500' },
  { value: 'P4', label: 'P4 · Low', dot: 'bg-zinc-500' },
]

const REPEATS = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const

/** Mirrors REPEAT_LABEL in the server's recurrence service. */
const REPEAT_LABEL: Record<string, string> = {
  NONE: 'Never',
  DAILY: 'Every day',
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
}

/** Matches HORIZON_DAYS in src/server/services/recurrence.ts. */
const HORIZON_DAYS = 60

const DEFAULT_TOPICS = ['DSA', 'SYSTEM_DESIGN', 'LLD']

function useTopics(settings: any) {
  let parsed: string[] = []
  try { parsed = settings?.interviewTopics ? JSON.parse(settings.interviewTopics) : [] } catch {}
  return parsed.length > 0 ? parsed : DEFAULT_TOPICS
}

function topicLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/** One-tap reminder offsets, relative to the task's own date at 09:00. */
const REMINDER_PRESETS = [
  { label: 'Morning', time: '09:00' },
  { label: 'Midday', time: '12:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Night', time: '21:00' },
]

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

const selectClass =
  'w-full h-9 rounded-md border border-input bg-background px-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Form state for a task, or the defaults for a new one. */
function buildForm(task: any, date: string, defaultEstimate: number) {
  return {
    title: task?.title || '',
    description: task?.description || '',
    priority: task?.priority || 'P3',
    categoryId: task?.categoryId || '',
    estimatedMinutes: task?.estimatedMinutes || defaultEstimate,
    repeat: task?.repeat || 'NONE',
    date: task?.date || date,
    tags: task?.tags?.join(', ') || '',
    deadline: toLocalInput(task?.deadline),
    reminderAt: toLocalInput(task?.reminderAt),
    addToInterviewPrep: false,
    interviewTopic: 'DSA',
  }
}

export default function TaskEditor({ task, date, onSave, onClose }: TaskEditorProps) {
  const { data: categories } = useCategories()
  const { data: settings } = useSettings()
  const { start, session } = useFocusTimer()

  // A new task inherits the configured focus length as its estimate.
  const defaultEstimate = readSetting(settings, 'pomodoroMinutes')
  const topics = useTopics(settings)

  // Seeded eagerly rather than only in the effect below, so the very first
  // render already shows the task's own values instead of flashing defaults.
  const [form, setForm] = useState(() => buildForm(task, date, defaultEstimate))
  // Track revision opt-in separately for clarity in the UI.
  const [scheduleRevision, setScheduleRevision] = useState(true)

  useEffect(() => {
    setForm(buildForm(task, date, defaultEstimate))
  }, [task, date, defaultEstimate])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const payload = {
      ...form,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      estimatedMinutes: Number(form.estimatedMinutes),
      deadline: fromLocalInput(form.deadline),
      reminderAt: fromLocalInput(form.reminderAt),
    }

    // Fire-and-forget: also create an interview prep item if opted in.
    // Pass the task data along; the interview item will be linked once the task is created.
    if (form.addToInterviewPrep && form.title.trim()) {
      payload.addToInterviewPrep = true
      payload.interviewTopic = form.interviewTopic
      payload.scheduleRevision = scheduleRevision
    }

    onSave(payload)
  }

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  const applyPreset = (time: string) => {
    const ms = atTimeOn(form.date, time)
    if (ms) set('reminderAt', toLocalInput(ms))
  }

  const deadlineMs = fromLocalInput(form.deadline)
  const reminderMs = fromLocalInput(form.reminderAt)
  const isTimingThisTask = session?.taskId === task?.id

  return (
    <form onSubmit={submit} className="space-y-5 p-4">
      <Input
        placeholder="What needs doing?"
        value={form.title}
        onChange={(e) => set('title', e.target.value)}
        autoFocus
        className="h-10 text-sm font-medium"
      />

      <textarea
        placeholder="Add detail (optional)"
        value={form.description}
        onChange={(e) => set('description', e.target.value)}
        rows={3}
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Priority">
          <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={selectClass}>
            {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>

        <Field label="Category">
          <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={selectClass}>
            <option value="">None</option>
            {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>

        <Field label="Estimate">
          <div className="relative">
            <Input
              type="number"
              value={form.estimatedMinutes}
              onChange={(e) => set('estimatedMinutes', Number(e.target.value))}
              min={5}
              step={5}
              className="pr-10 tabular-nums"
            />
            <span className="absolute right-3 top-2 text-xs text-muted-foreground">min</span>
          </div>
        </Field>

        <Field
          label="Repeat"
          hint={
            form.repeat === 'NONE'
              ? undefined
              : task?.seriesId
                ? 'Part of a series'
                : 'Creates future occurrences'
          }
        >
          <select value={form.repeat} onChange={(e) => set('repeat', e.target.value)} className={selectClass}>
            {REPEATS.map(r => (
              <option key={r} value={r}>{REPEAT_LABEL[r]}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Explain what a repeat rule will actually do before it happens. */}
      {form.repeat !== 'NONE' && (
        <div className="flex items-start gap-2 rounded-lg bg-surface-3 px-3 py-2.5 ring-1 ring-border">
          <Repeat2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {task?.seriesId ? (
              <>
                This is one occurrence in a series. Editing it changes only this day.
                Changing the repeat rule regenerates upcoming occurrences.
              </>
            ) : (
              <>
                Saving generates occurrences {REPEAT_LABEL[form.repeat].toLowerCase()} for the
                next {HORIZON_DAYS} days. Each one is a separate task you can complete or edit
                on its own.
              </>
            )}
          </p>
        </div>
      )}

      <Field label="Date">
        <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} />
      </Field>

      {/* Reminder */}
      <Field
        label="Reminder"
        hint={reminderMs ? `Alerts ${relativeTime(reminderMs)}` : 'Optional. Splanner alerts you while it is open.'}
      >
        <div className="space-y-2">
          <div className="relative">
            <Input
              type="datetime-local"
              value={form.reminderAt}
              onChange={(e) => set('reminderAt', e.target.value)}
              className="pr-9"
            />
            {form.reminderAt ? (
              <button
                type="button"
                onClick={() => set('reminderAt', '')}
                aria-label="Clear reminder"
                className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded text-muted-foreground transition hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Bell className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>

          <div className="flex gap-1.5">
            {REMINDER_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.time)}
                className="flex-1 rounded-md bg-surface-3 py-1.5 text-[11px] text-muted-foreground ring-1 ring-border transition hover:text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Field>

      {/* Deadline */}
      <Field
        label="Deadline"
        hint={
          deadlineMs
            ? deadlineMs < Date.now()
              ? `Overdue by ${relativeTime(deadlineMs).replace(' ago', '')}`
              : `Due ${relativeTime(deadlineMs)}`
            : 'Optional. Drives the overdue badge.'
        }
      >
        <div className="relative">
          <Input
            type="datetime-local"
            value={form.deadline}
            onChange={(e) => set('deadline', e.target.value)}
            className={cn('pr-9', deadlineMs && deadlineMs < Date.now() && 'border-destructive/60')}
          />
          {form.deadline ? (
            <button
              type="button"
              onClick={() => set('deadline', '')}
              aria-label="Clear deadline"
              className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded text-muted-foreground transition hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <CalendarClock className="pointer-events-none absolute right-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          )}
        </div>
      </Field>

      <Field label="Tags" hint="Separate with commas">
        <Input placeholder="dsa, arrays, two-pointers" value={form.tags} onChange={(e) => set('tags', e.target.value)} />
      </Field>

      {/* Only a saved task has an id to hang subtasks off. */}
      {task?.id && <SubtaskList taskId={task.id} />}

      {/* Also add to Interview Prep — for new tasks, not when editing an existing one.
          Hidden entirely when Interview Prep is disabled in settings. */}
      {!task && isTabEnabled(settings, 'interview') && (
        <div className="space-y-2.5 rounded-lg bg-surface-3 p-3 ring-1 ring-border">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium">
            <input
              type="checkbox"
              checked={form.addToInterviewPrep}
              onChange={e => set('addToInterviewPrep', e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-[var(--primary)]"
            />
            <Briefcase className="h-3 w-3 text-muted-foreground" />
            Add to Interview Prep
          </label>
          {form.addToInterviewPrep && (
            <div className="ml-5 space-y-2">
              <select
                value={form.interviewTopic}
                onChange={e => set('interviewTopic', e.target.value)}
                className={selectClass}
              >
                {topics.map(t => <option key={t} value={t}>{topicLabel(t)}</option>)}
              </select>
              {isTabEnabled(settings, 'revise') && (
                <label className="flex cursor-pointer items-center gap-2 text-[11.5px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={scheduleRevision}
                    onChange={e => setScheduleRevision(e.target.checked)}
                    className="h-3.5 w-3.5 rounded accent-[var(--primary)]"
                  />
                  Mark for revision
                  <span className="text-[10px] opacity-60">(spaced repetition after completion)</span>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {/* Time tracked so far, plus a way to start a session on a saved task */}
      {task && (
        <div className="flex items-center justify-between rounded-lg bg-surface-3 px-3 py-2.5 ring-1 ring-border">
          <div>
            <p className="text-[11px] text-muted-foreground">Time tracked</p>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums">
              {task.actualMinutes ? formatMinutes(task.actualMinutes) : 'Not started'}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                of {formatMinutes(form.estimatedMinutes)}
              </span>
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant={isTimingThisTask ? 'ghost' : 'default'}
            disabled={isTimingThisTask}
            onClick={() => { start({ ...task, estimatedMinutes: Number(form.estimatedMinutes) }); onClose() }}
            className="h-8 text-[12px]"
          >
            <Play className="h-3.5 w-3.5" />
            {isTimingThisTask ? 'Running' : 'Focus'}
          </Button>
        </div>
      )}

      {/* Sticks to the bottom of the scrolling body so it stays reachable */}
      <div className="sticky -bottom-4 -mx-4 flex gap-2 bg-popover px-4 pb-4 pt-3">
        <Button type="submit" className="flex-1" disabled={!form.title.trim()}>
          {task ? 'Save changes' : 'Create task'}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  )
}
