import { describe, it, expect } from 'vitest'
import {
  computeHabitState, stageFor, toNextStageFor, healthFor,
  type HabitLog, type HabitStatus,
} from './habits'
import { addDays } from '@shared/day'

const TODAY = '2026-08-22'

/** Builds a log on the day `offset` days before TODAY. */
const on = (offset: number, status: HabitStatus = 'COMPLETED'): HabitLog =>
  ({ date: addDays(TODAY, -offset), status })

/** Completions for a consecutive run ending `endOffset` days before TODAY. */
const run = (length: number, endOffset = 0): HabitLog[] =>
  Array.from({ length }, (_, i) => on(endOffset + i))

const state = (logs: HabitLog[], today = TODAY) => computeHabitState(logs, today)

describe('a brand new habit', () => {
  it('is a thriving seed, not a dead one', () => {
    const s = state([])
    expect(s.stage).toBe('SEED')
    expect(s.health).toBe('THRIVING')
    expect(s.currentStreak).toBe(0)
    expect(s.longestStreak).toBe(0)
    expect(s.totalCompletions).toBe(0)
    expect(s.todayStatus).toBeNull()
    expect(s.daysSinceActivity).toBeNull()
  })

  it('needs 4 completions to sprout', () => {
    expect(state([]).toNextStage).toBe(4)
  })
})

describe('current streak', () => {
  it('counts an unbroken run including today', () => {
    expect(state(run(5)).currentStreak).toBe(5)
  })

  it('still counts when today is not logged yet', () => {
    // Completed through yesterday. Early in the day this must not read as broken.
    expect(state(run(3, 1)).currentStreak).toBe(3)
  })

  it('is zero once a full day has been missed', () => {
    // Last completion was two days ago, so neither today nor yesterday is logged.
    expect(state(run(3, 2)).currentStreak).toBe(0)
  })

  it('ends at a day with no log', () => {
    // today, -1, then a hole at -2, then more completions further back
    const logs = [...run(2), on(3), on(4)]
    expect(state(logs).currentStreak).toBe(2)
  })

  it('counts a single completion today', () => {
    expect(state([on(0)]).currentStreak).toBe(1)
  })
})

describe('skips bridge the streak without adding to it', () => {
  it('spans a single skip', () => {
    // completed today, -1 skipped, completed -2 and -3
    const logs = [on(0), on(1, 'SKIPPED'), on(2), on(3)]
    const s = state(logs)
    expect(s.currentStreak).toBe(3) // three completions, the skip adds nothing
    expect(s.totalCompletions).toBe(3)
  })

  it('spans consecutive skips', () => {
    const logs = [on(0), on(1, 'SKIPPED'), on(2, 'SKIPPED'), on(3), on(4)]
    expect(state(logs).currentStreak).toBe(3)
  })

  it('does not start a streak on its own', () => {
    expect(state([on(0, 'SKIPPED')]).currentStreak).toBe(0)
  })

  it('bridges from today when today itself is skipped', () => {
    const logs = [on(0, 'SKIPPED'), on(1), on(2)]
    expect(state(logs).currentStreak).toBe(2)
  })

  it('does not bridge across a genuine hole', () => {
    // skip at -1 bridges, but -3 has no log at all
    const logs = [on(0), on(1, 'SKIPPED'), on(2), on(4)]
    expect(state(logs).currentStreak).toBe(2)
  })
})

describe('longest streak', () => {
  it('finds a run in the past longer than the current one', () => {
    const logs = [...run(2), ...run(7, 10)]
    const s = state(logs)
    expect(s.currentStreak).toBe(2)
    expect(s.longestStreak).toBe(7)
  })

  it('equals the current streak when that is the best', () => {
    expect(state(run(6)).longestStreak).toBe(6)
  })

  it('counts a skip-bridged run as one run', () => {
    const logs = [on(5), on(4), on(3, 'SKIPPED'), on(2), on(1)]
    expect(state(logs).longestStreak).toBe(4)
  })

  it('splits runs separated by an unlogged day', () => {
    // 3 completions, hole, 2 completions
    const logs = [...run(3, 6), ...run(2, 1)]
    expect(state(logs).longestStreak).toBe(3)
  })

  it('ignores leading and trailing skips', () => {
    const logs = [on(4, 'SKIPPED'), on(3), on(2), on(1, 'SKIPPED')]
    expect(state(logs).longestStreak).toBe(2)
  })

  it('is zero when only skips were ever logged', () => {
    expect(state([on(1, 'SKIPPED'), on(2, 'SKIPPED')]).longestStreak).toBe(0)
  })
})

