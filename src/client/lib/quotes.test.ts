import { describe, it, expect } from 'vitest'
import { quoteForDay, QUOTES } from './quotes'
import { addDays } from '@shared/day'

describe('quoteForDay', () => {
  it('is stable for the same day', () => {
    expect(quoteForDay('2026-08-22')).toBe(quoteForDay('2026-08-22'))
  })

  it('always returns something from the list', () => {
    let cursor = '2026-01-01'
    for (let i = 0; i < 400; i++) {
      expect(QUOTES).toContain(quoteForDay(cursor))
      cursor = addDays(cursor, 1)
    }
  })

  it('rarely repeats on consecutive days', () => {
    // Sequential dates differ by one character, so a weak hash would cluster.
    let cursor = '2026-01-01'
    let repeats = 0
    for (let i = 0; i < 365; i++) {
      const next = addDays(cursor, 1)
      if (quoteForDay(cursor) === quoteForDay(next)) repeats++
      cursor = next
    }
    // With 24 quotes, chance alone would give roughly 15 over a year.
    expect(repeats).toBeLessThan(30)
  })

  it('uses most of the list over a year', () => {
    let cursor = '2026-01-01'
    const seen = new Set<string>()
    for (let i = 0; i < 365; i++) {
      seen.add(quoteForDay(cursor))
      cursor = addDays(cursor, 1)
    }
    expect(seen.size).toBe(QUOTES.length)
  })
})
