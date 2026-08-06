import { motion } from 'motion/react'
import { Pause, Play, Square, Check } from 'lucide-react'
import { useFocusTimer } from '@client/hooks/useFocusTimer'
import { formatClock, formatMinutes } from '@client/lib/date'
import { cn } from '@client/lib/utils'

/**
 * The floating clock, rendered into the Picture-in-Picture window via a portal.
 *
 * Declared inside the provider tree, so it reads the same timer context as the
 * dock. There is no second copy of the state and nothing to keep in sync.
 */
export default function ClockFace() {
  const { session, elapsedMs, isRunning, pause, resume, stop } = useFocusTimer()
  if (!session) return null

  const isCountdown = !!session.timerDurationMs
  const elapsedMin = elapsedMs / 60_000
  const estimate = session.estimatedMinutes || 30
  const ratio = isCountdown
    ? Math.min(elapsedMs / session.timerDurationMs!, 1)
    : Math.min(elapsedMin / estimate, 1)
  const over = !isCountdown && elapsedMin > estimate
  const accent = over ? 'var(--ev-orange)' : 'var(--primary)'

  // For countdown, show remaining time; for stopwatch, show elapsed
  const displaySeconds = isCountdown
    ? Math.max(0, (session.timerDurationMs! - elapsedMs) / 1000)
    : elapsedMs / 1000

  const R = 52
  const CIRC = 2 * Math.PI * R

  return (
    <div className="flex h-full w-full select-none flex-col items-center justify-center gap-2 bg-surface px-4 py-3 text-foreground">
      {/* Ring + clock */}
      <div className="relative grid place-items-center">
        <svg className="-rotate-90" width="124" height="124" viewBox="0 0 124 124">
          <circle cx="62" cy="62" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="7" />
          <motion.circle
            cx="62" cy="62" r={R}
            fill="none" stroke={accent} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={CIRC}
            animate={{ strokeDashoffset: CIRC * (1 - ratio) }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </svg>

        <div className="absolute flex flex-col items-center">
          <span className="text-[26px] font-semibold leading-none tabular-nums">
            {formatClock(displaySeconds)}
          </span>
          <span className="mt-1 text-[10px] text-muted-foreground">
            {isCountdown ? 'remaining' : `of ${formatMinutes(estimate)}`}
            {over && <span className="ml-1 text-[var(--ev-orange)]">over</span>}
          </span>
        </div>
      </div>

      {/* Task, or a placeholder for a stopwatch/timer that is not bound to one yet */}
      <p
        className={cn(
          'max-w-full truncate text-center text-[12px] font-medium',
          !session.taskTitle && 'italic text-muted-foreground'
        )}
      >
        {session.taskTitle ?? (isCountdown ? 'Timer' : 'Stopwatch')}
      </p>
      {!isRunning && (
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">paused</p>
      )}

      {/* Controls. A floating window with no controls would force a trip back
          to the tab just to stop the clock. */}
      <div className="flex items-center gap-1.5">
        {isRunning ? (
          <FaceBtn onClick={pause} label="Pause timer"><Pause className="h-3.5 w-3.5" /></FaceBtn>
        ) : (
          <FaceBtn onClick={resume} label="Resume timer"><Play className="h-3.5 w-3.5" /></FaceBtn>
        )}
        <FaceBtn onClick={() => stop()} label="Stop and log time">
          <Square className="h-3.5 w-3.5" />
        </FaceBtn>
        {/* Nothing to complete until the session is bound to a task. */}
        {session.taskId && (
          <FaceBtn onClick={() => stop({ markComplete: true })} label="Log time and complete task" tone="primary">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </FaceBtn>
        )}
      </div>
    </div>
  )
}

function FaceBtn({
  children, onClick, label, tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  tone?: 'default' | 'primary'
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-lg transition',
        tone === 'primary'
          ? 'bg-primary text-primary-foreground hover:opacity-90'
          : 'bg-surface-3 text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