describe('health boundaries', () => {
  const gaps: [number, string][] = [
    [0, 'THRIVING'],
    [1, 'THRIVING'],
    [2, 'WILTED'],
    [3, 'WILTED'],
    [4, 'DYING'],
    [6, 'DYING'],
    [7, 'DEAD'],
    [30, 'DEAD'],
  ]

  for (const [gap, expected] of gaps) {
    it(`is ${expected} at a gap of ${gap} day(s)`, () => {
      expect(state([on(gap)]).health).toBe(expected)
    })
  }

  it('treats a skip as activity, so a sick day protects health', () => {
    // Last completion was 5 days ago, but a skip 1 day ago keeps it thriving.
    const logs = [on(5), on(1, 'SKIPPED')]
    expect(state(logs).health).toBe('THRIVING')
  })

  it('ignores future-dated logs when measuring the gap', () => {
    const logs = [on(4), { date: addDays(TODAY, 3), status: 'COMPLETED' as const }]
    // The gap must be measured from the real last activity, not the future row.
    expect(state(logs).daysSinceActivity).toBe(4)
    expect(state(logs).health).toBe('DYING')
  })
})

describe('stage thresholds', () => {
  const edges: [number, string][] = [
    [0, 'SEED'], [3, 'SEED'],
    [4, 'SPROUT'], [14, 'SPROUT'],
    [15, 'SAPLING'], [30, 'SAPLING'],
    [31, 'MATURE'], [60, 'MATURE'],
    [61, 'BLOOMING'], [500, 'BLOOMING'],
  ]

  for (const [completions, expected] of edges) {
    it(`is ${expected} at ${completions} completions`, () => {
      expect(stageFor(completions)).toBe(expected)
    })
  }

  it('reports the distance to the next rung', () => {
    expect(toNextStageFor(0)).toBe(4)
    expect(toNextStageFor(3)).toBe(1)
    expect(toNextStageFor(14)).toBe(1)
    expect(toNextStageFor(31)).toBe(30)
  })

  it('has no next rung at the top', () => {
    expect(toNextStageFor(61)).toBeNull()
    expect(toNextStageFor(200)).toBeNull()
  })
})

describe('size never regresses (decision D-1)', () => {
  it('keeps a blooming plant blooming after a long absence', () => {
    // 61 completions, the most recent of them a month ago.
    const logs = run(61, 30)
    const s = state(logs)

    expect(s.totalCompletions).toBe(61)
    expect(s.stage).toBe('BLOOMING') // size held
    expect(s.currentStreak).toBe(0) // streak gone
    expect(s.health).toBe('DEAD') // health gone
  })

  it('restores health on a single completion without changing size', () => {
    const neglected = run(61, 30)
    const revived = [...neglected, on(0)]
    const before = state(neglected)
    const after = state(revived)

    expect(before.health).toBe('DEAD')
    expect(after.health).toBe('THRIVING')
    expect(after.stage).toBe('BLOOMING')
    expect(after.currentStreak).toBe(1)
    expect(after.totalCompletions).toBe(before.totalCompletions + 1)
  })

  it('is unaffected by how the completions were distributed', () => {
    // Twenty completions every third day: erratic, but the plant is the same size.
    const scattered = Array.from({ length: 20 }, (_, i) => on(i * 3))
    expect(state(scattered).totalCompletions).toBe(20)
    expect(state(scattered).stage).toBe('SAPLING')
    expect(state(scattered).currentStreak).toBeLessThanOrEqual(1)
  })
})

describe('today status', () => {
  it('reports a completion today', () => {
    expect(state([on(0)]).todayStatus).toBe('COMPLETED')
  })

  it('reports a skip today', () => {
    expect(state([on(0, 'SKIPPED')]).todayStatus).toBe('SKIPPED')
  })

  it('is null when today has no log', () => {
    expect(state([on(1)]).todayStatus).toBeNull()
  })

  it('follows the logical day it is given, not the wall clock', () => {
    // The same logs read differently depending on which day is "today", which is
    // how the rollover hour reaches this function.
    const logs = [on(1)] // logged 2026-08-21
    expect(state(logs, '2026-08-21').todayStatus).toBe('COMPLETED')
    expect(state(logs, '2026-08-22').todayStatus).toBeNull()
  })
})

describe('healthFor', () => {
  it('treats a never-logged habit as thriving', () => {
    expect(healthFor(null)).toBe('THRIVING')
  })
})

describe('duplicate log defence', () => {
  it('does not double-count a repeated date', () => {
    // The unique index prevents this live, but an imported backup might not be clean.
    const logs = [on(0), on(0), on(1)]
    const s = state(logs)
    expect(s.totalCompletions).toBe(2)
    expect(s.currentStreak).toBe(2)
  })
})
