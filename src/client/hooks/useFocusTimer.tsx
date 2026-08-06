import {
  createContext, useContext, useCallback, useEffect, useRef, useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@client/api/client'
import { todayISO } from '@client/lib/date'
import {
  elapsedMsOf, sessionMinutes, pauseSnapshot, resumeSnapshot, nextActualMinutes,
} from '@client/lib/focus'
import { shouldPromptJournal } from '@client/lib/journal'
import { useOptionalPictureInPicture } from '@client/hooks/usePictureInPicture'
import { useSettings } from '@client/hooks/useSettings'
import { readSetting } from '@client/lib/settings'

const STORAGE_KEY = 'splanner.focus'

/**
 * Persisted timer state. `accumulatedMs` holds time from previous run segments,
 * `runningSince` is the epoch-ms the current segment started (null while paused).
 * Elapsed is derived, never stored, so wall-clock time keeps counting across a refresh.
 */
type FocusState = {
  /** Null for a general stopwatch started without picking a task first. */
  taskId: string | null
  taskTitle: string | null
  categoryId: string | null
  estimatedMinutes: number
  accumulatedMs: number
  runningSince: number | null
  /** If set, this is a countdown timer (duration in ms). Null = stopwatch (count up). */
  timerDurationMs: number | null
}

/** A committed session, handed to the journal sheet after the write succeeds. */
export type SessionResult = {
  taskId: string | null
  taskTitle: string | null
  categoryId: string | null
  minutes: number
  completed: boolean
  /** Lets the sheet re-point the logged time once a task is named. */
  studySessionId: string | null
}

type FocusContextValue = {
  session: FocusState | null
  elapsedMs: number
  isRunning: boolean
  /** True when the countdown has reached zero. */
  isTimerComplete: boolean
  /** Pass a task to time it, or omit for a general stopwatch/timer. */
  start: (task?: any, opts?: { durationMs?: number }) => void
  pause: () => void
  resume: () => void
  /**
   * Persists elapsed minutes and the study session, THEN returns the summary.
   * The journal prompt is downstream of the write, never a precondition for it.
   */
  stop: (opts?: { markComplete?: boolean }) => Promise<SessionResult | null>
  discard: () => void
  /** Set once a committed session clears the prompt threshold. */
  pendingJournal: SessionResult | null
  dismissJournal: () => void
}

const FocusContext = createContext<FocusContextValue | null>(null)

function load(): FocusState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // A general session has taskId null, so presence of the key is the test,
    // not its type. Requiring a string here used to drop untitled sessions.
    return parsed && 'taskId' in parsed && typeof parsed.accumulatedMs === 'number'
      ? parsed
      : null
  } catch {
    return null
  }
}

function save(s: FocusState | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable — timer still works for this session */
  }
}

const elapsedOf = elapsedMsOf

