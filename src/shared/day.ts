/**
 * The logical day boundary, shared by the client and the server.
 *
 * Splanner lets the user decide when their day ends (the `rolloverHour` setting,
 * 0–6). Someone who studies until 2 AM does not want their unfinished tasks
 * swept away, or their habit plants starting to wilt, at midnight.
 *
 * This module is the single definition of that boundary. It has to be shared:
 * the server needs it to decide when to roll tasks forward, and the client needs
 * it to decide which day a habit log belongs to. Two implementations would drift,
 * and the symptom would be the same action landing on different days depending on
 * which feature you were using.
 *
 * Deliberately dependency-free so both sides can import it.
 *
 * Note this is *not* a general-purpose date library. `src/client/lib/date.ts`
 * handles calendar rendering, which correctly uses plain wall-clock dates — a
 * grid cell for the 17th is the 17th regardless of when the user's day ends.
 */

/** Lowest and highest hour the boundary may be set to. Matches the settings range. */
export const MIN_ROLLOVER_HOUR = 0
export const MAX_ROLLOVER_HOUR = 6

const pad = (n: number) => String(n).padStart(2, '0')

/** Formats a Date as yyyy-MM-dd in local time. */
export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Coerces a stored setting into a usable hour.
 *
 * Settings are persisted as text, so this has to survive an empty string, a
 * non-numeric value, or a number outside the supported range. Anything
 * unusable falls back to midnight, which is the pre-feature behaviour.
 */
export function clampRolloverHour(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.min(MAX_ROLLOVER_HOUR, Math.max(MIN_ROLLOVER_HOUR, Math.floor(n)))
}

/**
 * The current logical day as yyyy-MM-dd.
 *
 * Before the cutoff hour the user's previous day has not ended yet, so the date
 * reads as yesterday. With `rolloverHour: 0` this is plain wall-clock.
 *
 * `now` is injectable so the behaviour either side of the cutoff is testable
 * without touching the system clock.
 */
export function logicalToday(rolloverHour: unknown, now: Date = new Date()): string {
  const hour = clampRolloverHour(rolloverHour)
  // Copy rather than mutate: callers may hold a reference to `now`.
  const d = new Date(now.getTime())
  if (hour > 0 && d.getHours() < hour) {
    d.setDate(d.getDate() - 1)
  }
  return toISO(d)
}

/** True when the given yyyy-MM-dd is the current logical day. */
export function isLogicalToday(
  iso: string,
  rolloverHour: unknown,
  now: Date = new Date()
): boolean {
  return iso === logicalToday(rolloverHour, now)
}

/**
 * Whole days from `from` to `to`. Negative when `to` is earlier.
 *
 * Both are parsed as UTC midnight rather than local, so a daylight-saving
 * transition inside the range cannot turn a 1-day gap into 0.96 of one.
 */
export function daysBetween(from: string, to: string): number {
  return Math.round((utcMs(to) - utcMs(from)) / 86_400_000)
}

/** Adds days to a yyyy-MM-dd string, staying in the calendar domain. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const shifted = new Date(y, m - 1, d + days)
  return toISO(shifted)
}

function utcMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
