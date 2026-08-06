import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import {
  ChevronLeft, ChevronRight, CalendarDays, Check, Sparkles, Wand2, BookOpen,
} from 'lucide-react'
import { useReflection, useUpsertReflection } from '@client/hooks/useReflection'
import { useReflections, useStudySessions } from '@client/hooks/useAnalytics'
import { useTasks } from '@client/hooks/useTasks'
import { todayISO, addDaysISO, fromISO, formatMinutes } from '@client/lib/date'
import {
  dayActuals, initialReflectionForm, matchesActuals as formMatchesActuals,
  toReflectionPayload, DEFAULT_MOOD,
} from '@client/lib/reflection'
import { cn } from '@client/lib/utils'

const MOODS = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

const PROMPTS = {
  learnedSummary: {
    label: 'What did you learn?',
    hint: 'One concrete thing. Specific beats profound.',
    placeholder: 'Sliding window works when the constraint is monotonic…',
  },
  struggledSummary: {
    label: 'What did you struggle with?',
    hint: 'Naming it makes it a target for tomorrow.',
    placeholder: 'Kept confusing 0/1 and unbounded knapsack loop order…',
  },
  gratitude: {
    label: 'One good thing',
    hint: 'Optional, but the streak is easier to keep when today felt worth it.',
    placeholder: 'Paired with Anya and finally understood the FK error…',
  },
}