export function FocusTimerProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()
  const { data: settings } = useSettings()
  // Optional: without the provider (or on a browser lacking PiP) these no-op.
  const { popOut, close: closePip } = useOptionalPictureInPicture()

  const [session, setSession] = useState<FocusState | null>(load)
  const [now, setNow] = useState(() => Date.now())
  const [pendingJournal, setPendingJournal] = useState<SessionResult | null>(null)

  const autoPopOut = readSetting(settings, 'focusPopOut')
  const defaultLength = readSetting(settings, 'pomodoroMinutes')

  // Only tick while a segment is actually running.
  const isRunning = !!session?.runningSince
  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  // Keep the latest session in a ref so the unload handler never sees a stale value.
  const sessionRef = useRef(session)
  sessionRef.current = session

  useEffect(() => {
    save(session)
  }, [session])

  const start = useCallback((task?: any, opts?: { durationMs?: number }) => {
    setNow(Date.now())
    const durationMs = opts?.durationMs ?? null
    setSession({
      taskId: task?.id ?? null,
      taskTitle: task?.title ?? null,
      categoryId: task?.categoryId ?? null,
      estimatedMinutes: durationMs
        ? Math.ceil(durationMs / 60_000)
        : (task?.estimatedMinutes ?? defaultLength),
      accumulatedMs: 0,
      runningSince: Date.now(),
      timerDurationMs: durationMs,
    })

    // Float the clock now, while the click that got us here still counts as
    // user activation. Waiting until the tab blurs would be too late.
    if (autoPopOut) void popOut()

    // Reflect that work has begun. Nothing to mark for a general stopwatch.
    if (task?.id) {
      api.tasks.update(task.id, { status: 'IN_PROGRESS' })
        .then(() => qc.invalidateQueries({ queryKey: ['tasks'] }))
        .catch(() => { /* non-fatal: the timer is the source of truth */ })
    }
  }, [qc, autoPopOut, popOut, defaultLength])

  const pause = useCallback(() => {
    setSession(s => (s ? { ...s, ...pauseSnapshot(s, Date.now()) } : s))
  }, [])

  const resume = useCallback(() => {
    setNow(Date.now())
    setSession(s => (s ? { ...s, ...resumeSnapshot(s, Date.now()) } : s))
  }, [])

  const discard = useCallback(() => {
    setSession(null)
    closePip()
  }, [closePip])

  const dismissJournal = useCallback(() => setPendingJournal(null), [])

  const stop = useCallback(async (opts?: { markComplete?: boolean }) => {
    const s = sessionRef.current
    if (!s) return null

    const minutes = sessionMinutes(elapsedOf(s, Date.now()))

    setSession(null)
    closePip()

    let studySessionId: string | null = null

    try {
      // Only a session bound to a task can accumulate against one. A general
      // stopwatch has nothing to update yet; the sheet creates the task.
      if (s.taskId) {
        // actualMinutes accumulates across sessions, so read the current value first.
        const task = await api.tasks.get(s.taskId).catch(() => null)

        await api.tasks.update(s.taskId, {
          actualMinutes: nextActualMinutes(task?.actualMinutes, minutes),
          status: opts?.markComplete ? 'COMPLETED' : 'IN_PROGRESS',
        })
      }

      // Logged either way, so the time survives even if the sheet is dismissed.
      const logged = await api.studySessions.create({
        date: todayISO(),
        minutes,
        categoryId: s.categoryId,
        taskId: s.taskId,
        note: s.taskTitle ? `Focus session: ${s.taskTitle}` : 'Untitled focus session',
      })
      studySessionId = logged?.id ?? null
    } finally {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['studySessions'] })
    }

    const result: SessionResult = {
      taskId: s.taskId,
      taskTitle: s.taskTitle,
      categoryId: s.categoryId,
      minutes,
      completed: !!opts?.markComplete,
      studySessionId,
    }

    // Only now, with the time safely recorded, offer to write it up. Dismissing
    // or closing the sheet cannot cost the user their tracked time.
    if (shouldPromptJournal(minutes, { hasTask: !!s.taskId })) setPendingJournal(result)

    return result
  }, [qc, closePip])

  const elapsedMs = session ? elapsedOf(session, now) : 0
  const isTimerComplete = !!(session?.timerDurationMs && elapsedMs >= session.timerDurationMs)

  // Auto-stop when the countdown finishes.
  useEffect(() => {
    if (isTimerComplete && session?.runningSince) {
      stop()
    }
  }, [isTimerComplete])

  return (
    <FocusContext.Provider
      value={{
        session, elapsedMs, isRunning, isTimerComplete, start, pause, resume, stop, discard,
        pendingJournal, dismissJournal,
      }}
    >
      {children}
    </FocusContext.Provider>
  )
}

export function useFocusTimer() {
  const ctx = useContext(FocusContext)
  if (!ctx) throw new Error('useFocusTimer must be used inside <FocusTimerProvider>')
  return ctx
}
