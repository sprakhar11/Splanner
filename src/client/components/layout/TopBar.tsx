import { Search, Bell, Timer, Clock } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '@client/hooks/useSettings'
import { useCommandPalette } from '@client/hooks/useCommandPalette'
import { useFocusTimer } from '@client/hooks/useFocusTimer'
import { useTasks } from '@client/hooks/useTasks'
import { todayISO, addDaysISO } from '@client/lib/date'

function greetingFor(hour: number) {
  if (hour < 12) return 'Morning'
  if (hour < 17) return 'Afternoon'
  return 'Evening'
}

/** Platform-correct modifier for the shortcut hint. */
const modKey =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? '\u2318'
    : 'Ctrl+'

export default function TopBar({ subtitle }: { subtitle?: string }) {
  const { data: settings } = useSettings()
  const { open } = useCommandPalette()
  const { session, start } = useFocusTimer()
  const navigate = useNavigate()
  const name = settings?.userName || 'there'
  const greeting = greetingFor(new Date().getHours())

  // The dot shows when there are overdue tasks (deadline passed, not completed).
  const today = todayISO()
  const { data: nearbyTasks = [] } = useTasks({ from: addDaysISO(today, -7), to: today })
  const overdueCount = (nearbyTasks as any[]).filter(
    t => t.deadline && t.deadline < Date.now() && t.status !== 'COMPLETED'
  ).length

  return (
    <header className="flex items-center justify-between gap-6 px-2 pb-5 pt-1">
      <div>
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight">
          {greeting}, {name}!
        </h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {subtitle ?? "Here's what's on your agenda today."}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Opens the command palette rather than being a second search field. */}
        <button
          onClick={open}
          aria-label="Search everything (Command K)"
          className="group flex h-10 w-[280px] items-center gap-2.5 rounded-full bg-surface-2 pl-4 pr-2
                     text-[13px] ring-1 ring-border transition hover:ring-primary/40
                     focus:outline-none focus:ring-2 focus:ring-primary/60"
        >
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 text-left text-muted-foreground">Search everything</span>
          <kbd className="shrink-0 rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {modKey}K
          </kbd>
        </button>

        {/* General stopwatch/timer: start timing now, name the work when you stop. */}
        {!session && (
          <TimerStartButtons start={start} />
        )}

        <button
          onClick={() => navigate('/planner')}
          aria-label={overdueCount > 0 ? `${overdueCount} overdue — open planner` : 'No overdue tasks'}
          title={overdueCount > 0 ? `${overdueCount} overdue task${overdueCount > 1 ? 's' : ''}` : 'No overdue tasks'}
          className="relative grid h-10 w-10 place-items-center rounded-full bg-surface-2 ring-1 ring-border
                     text-muted-foreground transition hover:text-foreground hover:bg-surface-3"
        >
          <Bell className="h-[17px] w-[17px]" />
          {overdueCount > 0 && (
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-surface-2" />
          )}
        </button>
      </div>
    </header>
  )
}

function TimerStartButtons({ start }: { start: (task?: any, opts?: { durationMs?: number }) => void }) {
  const [showTimer, setShowTimer] = useState(false)
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(25)

  const startTimer = () => {
    const totalMs = (hours * 60 + minutes) * 60_000
    if (totalMs <= 0) return
    start(undefined, { durationMs: totalMs })
    setShowTimer(false)
  }

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => start()}
        aria-label="Start a stopwatch"
        title="Start a stopwatch — counts up, name the task when you stop"
        className="flex h-10 items-center gap-2 rounded-l-full bg-surface-2 pl-4 pr-3 text-[13px] font-medium
                   text-muted-foreground ring-1 ring-border transition hover:text-foreground
                   hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
      >
        <Timer className="h-4 w-4" />
        Stopwatch
      </button>
      <button
        onClick={() => setShowTimer(!showTimer)}
        aria-label="Start a countdown timer"
        title="Start a countdown timer with a set duration"
        className="flex h-10 items-center gap-2 rounded-r-full bg-surface-2 pr-4 pl-3 text-[13px] font-medium
                   text-muted-foreground ring-1 ring-border transition hover:text-foreground
                   hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/60"
      >
        <Clock className="h-4 w-4" />
        Timer
      </button>

      {showTimer && (
        <div className="absolute right-0 top-12 z-50 flex items-center gap-2 rounded-xl bg-popover p-3 shadow-xl ring-1 ring-border">
          <input
            type="number"
            min={0}
            max={23}
            value={hours}
            onChange={e => setHours(Math.max(0, Math.min(23, Number(e.target.value))))}
            className="h-8 w-12 rounded-md border border-input bg-background px-1.5 text-center text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <span className="text-[12px] text-muted-foreground">h</span>
          <span className="text-[14px] text-muted-foreground">:</span>
          <input
            type="number"
            min={0}
            max={59}
            value={minutes}
            onChange={e => setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
            className="h-8 w-12 rounded-md border border-input bg-background px-1.5 text-center text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <span className="text-[12px] text-muted-foreground">m</span>
          <button
            onClick={startTimer}
            disabled={hours === 0 && minutes === 0}
            className="ml-1 flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--grad-selected)' }}
          >
            Start
          </button>
        </div>
      )}
    </div>
  )
}
