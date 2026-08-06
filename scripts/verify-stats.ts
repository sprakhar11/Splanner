/**
 * Verifies the Stats page's pure logic: the readiness score's renormalisation
 * rule and the streak / time-series maths.
 *
 * Run: npx tsx scripts/verify-stats.ts
 */

import {
  computeReadiness, readinessBand, activeDaysInWindow, isStoryComplete,
  DSA_TARGET, DSA_HARD_TARGET, HR_TARGET, CONSISTENCY_WINDOW,
  type ReadinessInput,
} from '../src/client/lib/readiness'
import {
  computeStreaks, trailingDays, minutesByDay, heatmapWeeks, intensity,
} from '../src/client/lib/streaks'

let pass = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? `   got ${JSON.stringify(detail)}` : ''}`) }
}

const TODAY = '2026-08-06'

/**
 * Local-time yyyy-MM-dd, matching how the app stores dates (lib/date.ts toISO).
 * Using toISOString() here would silently shift every date back a day in any
 * timezone east of UTC and quietly break the window assertions.
 */
function localISO(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function daysBack(from: string, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(from + 'T00:00:00')
    d.setDate(d.getDate() - i)
    return localISO(d)
  })
}

const empty: ReadinessInput = {
  dsa: [], systemDesign: [], lld: [], hrStories: [], revisions: [],
  activeDays: [], today: TODAY,
}

const solved = (n: number, difficulty = 'MEDIUM') =>
  Array.from({ length: n }, () => ({ status: 'SOLVED', difficulty }))

// ============================================================ readiness score
console.log('\nReadiness — the renormalisation rule')

const none = computeReadiness(empty)
check('no data yields a null score, not 0', none.score === null, none.score)
check('no data means zero eligible weight', none.eligibleWeight === 0, none.eligibleWeight)
check('no data has no weakest component', none.weakest === null)
check('all seven components are always reported', none.components.length === 7, none.components.length)
check('every component reads "no data"', none.components.every(c => c.value === null))

// A user who has only logged DSA, all solved, at target.
const dsaOnly = computeReadiness({ ...empty, dsa: solved(DSA_TARGET, 'HARD') })
check('DSA-only at full target scores 100, not capped low',
  dsaOnly.score === 100, dsaOnly.score)
check('DSA-only renormalises over just the DSA weights (25+10=35)',
  dsaOnly.eligibleWeight === 35, dsaOnly.eligibleWeight)

// The core regression: adding a NEW weak area must not be silently ignored,
// but a missing area must not drag the score down.
const dsaPerfect = computeReadiness({ ...empty, dsa: solved(DSA_TARGET, 'HARD') })
const dsaPerfectPlusEmptySd = computeReadiness({
  ...empty, dsa: solved(DSA_TARGET, 'HARD'), systemDesign: [],
})
check('an empty component does not change the score',
  dsaPerfect.score === dsaPerfectPlusEmptySd.score,
  [dsaPerfect.score, dsaPerfectPlusEmptySd.score])

const dsaPerfectPlusWeakSd = computeReadiness({
  ...empty,
  dsa: solved(DSA_TARGET, 'HARD'),
  systemDesign: [{ isRevised: false }, { isRevised: false }],
})
check('a populated but weak component does lower the score',
  (dsaPerfectPlusWeakSd.score as number) < (dsaPerfect.score as number),
  [dsaPerfect.score, dsaPerfectPlusWeakSd.score])
check('weak component weight is now included (35+20=55)',
  dsaPerfectPlusWeakSd.eligibleWeight === 55, dsaPerfectPlusWeakSd.eligibleWeight)
// 100*(25*1 + 10*1 + 20*0)/55 = 63.6 -> 64
check('score matches the weighted formula exactly',
  dsaPerfectPlusWeakSd.score === Math.round((100 * (25 + 10)) / 55),
  dsaPerfectPlusWeakSd.score)

// Verify each component in isolation reaches 100.
const perfectAll = computeReadiness({
  dsa: solved(DSA_TARGET, 'HARD'),
  systemDesign: [{ isRevised: true }, { isRevised: true }],
  lld: [{ status: 'IMPLEMENTED' }],
  hrStories: Array.from({ length: HR_TARGET }, () => ({
    situation: 's', task: 't', action: 'a', result: 'r',
  })),
  revisions: [{ nextDueDate: '2026-09-01', totalRevisions: 3 }],
  activeDays: daysBack(TODAY, CONSISTENCY_WINDOW),
  today: TODAY,
})
check('everything maxed scores exactly 100', perfectAll.score === 100, perfectAll.score)
check('everything maxed uses the full 110 weight',
  perfectAll.eligibleWeight === 110, perfectAll.eligibleWeight)

const worstAll = computeReadiness({
  dsa: [{ status: 'ATTEMPTED', difficulty: 'EASY' }],
  systemDesign: [{ isRevised: false }],
  lld: [{ status: 'BACKLOG' }],
  hrStories: [{ situation: '', task: '', action: '', result: '' }],
  revisions: [{ nextDueDate: '2020-01-01', totalRevisions: 0 }],
  activeDays: ['1999-01-01'],
  today: TODAY,
})
check('everything empty-but-present scores 0', worstAll.score === 0, worstAll.score)
check('score is never negative', (worstAll.score as number) >= 0)

// Difficulty balance must not be eligible until something is solved.
const attemptedOnly = computeReadiness({
  ...empty, dsa: [{ status: 'ATTEMPTED', difficulty: 'HARD' }],
})
const diffComp = attemptedOnly.components.find(c => c.key === 'dsaDifficulty')!
check('hard-problem component stays ineligible with nothing solved',
  diffComp.value === null, diffComp.value)

// Over-target values must clamp, never exceed 1.
const overTarget = computeReadiness({
  ...empty, dsa: solved(DSA_TARGET * 3, 'HARD'),
})
check('exceeding the DSA target clamps at 100', overTarget.score === 100, overTarget.score)

// Weakest component identification
const weakestCase = computeReadiness({
  ...empty,
  dsa: solved(DSA_TARGET, 'HARD'),
  lld: [{ status: 'BACKLOG' }, { status: 'BACKLOG' }],
})
check('weakest component is the zero-valued one',
  weakestCase.weakest?.key === 'lld', weakestCase.weakest?.key)

// Bands
check('band at 100 is interview ready', readinessBand(100).label === 'Interview ready')
check('band at 80 is interview ready', readinessBand(80).label === 'Interview ready')
check('band at 79 is nearly there', readinessBand(79).label === 'Nearly there')
check('band at 0 is just starting', readinessBand(0).label === 'Just starting')
check('band at null is not enough data', readinessBand(null).label === 'Not enough data')

// STAR completeness
check('a full STAR story is complete',
  isStoryComplete({ situation: 's', task: 't', action: 'a', result: 'r' }))
check('a whitespace-only field does not count',
  !isStoryComplete({ situation: 's', task: '   ', action: 'a', result: 'r' }))
check('a null field does not count',
  !isStoryComplete({ situation: 's', task: null, action: 'a', result: 'r' }))

// Consistency window
check('activeDaysInWindow counts only days inside the window',
  activeDaysInWindow(['2026-08-06', '2026-08-05', '2026-01-01'], TODAY, 14) === 2)
check('activeDaysInWindow includes today', activeDaysInWindow([TODAY], TODAY, 14) === 1)
check('activeDaysInWindow excludes the future',
  activeDaysInWindow(['2026-08-07'], TODAY, 14) === 0)
check('a fully active window counts every day',
  activeDaysInWindow(daysBack(TODAY, CONSISTENCY_WINDOW), TODAY, CONSISTENCY_WINDOW) === CONSISTENCY_WINDOW,
  activeDaysInWindow(daysBack(TODAY, CONSISTENCY_WINDOW), TODAY, CONSISTENCY_WINDOW))
// Guards against reintroducing UTC formatting, which shifts dates east of UTC.
check('date maths is timezone-stable, not UTC-shifted',
  daysBack(TODAY, 1)[0] === TODAY, daysBack(TODAY, 1)[0])

// ==================================================================== streaks
console.log('\nStreaks')

check('no activity means no streak', computeStreaks([], TODAY).current === 0)
check('today alone is a 1 day streak',
  computeStreaks([TODAY], TODAY).current === 1)
check('three consecutive days ending today is 3',
  computeStreaks(['2026-08-04', '2026-08-05', '2026-08-06'], TODAY).current === 3)

// The grace rule: an unlogged today must not break a live streak.
check('a streak ending yesterday survives an unlogged today',
  computeStreaks(['2026-08-04', '2026-08-05'], TODAY).current === 2,
  computeStreaks(['2026-08-04', '2026-08-05'], TODAY).current)
check('a streak ending two days ago is broken',
  computeStreaks(['2026-08-03', '2026-08-04'], TODAY).current === 0,
  computeStreaks(['2026-08-03', '2026-08-04'], TODAY).current)

check('longest streak is found in history, not just at the end',
  computeStreaks(
    ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-08-06'],
    TODAY
  ).longest === 4)
check('current can be shorter than longest', (() => {
  const s = computeStreaks(['2026-07-01', '2026-07-02', '2026-07-03', TODAY], TODAY)
  return s.current === 1 && s.longest === 3
})())
check('duplicate days are counted once',
  computeStreaks([TODAY, TODAY, TODAY], TODAY).totalActiveDays === 1)
check('a month boundary does not break a streak',
  computeStreaks(['2026-07-31', '2026-08-01'], '2026-08-01').current === 2)

// ============================================================== time series
console.log('\nTime series')

check('trailingDays returns n days', trailingDays(TODAY, 30).length === 30)
check('trailingDays ends at today', trailingDays(TODAY, 30)[29] === TODAY)
check('trailingDays is oldest first', trailingDays(TODAY, 3)[0] === '2026-08-04')

const series = minutesByDay(
  [{ date: '2026-08-06', minutes: 30 }, { date: '2026-08-06', minutes: 15 }, { date: '2026-08-04', minutes: 50 }],
  TODAY, 5
)
check('minutesByDay emits one entry per day', series.length === 5)
check('minutesByDay sums multiple sessions on one day',
  series[series.length - 1].minutes === 45, series[series.length - 1].minutes)
check('minutesByDay fills gaps with zero',
  series[series.length - 2].minutes === 0, series[series.length - 2].minutes)
check('minutesByDay ignores days outside the window',
  minutesByDay([{ date: '2020-01-01', minutes: 999 }], TODAY, 5)
    .every(d => d.minutes === 0))

const weeks = heatmapWeeks(new Map([[TODAY, 40]]), TODAY, 26)
check('heatmap columns are all full weeks',
  weeks.every(w => w.length === 7), weeks.map(w => w.length).filter(l => l !== 7))
check('heatmap covers at least the requested weeks', weeks.length >= 26, weeks.length)
check('heatmap places the value on the right day',
  weeks.flat().find(d => d.date === TODAY)?.value === 40)
check('heatmap marks days after today as future',
  weeks.flat().filter(d => d.date > TODAY).every(d => d.inFuture))
check('heatmap does not mark today as future',
  weeks.flat().find(d => d.date === TODAY)?.inFuture === false)

check('intensity of zero is 0', intensity(0, 100) === 0)
check('intensity guards a zero max', intensity(5, 0) === 0)
check('intensity of the max is 4', intensity(100, 100) === 4)
check('intensity is bucketed 1..4', (() => {
  const buckets = [10, 40, 60, 90].map(v => intensity(v, 100))
  return JSON.stringify(buckets) === JSON.stringify([1, 2, 3, 4])
})())

console.log(`\n${pass}/${pass + failures.length} checks passed`)
if (failures.length) {
  console.log('FAILED: ' + failures.join(', '))
  process.exit(1)
}
console.log('Readiness score and streak maths verified.')
