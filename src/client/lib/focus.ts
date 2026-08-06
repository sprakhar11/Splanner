/**
 * Pure focus-session maths, kept separate from the React hook so the rules
 * that decide what gets written to the database are testable on their own.
 */

export type FocusSnapshot = {
  /** Time banked from previous run segments. */
  accumulatedMs: number
  /** Epoch-ms the current segment started, or null while paused. */
  runningSince: number | null
}

/** Total elapsed time, deriving the live segment from the clock. */
export function elapsedMsOf(s: FocusSnapshot, now: number): number {
  const live = s.runningSince ? Math.max(0, now - s.runningSince) : 0
  return Math.max(0, s.accumulatedMs) + live
}

/**
 * Minutes to record for a session. Rounds to the nearest minute but never
 * returns 0, so a short-but-real session is still logged rather than vanishing.
 */
export function sessionMinutes(totalMs: number): number {
  return Math.max(1, Math.round(totalMs / 60_000))
}

/** Pausing banks the live segment and clears the running marker. */
export function pauseSnapshot(s: FocusSnapshot, now: number): FocusSnapshot {
  if (!s.runningSince) return s
  return { accumulatedMs: elapsedMsOf(s, now), runningSince: null }
}

/** Resuming starts a fresh segment, leaving banked time untouched. */
export function resumeSnapshot(s: FocusSnapshot, now: number): FocusSnapshot {
  if (s.runningSince) return s
  return { accumulatedMs: s.accumulatedMs, runningSince: now }
}

/** actualMinutes accumulates across sessions rather than overwriting. */
export function nextActualMinutes(prior: number | null | undefined, minutes: number): number {
  return (prior ?? 0) + minutes
}
