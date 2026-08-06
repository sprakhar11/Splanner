/**
 * Recurring task generation.
 *
 * Occurrences are MATERIALISED as real rows sharing a `seriesId`, rather than
 * computed on read. The schema already carries seriesId and a per-row date, and
 * real rows mean an individual occurrence can be edited, completed, timed, or
 * given its own subtasks without special-casing anything downstream.
 *
 * All date maths works directly on yyyy-MM-dd components, never through
 * Date.parse or toISOString, so results do not shift with the server timezone.
 */

export type Repeat = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'

/** How far ahead a series is kept populated. */
export const HORIZON_DAYS = 60

const pad = (n: number) => String(n).padStart(2, '0')

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

export function formatISO(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`
}

export function daysInMonth(y: number, m: number) {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Adds days to a yyyy-MM-dd string. */
export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseISO(iso)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return formatISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/**
 * Adds months, clamping the day to the target month's length.
 * Jan 31 + 1 month becomes Feb 28 (or 29 in a leap year) rather than spilling
 * into March, which is what a user picking "monthly on the 31st" expects.
 */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseISO(iso)
  const total = (y * 12) + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return formatISO(ny, nm, Math.min(d, daysInMonth(ny, nm)))
}

/** The next date in a series, or null when the task does not repeat. */
export function nextOccurrence(iso: string, repeat: Repeat): string | null {
  switch (repeat) {
    case 'DAILY': return addDays(iso, 1)
    case 'WEEKLY': return addDays(iso, 7)
    case 'MONTHLY': return addMonths(iso, 1)
    default: return null
  }
}

/** Inclusive comparison on yyyy-MM-dd strings, which sort lexicographically. */
const lte = (a: string, b: string) => a <= b

/**
 * Dates strictly after `from`, up to and including `until`.
 * `from` is the last date already materialised, so it is never re-emitted.
 */
export function occurrencesBetween(
  from: string,
  until: string,
  repeat: Repeat,
  cap = 400
): string[] {
  if (repeat === 'NONE') return []

  const out: string[] = []
  let cursor = from
  while (out.length < cap) {
    const next = nextOccurrence(cursor, repeat)
    if (!next || !lte(next, until)) break
    out.push(next)
    cursor = next
  }
  return out
}

/**
 * Dates needed to keep a series populated to the horizon.
 * `existing` are the dates already present for the series, so re-running this is
 * idempotent — the dedup is by (seriesId, date), never by title.
 */
export function missingOccurrences(
  seedDate: string,
  repeat: Repeat,
  existing: string[],
  today: string,
  horizonDays = HORIZON_DAYS
): string[] {
  if (repeat === 'NONE') return []

  const until = addDays(today, horizonDays)
  const have = new Set(existing)

  // Walk from the latest known date so a long-dormant series does not backfill
  // every missed day; it resumes on its own cadence.
  const latest = existing.length > 0
    ? existing.reduce((a, b) => (a > b ? a : b))
    : seedDate

  return occurrencesBetween(latest, until, repeat)
    .filter(d => !have.has(d))
}

export const REPEAT_LABEL: Record<Repeat, string> = {
  NONE: 'Never',
  DAILY: 'Every day',
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
}
