/** Streak and time-series helpers over yyyy-MM-dd activity data. */

const pad = (n: number) => String(n).padStart(2, '0')

function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shift(isoDate: string, days: number) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return iso(d)
}

export type Streaks = {
  /** Days up to and including today (or yesterday, if today is not yet logged). */
  current: number
  longest: number
  totalActiveDays: number
}

/**
 * A streak stays alive if today is logged, or if today is not logged yet but
 * yesterday was. Breaking the streak the moment the day starts would punish the
 * user for opening the app in the morning.
 */
export function computeStreaks(activeDays: string[], today: string): Streaks {
  const set = new Set(activeDays)
  if (set.size === 0) return { current: 0, longest: 0, totalActiveDays: 0 }

  // Current streak: walk backwards from today, or yesterday if today is blank.
  let cursor = set.has(today) ? today : shift(today, -1)
  let current = 0
  while (set.has(cursor)) {
    current++
    cursor = shift(cursor, -1)
  }

  // Longest streak: scan the sorted days and count consecutive runs.
  const sorted = [...set].sort()
  let longest = 0
  let run = 0
  let prev: string | null = null
  for (const day of sorted) {
    run = prev !== null && shift(prev, 1) === day ? run + 1 : 1
    if (run > longest) longest = run
    prev = day
  }

  return { current, longest, totalActiveDays: set.size }
}

/** Trailing series of n days ending at `today`, oldest first. */
export function trailingDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => shift(today, -(n - 1 - i)))
}

/**
 * Buckets minutes by day over a trailing window.
 * Returns one entry per day so gaps render as empty columns rather than collapsing.
 */
export function minutesByDay(
  sessions: { date: string; minutes: number }[],
  today: string,
  days: number
) {
  const totals = new Map<string, number>()
  for (const s of sessions) {
    totals.set(s.date, (totals.get(s.date) ?? 0) + (s.minutes || 0))
  }
  return trailingDays(today, days).map(date => ({ date, minutes: totals.get(date) ?? 0 }))
}

/**
 * Heatmap grid aligned to weeks. Starts on the Sunday at or before the window
 * start so every column is a full calendar week, like a contribution graph.
 */
export function heatmapWeeks(
  activity: Map<string, number>,
  today: string,
  weeks: number
): { date: string; value: number; inFuture: boolean }[][] {
  const end = new Date(today + 'T00:00:00')
  // Walk back to the Sunday that starts the earliest week in view.
  const start = new Date(end)
  start.setDate(end.getDate() - (weeks * 7 - 1))
  start.setDate(start.getDate() - start.getDay())

  const cols: { date: string; value: number; inFuture: boolean }[][] = []
  const cursor = new Date(start)

  while (cursor <= end || cursor.getDay() !== 0) {
    const week: { date: string; value: number; inFuture: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const key = iso(cursor)
      week.push({ date: key, value: activity.get(key) ?? 0, inFuture: cursor > end })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(week)
    if (cursor > end && cursor.getDay() === 0) break
  }

  return cols
}

/** Splits a value range into 5 intensity buckets (0 = none). */
export function intensity(value: number, max: number) {
  if (value <= 0) return 0
  if (max <= 0) return 0
  const ratio = value / max
  if (ratio > 0.75) return 4
  if (ratio > 0.5) return 3
  if (ratio > 0.25) return 2
  return 1
}
