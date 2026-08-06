/**
 * Renders the Stats page headlessly to prove the JSX does not crash, on both
 * an empty database and a populated one. Browser automation was unavailable,
 * so this substitutes for a visual smoke test: it catches null dereferences,
 * divide-by-zero output, and missing-guard crashes in the render path.
 *
 * Run: npx tsx scripts/verify-stats-render.tsx
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import Stats from '../src/client/pages/Stats'

let pass = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? `   got ${JSON.stringify(detail)}` : ''}`) }
}

/**
 * Renders Stats with the query cache pre-seeded, so useQuery resolves
 * synchronously from cache instead of needing the network.
 */
function renderWith(seed: Record<string, unknown[]>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })

  // Stats calls useQuery with these exact keys.
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = new Date()
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const back = (n: number) => {
    const x = new Date(today + 'T00:00:00'); x.setDate(x.getDate() - n)
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
  }
  const wide = { from: back(400), to: today }

  qc.setQueryData(['studySessions', wide], seed.studySessions ?? [])
  qc.setQueryData(['tasks', wide], seed.tasks ?? [])
  qc.setQueryData(['revisions'], seed.revisions ?? [])
  qc.setQueryData(['reflections'], seed.reflections ?? [])
  qc.setQueryData(['dsa'], seed.dsa ?? [])
  qc.setQueryData(['systemDesign'], seed.systemDesign ?? [])
  qc.setQueryData(['lld'], seed.lld ?? [])
  qc.setQueryData(['hrStories'], seed.hrStories ?? [])

  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: qc },
      createElement(MemoryRouter, null, createElement(Stats)))
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

console.log('\nEmpty database')
let emptyHtml = ''
try {
  emptyHtml = renderWith({})
  check('Stats renders with no data at all', emptyHtml.length > 0)
} catch (e: any) {
  check('Stats renders with no data at all', false, e.message)
}
check('empty state shows the placeholder score', emptyHtml.includes('—'))
check('empty state shows "Not enough data"', emptyHtml.includes('Not enough data'))
check('empty state prompts the user to log something',
  emptyHtml.includes('the score appears'))
check('empty state does not print NaN', !emptyHtml.includes('NaN'))
check('empty state does not print Infinity', !emptyHtml.includes('Infinity'))
check('empty state does not print undefined', !emptyHtml.includes('undefined'))
check('empty state shows a 0 day streak', emptyHtml.includes('0 days'))

console.log('\nPopulated database')
let fullHtml = ''
try {
  fullHtml = renderWith({
    studySessions: [
      { id: '1', date: today, minutes: 50, taskId: null },
      { id: '2', date: today, minutes: 25, taskId: null },
    ],
    tasks: [
      { id: 't1', date: today, status: 'COMPLETED', priority: 'P1', estimatedMinutes: 30, actualMinutes: 45 },
      { id: 't2', date: today, status: 'TODO', priority: 'P3', estimatedMinutes: 60, actualMinutes: null },
    ],
    revisions: [{ id: 'r1', nextDueDate: '2027-01-01', totalRevisions: 4 }],
    reflections: [{ id: 'f1', date: today, mood: 4 }],
    dsa: [
      { id: 'd1', status: 'SOLVED', difficulty: 'HARD' },
      { id: 'd2', status: 'ATTEMPTED', difficulty: 'EASY' },
    ],
    systemDesign: [{ id: 's1', isRevised: true }, { id: 's2', isRevised: false }],
    lld: [{ id: 'l1', status: 'IMPLEMENTED' }],
    hrStories: [{ id: 'h1', situation: 's', task: 't', action: 'a', result: 'r' }],
  })
  check('Stats renders with populated data', fullHtml.length > 0)
} catch (e: any) {
  check('Stats renders with populated data', false, e.message)
}
check('populated state does not print NaN', !fullHtml.includes('NaN'))
check('populated state does not print Infinity', !fullHtml.includes('Infinity'))
check('populated state does not print undefined', !fullHtml.includes('undefined'))
check('populated state renders a readiness band',
  /Interview ready|Nearly there|Building up|Early days|Just starting/.test(fullHtml))
check('populated state shows a 1 day streak', fullHtml.includes('1 day'))
check('populated state renders the focus total (1h 15m)', fullHtml.includes('1h 15m'))
check('populated state renders a 50% completion rate', fullHtml.includes('50%'))
// t1 tracked 45m against a 30m estimate; t2 has no tracked time and must be
// excluded, otherwise its 60m estimate would flip this to "under estimate".
check('estimate accuracy ignores untracked tasks and reports over estimate',
  fullHtml.includes('over estimate'), fullHtml.match(/(over|under) estimate/)?.[0])
check('estimate accuracy states how many tasks it covers',
  fullHtml.includes('1 task with tracked time'))
check('estimate comparison uses only the tracked task estimate (30m, not 90m)',
  fullHtml.includes('30m') && !fullHtml.includes('1h 30m'))
check('all panel titles are present',
  ['Interview readiness', 'Score breakdown', 'Focus minutes', 'Activity',
   'Task completion', 'Tasks by priority', 'Problems solved', 'Prep coverage',
   'Mood', 'HR stories'].every(t => fullHtml.includes(t)))

console.log('\nDivide-by-zero guard')
let zeroEstHtml = ''
try {
  // Tracked time with a zero estimate previously produced "Infinity% over estimate".
  zeroEstHtml = renderWith({
    tasks: [{ id: 't1', date: today, status: 'COMPLETED', priority: 'P1', estimatedMinutes: 0, actualMinutes: 30 }],
    studySessions: [{ id: '1', date: today, minutes: 30, taskId: null }],
  })
  check('renders with actual time but a zero estimate', zeroEstHtml.length > 0)
} catch (e: any) {
  check('renders with actual time but a zero estimate', false, e.message)
}
check('zero estimate does not produce Infinity', !zeroEstHtml.includes('Infinity'))
check('zero estimate suppresses the comparison line',
  !zeroEstHtml.includes('over estimate') && !zeroEstHtml.includes('under estimate'))
check('zero estimate still shows the tracked time', zeroEstHtml.includes('30m'))

console.log(`\n${pass}/${pass + failures.length} checks passed`)
if (failures.length) {
  console.log('FAILED: ' + failures.join(', '))
  process.exit(1)
}
console.log('Stats page renders cleanly on empty, populated, and edge-case data.')
