import { describe, it, expect } from 'vitest'
import {
  logicalToday, clampRolloverHour, isLogicalToday, daysBetween, addDays, toISO,
} from './day'

/** Local-time Date, so tests read as wall-clock regardless of the runner's TZ. */
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min)

describe('clampRolloverHour', () => {
  it('accepts the supported range', () => {
    expect(clampRolloverHour(0)).toBe(0)
    expect(clampRolloverHour(3)).toBe(3)
    expect(clampRolloverHour(6)).toBe(6)
  })

  it('parses the stored string form, since settings are persisted as text', () => {
    expect(clampRolloverHour('3')).toBe(3)
    expect(clampRolloverHour('0')).toBe(0)
  })

  it('falls back to midnight for anything unusable', () => {
    expect(clampRolloverHour('')).toBe(0)
    expect(clampRolloverHour('abc')).toBe(0)
    expect(clampRolloverHour(null)).toBe(0)
    expect(clampRolloverHour(undefined)).toBe(0)
    expect(clampRolloverHour(NaN)).toBe(0)
  })

  it('clamps out-of-range values into the range', () => {
    expect(clampRolloverHour(-5)).toBe(0)
    expect(clampRolloverHour(23)).toBe(6)
  })

  it('floors fractional hours', () => {
    expect(clampRolloverHour(3.9)).toBe(3)
  })
})

describe('logicalToday with rolloverHour 0', () => {
  it('is plain wall-clock, including immediately after midnight', () => {
    expect(logicalToday(0, at(2026, 8, 16, 23, 0))).toBe('2026-08-16')
    expect(logicalToday(0, at(2026, 8, 17, 0, 1))).toBe('2026-08-17')
  })
})

describe('logicalToday with rolloverHour 3', () => {
  it('still reads as the previous day before the cutoff', () => {
    // The whole point of the setting: at 01:30 the user has not finished the 16th.
    expect(logicalToday(3, at(2026, 8, 17, 0, 1))).toBe('2026-08-16')
    expect(logicalToday(3, at(2026, 8, 17, 1, 30))).toBe('2026-08-16')
    expect(logicalToday(3, at(2026, 8, 17, 2, 59))).toBe('2026-08-16')
  })

  it('advances exactly at the cutoff', () => {
    expect(logicalToday(3, at(2026, 8, 17, 3, 0))).toBe('2026-08-17')
  })

  it('is unchanged for the rest of the day', () => {
    expect(logicalToday(3, at(2026, 8, 17, 10, 0))).toBe('2026-08-17')
    expect(logicalToday(3, at(2026, 8, 17, 23, 59))).toBe('2026-08-17')
  })
})

describe('logicalToday with rolloverHour 6', () => {
  it('honours the widest supported boundary', () => {
    expect(logicalToday(6, at(2026, 8, 17, 5, 59))).toBe('2026-08-16')
    expect(logicalToday(6, at(2026, 8, 17, 6, 0))).toBe('2026-08-17')
  })
})

describe('logicalToday edge cases', () => {
  it('crosses a month boundary backwards', () => {
    expect(logicalToday(3, at(2026, 9, 1, 1, 0))).toBe('2026-08-31')
  })

  it('crosses a year boundary backwards', () => {
    expect(logicalToday(3, at(2027, 1, 1, 2, 0))).toBe('2026-12-31')
  })

  it('handles a leap day', () => {
    expect(logicalToday(3, at(2028, 3, 1, 1, 0))).toBe('2028-02-29')
  })

  it('does not mutate the Date it is given', () => {
    const now = at(2026, 8, 17, 1, 0)
    const before = now.getTime()
    logicalToday(3, now)
    expect(now.getTime()).toBe(before)
  })
})

describe('isLogicalToday', () => {
  it('compares against the shifted day, not the wall clock', () => {
    const preCutoff = at(2026, 8, 17, 1, 0)
    expect(isLogicalToday('2026-08-16', 3, preCutoff)).toBe(true)
    expect(isLogicalToday('2026-08-17', 3, preCutoff)).toBe(false)
  })
})

describe('daysBetween', () => {
  it('counts whole days forward and backward', () => {
    expect(daysBetween('2026-08-16', '2026-08-17')).toBe(1)
    expect(daysBetween('2026-08-16', '2026-08-16')).toBe(0)
    expect(daysBetween('2026-08-17', '2026-08-16')).toBe(-1)
  })

  it('spans months and years', () => {
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('is exact across a daylight-saving transition', () => {
    // Northern-hemisphere spring forward: a local-midnight diff would be 23h.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    // And autumn back, where it would be 25h.
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('addDays', () => {
  it('shifts within the calendar domain', () => {
    expect(addDays('2026-08-16', 1)).toBe('2026-08-17')
    expect(addDays('2026-08-16', -1)).toBe('2026-08-15')
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('round-trips with daysBetween', () => {
    expect(daysBetween('2026-08-16', addDays('2026-08-16', 45))).toBe(45)
  })
})

describe('toISO', () => {
  it('zero-pads month and day', () => {
    expect(toISO(at(2026, 1, 5))).toBe('2026-01-05')
  })
})
