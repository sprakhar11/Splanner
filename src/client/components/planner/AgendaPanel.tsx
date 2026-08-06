import { motion } from 'motion/react'
import {
  Clock, ChevronLeft, ChevronRight, CalendarDays, Check, Bell, AlertCircle, Play, Repeat2,
} from 'lucide-react'
import { cn } from '@client/lib/utils'
import { fromISO, PRIORITY_COLOR, timeLabel, formatMinutes } from '@client/lib/date'
import { useFocusTimer } from '@client/hooks/useFocusTimer'

interface Props {
  iso: string
  tasks: any[]
  onShift: (days: number) => void
  onToday: () => void
  onSelectTask: (id: string) => void
  onToggleTask: (id: string, done: boolean) => void
}

/** Groups tasks into pseudo time-slots so the timeline reads like the reference. */
function slotFor(task: any, index: number) {
  if (task.reminderAt) {
    const d = new Date(task.reminderAt)
    return `${String(d.getHours()).padStart(2, '0')}:00`
  }
  const base = 9 + index
  return `${String(Math.min(base, 21)).padStart(2, '0')}:00`
}

export default function AgendaPanel({
  iso, tasks, onShift, onToday, onSelectTask, onToggleTask,
}: Props) {
  const date = fromISO(iso)

  const groups = tasks.reduce<Record<string, any[]>>((acc, t, i) => {
    const slot = slotFor(t, i)
    ;(acc[slot] ??= []).push(t)
    return acc
  }, {})
  const slots = Object.keys(groups).sort()

  return (
    <aside className="flex w-[320px] shrink-0 flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight">Scheduled</h3>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={onToday} label="Jump to today"><CalendarDays className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn onClick={() => onShift(-1)} label="Previous day"><ChevronLeft className="h-4 w-4" /></IconBtn>
          <IconBtn onClick={() => onShift(1)} label="Next day"><ChevronRight className="h-4 w-4" /></IconBtn>
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Timeline */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[13px] font-medium">Nothing scheduled</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">Pick a day and add a task.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {slots.map(slot => (
              <div key={slot}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{slot}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  {groups[slot].map((t, i) => (
                    <EventCard
                      key={t.id}
                      task={t}
                      delay={i * 0.04}
                      onClick={() => onSelectTask(t.id)}
                      onToggle={() => onToggleTask(t.id, t.status !== 'COMPLETED')}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
    >
      {children}
    </button>
  )
}

function EventCard({
  task, delay, onClick, onToggle,
}: { task: any; delay: number; onClick: () => void; onToggle: () => void }) {
  const { start, session } = useFocusTimer()
  const done = task.status === 'COMPLETED'
  const color = PRIORITY_COLOR[task.priority] ?? 'var(--ev-teal)'
  const overdue = !!task.deadline && task.deadline < Date.now() && !done
  const isTiming = session?.taskId === task.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: done ? 0.6 : 1, y: 0 }}
      transition={{ duration: 0.2, delay, ease: 'easeOut' }}
      onClick={onClick}
      className="cursor-pointer overflow-hidden rounded-lg bg-surface-3 ring-1 ring-border transition hover:ring-primary/40"
    >
      {/* Colour bar */}
      <div className="h-[3px] w-full" style={{ background: color }} />

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={cn('truncate text-[13px] font-semibold leading-tight', done && 'line-through')}>
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{task.description}</p>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onToggle() }}
            aria-label={done ? 'Mark incomplete' : 'Mark complete'}
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 transition',
              done
                ? 'bg-primary text-primary-foreground ring-primary'
                : 'ring-input text-transparent hover:ring-primary hover:text-muted-foreground'
            )}
          >
            <Check className="h-3 w-3" strokeWidth={3} />
          </button>
        </div>

        {/* Reminder / overdue / recurrence markers */}
        {(task.reminderAt || overdue || task.seriesId) && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {task.reminderAt && (
              <span className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                <Bell className="h-2.5 w-2.5" />
                <span className="tabular-nums">{timeLabel(task.reminderAt)}</span>
              </span>
            )}
            {task.seriesId && (
              <span
                className="flex items-center gap-1 text-[10.5px] text-muted-foreground"
                title={`Repeats ${String(task.repeat ?? '').toLowerCase()}`}
              >
                <Repeat2 className="h-2.5 w-2.5" />
                {String(task.repeat ?? '').toLowerCase()}
              </span>
            )}
            {overdue && (
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-destructive">
                <AlertCircle className="h-2.5 w-2.5" />
                Overdue
              </span>
            )}
          </div>
        )}

        <div className="mt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{task.priority}</span>
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {task.actualMinutes ? `${formatMinutes(task.actualMinutes)} / ` : ''}
              {task.estimatedMinutes} min
            </span>
            {!done && (
              <button
                onClick={(e) => { e.stopPropagation(); if (!isTiming) start(task) }}
                disabled={isTiming}
                aria-label={isTiming ? 'Focus session running' : `Start focus session on ${task.title}`}
                title={isTiming ? 'Focus session running' : 'Start focus session'}
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-md transition',
                  isTiming
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                )}
              >
                <Play className="h-2.5 w-2.5" fill="currentColor" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