export default function Reflection() {
  const today = todayISO()
  const [date, setDate] = useState(today)

  const { data: existing, isLoading } = useReflection(date)
  const upsert = useUpsertReflection()
  const { data: allReflections = [] } = useReflections()
  const { data: sessions = [] } = useStudySessions({ from: date, to: date })
  const { data: dayTasks = [] } = useTasks({ from: date, to: date })

  /** What the app already knows about this day, so the user need not retype it. */
  const actuals = useMemo(
    () => dayActuals(sessions as any[], dayTasks as any[], date),
    [sessions, dayTasks, date]
  )

  const [form, setForm] = useState(() => initialReflectionForm(null, actuals))
  const [dirty, setDirty] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // Load the stored entry, or seed a new one from the day's real activity.
  useEffect(() => {
    setForm(initialReflectionForm(existing, actuals))
    setDirty(false)
    setJustSaved(false)
  }, [existing, date, actuals.completed, actuals.hours])

  const set = (k: string, v: any) => { setForm(f => ({ ...f, [k]: v })); setDirty(true) }

  const save = () => {
    upsert.mutate(
      toReflectionPayload(date, form),
      {
        onSuccess: () => {
          setDirty(false)
          setJustSaved(true)
          setTimeout(() => setJustSaved(false), 2200)
        },
      }
    )
  }

  const useActuals = () => {
    setForm(f => ({ ...f, tasksCompletedCount: actuals.completed, hoursStudied: actuals.hours }))
    setDirty(true)
  }

  const matchesActuals = formMatchesActuals(form, actuals)

  const written = new Set((allReflections as any[]).map(r => r.date))
  const recent = useMemo(
    () => (allReflections as any[])
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14),
    [allReflections]
  )

  const d = fromISO(date)
  const isToday = date === today
  const isFuture = date > today

  return (
    <div className="flex h-full gap-3">
      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[17px] font-semibold tracking-tight">Daily Reflection</h2>
              {written.has(date) && (
                <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--ev-green)_18%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--ev-green)]">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} /> written
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'long' })}
              {' · '}
              {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex items-center gap-0.5">
            <IconBtn onClick={() => setDate(today)} label="Jump to today">
              <CalendarDays className="h-3.5 w-3.5" />
            </IconBtn>
            <IconBtn onClick={() => setDate(addDaysISO(date, -1))} label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </IconBtn>
            <IconBtn
              onClick={() => setDate(addDaysISO(date, 1))}
              label="Next day"
              disabled={isToday}
            >
              <ChevronRight className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {isFuture ? (
            <p className="py-16 text-center text-[13px] text-muted-foreground">
              You cannot reflect on a day that has not happened yet.
            </p>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-3" />)}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Mood */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  How did the day feel?
                </label>
                <div className="mt-2 flex gap-2">
                  {MOODS.map(m => {
                    const active = Number(form.mood) === m.value
                    return (
                      <button
                        key={m.value}
                        onClick={() => set('mood', m.value)}
                        aria-pressed={active}
                        className={cn(
                          'flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 ring-1 transition',
                          active
                            ? 'ring-primary'
                            : 'ring-border hover:ring-input'
                        )}
                        style={active ? { background: 'var(--grad-selected)' } : { background: 'var(--surface-3)' }}
                      >
                        <span className="text-[19px] leading-none">{m.emoji}</span>
                        <span className={cn('text-[10.5px]', active ? 'text-white' : 'text-muted-foreground')}>
                          {m.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Metrics, prefilled from real activity */}
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    By the numbers
                  </label>
                  {!matchesActuals && (
                    <button
                      onClick={useActuals}
                      className="flex items-center gap-1 text-[11px] font-medium text-primary transition hover:underline"
                    >
                      <Wand2 className="h-3 w-3" />
                      Use tracked ({actuals.completed} tasks, {formatMinutes(actuals.minutes)})
                    </button>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2.5">
                  <NumberField
                    label="Tasks done"
                    value={form.tasksCompletedCount}
                    onChange={v => set('tasksCompletedCount', v)}
                    hint={`${actuals.completed} tracked`}
                  />
                  <NumberField
                    label="Hours studied"
                    value={form.hoursStudied}
                    step={0.5}
                    onChange={v => set('hoursStudied', v)}
                    hint={`${actuals.hours}h tracked`}
                  />
                  <NumberField
                    label="Problems solved"
                    value={form.problemsSolvedCount}
                    onChange={v => set('problemsSolvedCount', v)}
                    hint="entered manually"
                  />
                </div>
              </div>

              {/* Prompts */}
              {(Object.keys(PROMPTS) as (keyof typeof PROMPTS)[]).map(key => (
                <div key={key}>
                  <label className="text-[11px] font-medium text-muted-foreground">
                    {PROMPTS[key].label}
                  </label>
                  <textarea
                    rows={key === 'gratitude' ? 2 : 4}
                    value={form[key]}
                    onChange={e => set(key, e.target.value)}
                    placeholder={PROMPTS[key].placeholder}
                    className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <p className="mt-1 text-[10.5px] text-muted-foreground">{PROMPTS[key].hint}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save bar */}
        {!isFuture && (
          <div className="flex shrink-0 items-center gap-3 border-t border-border px-5 py-3">
            <p className="flex-1 text-[11px] text-muted-foreground">
              {justSaved
                ? 'Saved.'
                : dirty
                  ? 'Unsaved changes.'
                  : written.has(date)
                    ? 'Up to date.'
                    : 'Nothing written for this day yet.'}
            </p>
            <button
              onClick={save}
              disabled={!dirty || upsert.isPending}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
              style={{ background: 'var(--grad-selected)' }}
            >
              {justSaved ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Sparkles className="h-3.5 w-3.5" />}
              {upsert.isPending ? 'Saving…' : written.has(date) ? 'Update entry' : 'Save entry'}
            </button>
          </div>
        )}
      </section>

      {/* Recent entries */}
      <aside className="flex w-[280px] shrink-0 flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
        <div className="shrink-0 border-b border-border px-4 pb-3 pt-4">
          <h3 className="text-[14px] font-semibold leading-tight">Recent entries</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {allReflections.length} total
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[13px] font-medium">No entries yet</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Write today's and start the habit.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {recent.map(r => {
                const active = r.date === date
                const mood = MOODS.find(m => m.value === r.mood)
                  ?? MOODS.find(m => m.value === DEFAULT_MOOD)
                return (
                  <motion.button
                    key={r.date}
                    layout
                    onClick={() => setDate(r.date)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left ring-1 transition',
                      active ? 'ring-primary' : 'bg-surface-3 ring-border hover:ring-input'
                    )}
                    style={active ? { background: 'var(--grad-selected)' } : undefined}
                  >
                    <span className="text-[15px] leading-none">{mood?.emoji ?? '😐'}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[12px] font-medium', active && 'text-white')}>
                        {r.date === today ? 'Today' : fromISO(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className={cn('truncate text-[10.5px]', active ? 'text-white/70' : 'text-muted-foreground')}>
                        {r.learnedSummary?.trim() || 'No summary'}
                      </p>
                    </div>
                    <span className={cn('shrink-0 text-[10px] tabular-nums', active ? 'text-white/70' : 'text-muted-foreground')}>
                      {r.hoursStudied}h
                    </span>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function IconBtn({
  children, onClick, label, disabled,
}: { children: React.ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function NumberField({
  label, value, onChange, hint, step = 1,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  hint?: string
  step?: number
}) {
  return (
    <div className="rounded-xl bg-surface-3 p-2.5 ring-1 ring-border">
      <label className="text-[10.5px] text-muted-foreground">{label}</label>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 w-full bg-transparent text-[19px] font-semibold tabular-nums focus:outline-none"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
