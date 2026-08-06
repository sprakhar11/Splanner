export function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(s: string) {
  return new Date(s + 'T00:00:00')
}

export function todayISO() {
  return toISO(new Date())
}

export function addDaysISO(iso: string, days: number) {
  const d = fromISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DOW_SUNDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const DOW = DOW_SUNDAY

/** Weekday header labels for the chosen week start. */
export function dowLabels(mondayFirst = false) {
  return mondayFirst
    ? [...DOW_SUNDAY.slice(1), DOW_SUNDAY[0]]
    : DOW_SUNDAY
}

/**
 * Returns 42 days (6 weeks) covering the month.
 * `mondayFirst` shifts the leading weekday so column one is Monday.
 */
export function monthGrid(year: number, month: number, mondayFirst = false) {
  const first = new Date(year, month, 1)
  // Offset from the first of the month back to the start of its week.
  const weekday = first.getDay() // 0 = Sunday
  const lead = mondayFirst ? (weekday + 6) % 7 : weekday

  const start = new Date(first)
  start.setDate(1 - lead)

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return {
      date: d,
      iso: toISO(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
    }
  })
}

export function monthRange(year: number, month: number, mondayFirst = false) {
  const grid = monthGrid(year, month, mondayFirst)
  return { from: grid[0].iso, to: grid[41].iso }
}

export const PRIORITY_COLOR: Record<string, string> = {
  P1: 'var(--ev-red)',
  P2: 'var(--ev-orange)',
  P3: 'var(--ev-yellow)',
  P4: 'var(--ev-teal)',
}

// ===== epoch-ms <-> <input type="datetime-local"> =====

/** Epoch-ms to the "yyyy-MM-ddTHH:mm" string a datetime-local input expects, in local time. */
export function toLocalInput(ms?: number | null) {
  if (!ms) return ''
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Parses a datetime-local value back to epoch-ms. Empty string becomes null. */
export function fromLocalInput(v: string): number | null {
  if (!v) return null
  const ms = new Date(v).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** Combines a yyyy-MM-dd date with an HH:mm time into epoch-ms. */
export function atTimeOn(iso: string, time: string): number | null {
  if (!iso || !time) return null
  const ms = new Date(`${iso}T${time}`).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** 95 -> "1h 35m", 40 -> "40m", 0 -> "0m" */
export function formatMinutes(total: number) {
  const m = Math.max(0, Math.round(total))
  const h = Math.floor(m / 60)
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
}

/** Seconds to mm:ss, or h:mm:ss past an hour. */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** Short human delta: "in 2h", "5m ago", "tomorrow". Past values read as "ago". */
export function relativeTime(ms: number, now = Date.now()) {
  const diff = ms - now
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60_000)
  const future = diff > 0

  if (mins < 1) return 'now'
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`

  const hours = Math.round(mins / 60)
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`

  const days = Math.round(hours / 24)
  if (days === 1) return future ? 'tomorrow' : 'yesterday'
  return future ? `in ${days}d` : `${days}d ago`
}

/** Local-time "14:30" for a given epoch-ms. */
export function timeLabel(ms: number) {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
