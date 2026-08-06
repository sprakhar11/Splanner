/**
 * Runs the real readiness + streak logic against live API responses.
 * The pure maths is covered by verify-stats.ts; this catches shape mismatches
 * between what the server actually returns and what the Stats page assumes
 * (field names, 1/0 vs true/false booleans, null handling).
 *
 * Run: npx tsx scripts/verify-stats-live.ts
 */

import { computeReadiness, readinessBand } from '../src/client/lib/readiness'
import { computeStreaks, minutesByDay, heatmapWeeks } from '../src/client/lib/streaks'

const BASE = 'http://127.0.0.1:3001/api'
let pass = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? `   got ${JSON.stringify(detail)}` : ''}`) }
}

const get = async (p: string) => (await fetch(BASE + p)).json()

const pad = (n: number) => String(n).padStart(2, '0')
const d = new Date()
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

async function main() {
  console.log('\nLive API shapes')

  const [sessions, tasks, revisions, reflections, dsa, sd, lld, hr] = await Promise.all([
    get('/study-sessions'), get('/tasks'), get('/revisions'), get('/reflections'),
    get('/dsa'), get('/system-design'), get('/lld'), get('/hr-stories'),
  ])

  check('study sessions have date + minutes',
    sessions.length > 0 && sessions.every((s: any) => typeof s.date === 'string' && typeof s.minutes === 'number'),
    sessions[0])
  check('dsa rows expose status + difficulty',
    dsa.every((x: any) => 'status' in x && 'difficulty' in x))
  check('system design rows expose isRevised',
    sd.every((x: any) => 'isRevised' in x))
  check('lld rows expose status', lld.every((x: any) => 'status' in x))
  check('hr rows expose all four STAR fields',
    hr.every((x: any) => ['situation', 'task', 'action', 'result'].every(k => k in x)))
  check('revision cards expose nextDueDate',
    revisions.every((x: any) => typeof x.nextDueDate === 'string'))
  check('reflections expose a numeric mood',
    reflections.length === 0 || reflections.every((r: any) => typeof r.mood === 'number'))

  // isRevised arrives from SQLite as a boolean via Drizzle's mode:'boolean'.
  // The scorer uses !! so 1/0 would also work, but confirm the truthiness holds.
  const revisedCount = sd.filter((x: any) => !!x.isRevised).length
  check('isRevised is usefully truthy (not the string "0")',
    !sd.some((x: any) => x.isRevised === '0' || x.isRevised === 'false'),
    sd.map((x: any) => x.isRevised))

  console.log('\nActive days + streaks from live data')

  const activeDays = new Set<string>()
  for (const s of sessions) if (s.minutes > 0) activeDays.add(s.date)
  for (const t of tasks) if (t.status === 'COMPLETED') activeDays.add(t.date)
  const days = [...activeDays]

  check('live data produces active days', days.length > 0, days.length)

  const streaks = computeStreaks(days, today)
  console.log(`        current=${streaks.current} longest=${streaks.longest} total=${streaks.totalActiveDays}`)
  check('current streak is not negative', streaks.current >= 0)
  check('current streak never exceeds longest', streaks.current <= streaks.longest,
    [streaks.current, streaks.longest])
  check('longest streak never exceeds total active days',
    streaks.longest <= streaks.totalActiveDays, [streaks.longest, streaks.totalActiveDays])
  check('total active days matches the distinct set',
    streaks.totalActiveDays === days.length)
  check('the seeded 9 day run is detected as a live streak',
    streaks.current >= 9, streaks.current)

  console.log('\nSeries from live data')

  const series30 = minutesByDay(sessions, today, 30)
  check('30 day series has 30 entries', series30.length === 30, series30.length)
  check('series ends on today', series30[29].date === today)
  const seriesTotal = series30.reduce((s, x) => s + x.minutes, 0)
  const directTotal = sessions
    .filter((s: any) => s.date >= series30[0].date && s.date <= today)
    .reduce((sum: number, s: any) => sum + s.minutes, 0)
  check('series total matches a direct sum over the same window',
    seriesTotal === directTotal, [seriesTotal, directTotal])
  check('series total is greater than zero', seriesTotal > 0, seriesTotal)

  const map = new Map<string, number>()
  for (const s of sessions) map.set(s.date, (map.get(s.date) ?? 0) + s.minutes)
  const weeks = heatmapWeeks(map, today, 26)
  check('heatmap is built of full weeks', weeks.every(w => w.length === 7))
  const painted = weeks.flat().filter(x => x.value > 0).length
  check('heatmap paints the seeded days', painted > 0, painted)
  check('heatmap never paints a future day',
    !weeks.flat().some(x => x.inFuture && x.value > 0))

  console.log('\nReadiness from live data')

  const r = computeReadiness({
    dsa, systemDesign: sd, lld, hrStories: hr, revisions, activeDays: days, today,
  })
  console.log(`        score=${r.score} eligibleWeight=${r.eligibleWeight} band="${readinessBand(r.score).label}"`)
  for (const c of r.components) {
    console.log(`          ${c.label.padEnd(20)} ${c.value === null ? 'n/a ' : String(Math.round(c.value * 100)).padStart(3) + '%'}  w${String(c.weight).padEnd(3)} ${c.detail}`)
  }

  check('live score is a number, not null', r.score !== null, r.score)
  check('live score is within 0..100',
    (r.score as number) >= 0 && (r.score as number) <= 100, r.score)
  // Derived from the live data rather than hardcoded: a component with no rows
  // is meant to be excluded, so the expected total depends on what exists.
  const expectedWeight = r.components
    .filter(c => c.value !== null)
    .reduce((sum, c) => sum + c.weight, 0)
  check('eligible weight is the sum of the components that have data',
    r.eligibleWeight === expectedWeight, { got: r.eligibleWeight, expectedWeight })
  check('a component with no rows is excluded rather than scored zero', (() => {
    const empty = r.components.filter(c => c.value === null)
    // Whatever is empty must not contribute weight.
    return empty.every(c => !expectedWeight || r.eligibleWeight <= 110 - c.weight * 0)
      && r.eligibleWeight === 110 - empty.reduce((s, c) => s + c.weight, 0)
  })(), {
    empty: r.components.filter(c => c.value === null).map(c => c.key),
    eligibleWeight: r.eligibleWeight,
  })
  check('a weakest component is identified', r.weakest !== null, r.weakest)
  check('no eligible component reports a value above 1',
    r.components.filter(c => c.value !== null).every(c => (c.value as number) <= 1))
  check('score equals the weighted formula over live values', (() => {
    const el = r.components.filter(c => c.value !== null)
    const expected = Math.round(
      (100 * el.reduce((s, c) => s + c.weight * (c.value as number), 0)) /
      el.reduce((s, c) => s + c.weight, 0)
    )
    return r.score === expected
  })(), r.score)
  check('consistency reflects the seeded streak',
    (r.components.find(c => c.key === 'consistency')!.value as number) > 0.5,
    r.components.find(c => c.key === 'consistency')!.value)

  console.log(`\n${pass}/${pass + failures.length} checks passed`)
  if (failures.length) {
    console.log('FAILED: ' + failures.join(', '))
    process.exit(1)
  }
  console.log('Stats page wiring verified against live data.')
}

main().catch(e => { console.error(e); process.exit(1) })
