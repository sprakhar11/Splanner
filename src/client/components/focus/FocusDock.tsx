import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import {
  Pause, Play, Square, X, Check, PictureInPicture, PictureInPicture2,
} from 'lucide-react'
import { useFocusTimer } from '@client/hooks/useFocusTimer'
import { useOptionalPictureInPicture } from '@client/hooks/usePictureInPicture'
import ClockFace from '@client/components/focus/ClockFace'
import { formatClock, formatMinutes } from '@client/lib/date'
import { cn } from '@client/lib/utils'

/**
 * Floating timer dock. Lives above the router so a session survives navigation.
 * The ring fills toward the task's estimate and turns amber once it runs over.
 */
export default function FocusDock() {
  const { session, elapsedMs, isRunning, pause, resume, stop, discard } = useFocusTimer()
  const { isSupported, pipWindow, popOut, close } = useOptionalPictureInPicture()

  /**
   * Title-bar clock. Works in every browser and stays visible in the tab strip
   * while the tab is backgrounded, so it covers the cases PiP cannot.
   */
  useEffect(() => {
    if (!session) return
    const base = 'Splanner'
    document.title = `${formatClock(displaySeconds)} · ${session.taskTitle ?? (isCountdown ? 'Timer' : 'Stopwatch')}`
    return () => { document.title = base }
  }, [session, elapsedMs])

  const elapsedMin = elapsedMs / 60_000
  const estimate = session?.estimatedMinutes || 30
  const isCountdown = !!session?.timerDurationMs
  const ratio = isCountdown
    ? Math.min(elapsedMs / session!.timerDurationMs!, 1)
    : Math.min(elapsedMin / estimate, 1)
  const over = !isCountdown && elapsedMin > estimate

  const R = 15
  const CIRC = 2 * Math.PI * R
  const ringColor = over ? 'var(--ev-orange)' : 'var(--primary)'

  // For countdown show remaining; for stopwatch show elapsed
  const displaySeconds = isCountdown
    ? Math.max(0, (session!.timerDurationMs! - elapsedMs) / 1000)
    : elapsedMs / 1000

  return (
    <AnimatePresence>
      {session && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.96 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          className="fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3
                     rounded-2xl bg-popover/95 px-3 py-2.5 shadow-2xl ring-1 ring-border backdrop-blur"
          role="region"
          aria-label="Focus timer"
        >
          {/* Progress ring + clock */}
          <div className="relative grid h-9 w-9 shrink-0 place-items-center">
            <svg className="absolute -rotate-90" width="36" height="36" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
              <motion.circle
                cx="18" cy="18" r={R} fill="none"
                stroke={ringColor} strokeWidth="3" strokeLinecap="round"
                strokeDasharray={CIRC}
                animate={{ strokeDashoffset: CIRC * (1 - ratio) }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </svg>
            <span
              className={cn('h-1.5 w-1.5 rounded-full', isRunning && 'animate-pulse')}
              style={{ background: ringColor }}
            />
          </div>

          <div className="min-w-0">
            <p
              className={cn(
                'max-w-[190px] truncate text-[12.5px] font-semibold leading-tight',
                !session.taskTitle && 'italic text-muted-foreground'
              )}
            >
              {session.taskTitle ?? (isCountdown ? 'Timer' : 'Stopwatch')}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              <span className="tabular-nums">{formatClock(displaySeconds)}</span>
              {isCountdown
                ? <span className="mx-1.5 opacity-50">remaining</span>
                : <>
                    <span className="mx-1.5 opacity-50">/</span>
                    <span className="tabular-nums">{formatMinutes(estimate)}</span>
                  </>}
              {over && <span className="ml-1.5 text-[var(--ev-orange)]">over</span>}
              {!isRunning && <span className="ml-1.5">paused</span>}
            </p>
          </div>

          <div className="ml-1 flex items-center gap-1">
            {/* Pop out / back in. Hidden where Document PiP is unavailable. */}
            {isSupported && (
              <DockBtn
                onClick={() => (pipWindow ? close() : void popOut())}
                label={pipWindow ? 'Close the floating clock' : 'Float the clock above other windows'}
              >
                {pipWindow
                  ? <PictureInPicture2 className="h-3.5 w-3.5" />
                  : <PictureInPicture className="h-3.5 w-3.5" />}
              </DockBtn>
            )}

            {isRunning ? (
              <DockBtn onClick={pause} label="Pause timer">
                <Pause className="h-3.5 w-3.5" />
              </DockBtn>
            ) : (
              <DockBtn onClick={resume} label="Resume timer">
                <Play className="h-3.5 w-3.5" />
              </DockBtn>
            )}

            <DockBtn onClick={() => stop()} label="Stop and log time">
              <Square className="h-3.5 w-3.5" />
            </DockBtn>

            {/* Nothing to complete until the session is bound to a task. */}
            {session.taskId && (
              <DockBtn
                onClick={() => stop({ markComplete: true })}
                label="Log time and complete task"
                tone="primary"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </DockBtn>
            )}

            <DockBtn onClick={discard} label="Discard session without logging" tone="danger">
              <X className="h-3.5 w-3.5" />
            </DockBtn>
          </div>

          {/* Portalled into the floating window. Declared here, so it keeps this
              provider tree's context and needs no state of its own. */}
          {pipWindow && createPortal(<ClockFace />, pipWindow.document.body)}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function DockBtn({
  children, onClick, label, tone = 'default',
}: {
  children: React.ReactNode
  onClick: () => void
  label: string
  tone?: 'default' | 'primary' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-lg transition',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:opacity-90',
        tone === 'danger' && 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
        tone === 'default' && 'bg-surface-3 text-muted-foreground hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
