/**
 * Verifies Task 3's two data loops:
 *   Loop 1 — deadline / reminderAt survive a round trip and clear back to NULL
 *   Loop 2 — a focus session writes actualMinutes (accumulating) + a study session
 *
 * Run: npx tsx scripts/verify-focus.ts
 */

import {
  elapsedMsOf, sessionMinutes, pauseSnapshot, resumeSnapshot, nextActualMinutes,
} from '../src/client/lib/focus'

const BASE = 'http://127.0.0.1:3001/api'
let pass = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    pass++
    console.log(`  PASS  ${name}`)
  } else {
    failures.push(name)
    console.log(`  FAIL  ${name}${detail !== undefined ? `   got ${JSON.stringify(detail)}` : ''}`)
  }
}

async function req(method: string, path: string, body?: unknown) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

const MIN = 60_000

async function main() {
  // ---------------------------------------------------------- pure timer maths
  console.log('\nTimer maths (pure)')

  check('paused session reports only banked time',
    elapsedMsOf({ accumulatedMs: 5000, runningSince: null }, 1_000_000) === 5000)

  check('running session adds the live segment',
    elapsedMsOf({ accumulatedMs: 5000, runningSince: 1_000_000 }, 1_003_000) === 8000)

  check('a clock that jumped backwards never yields negative elapsed',
    elapsedMsOf({ accumulatedMs: 0, runningSince: 2_000_000 }, 1_000_000) === 0)

  check('pause banks the live segment and stops the clock', (() => {
    const p = pauseSnapshot({ accumulatedMs: 1000, runningSince: 500 }, 3500)
    return p.accumulatedMs === 4000 && p.runningSince === null
  })())

  check('pausing twice does not double-bank', (() => {
    const once = pauseSnapshot({ accumulatedMs: 1000, runningSince: 500 }, 3500)
    const twice = pauseSnapshot(once, 9999)
    return twice.accumulatedMs === 4000
  })())

  check('resume keeps banked time and starts a new segment', (() => {
    const r = resumeSnapshot({ accumulatedMs: 4000, runningSince: null }, 7000)
    return r.accumulatedMs === 4000 && r.runningSince === 7000
  })())

  check('resuming a running session is a no-op',
    resumeSnapshot({ accumulatedMs: 0, runningSince: 42 }, 999).runningSince === 42)

  check('25 min rounds to 25', sessionMinutes(25 * MIN) === 25)
  check('89 seconds rounds to 1', sessionMinutes(89_000) === 1)
  check('91 seconds rounds to 2', sessionMinutes(91_000) === 2)
  check('a 3 second session still logs 1 minute, not 0', sessionMinutes(3000) === 1)
  check('a 0 ms session still logs 1 minute', sessionMinutes(0) === 1)

  check('actualMinutes accumulates from null', nextActualMinutes(null, 12) === 12)
  check('actualMinutes accumulates from a prior value', nextActualMinutes(30, 12) === 42)
  check('actualMinutes treats undefined as zero', nextActualMinutes(undefined, 5) === 5)

  // ------------------------------------------------------------- loop 1: dates
  console.log('\nLoop 1 — deadline / reminderAt')

  const today = new Date().toISOString().slice(0, 10)
  const created = await req('POST', '/tasks', {
    title: 'FOCUS VERIFY task', date: today, estimatedMinutes: 25, priority: 'P2',
  })
  check('POST /tasks returns 201', created.status === 201, created.status)
  const id: string = created.data.id
  check('a new task starts with no deadline', created.data.deadline === null)
  check('a new task starts with no reminder', created.data.reminderAt === null)
  check('a new task starts with no tracked time', created.data.actualMinutes === null)

  const deadline = Date.parse(`${today}T08:00:00`)
  const reminderAt = Date.parse(`${today}T18:00:00`)

  const withDates = await req('PUT', `/tasks/${id}`, { deadline, reminderAt })
  check('PUT accepts an epoch-ms deadline', withDates.data.deadline === deadline, withDates.data.deadline)
  check('PUT accepts an epoch-ms reminder', withDates.data.reminderAt === reminderAt, withDates.data.reminderAt)

  // The bug that blocked this loop: '' on a nullable FK failed the constraint.
  const emptyCat = await req('PUT', `/tasks/${id}`, { categoryId: '', title: 'FOCUS VERIFY task' })
  check('PUT with categoryId "" does not 500 (FK regression)', emptyCat.status === 200, emptyCat.status)
  check('PUT coerces categoryId "" to NULL', emptyCat.data?.categoryId === null, emptyCat.data?.categoryId)

  // Non-column keys must not reach the UPDATE statement.
  const withTags = await req('PUT', `/tasks/${id}`, { tags: ['dsa', 'arrays'] })
  check('PUT tolerates a tags array without 500', withTags.status === 200, withTags.status)
  const fetched = await req('GET', `/tasks/${id}`)
  check('PUT persists tags via the junction table',
    JSON.stringify(fetched.data.tags?.sort()) === JSON.stringify(['arrays', 'dsa']), fetched.data.tags)
  check('PUT preserved the deadline while writing tags', fetched.data.deadline === deadline)

  const cleared = await req('PUT', `/tasks/${id}`, { deadline: null, reminderAt: null })
  check('deadline can be cleared back to NULL', cleared.data.deadline === null, cleared.data.deadline)
  check('reminder can be cleared back to NULL', cleared.data.reminderAt === null, cleared.data.reminderAt)

  // ------------------------------------------------------- loop 2: focus timer
  console.log('\nLoop 2 — focus session commit')

  // Mirrors useFocusTimer.start()
  const started = await req('PUT', `/tasks/${id}`, { status: 'IN_PROGRESS' })
  check('start() marks the task IN_PROGRESS', started.data.status === 'IN_PROGRESS', started.data.status)

  // Mirrors useFocusTimer.stop() for a 25 minute session
  const sessionOneMinutes = sessionMinutes(elapsedMsOf(
    { accumulatedMs: 25 * MIN, runningSince: null }, Date.now()
  ))
  const before = await req('GET', `/tasks/${id}`)
  const afterOne = await req('PUT', `/tasks/${id}`, {
    actualMinutes: nextActualMinutes(before.data.actualMinutes, sessionOneMinutes),
    status: 'IN_PROGRESS',
  })
  check('first session writes actualMinutes = 25', afterOne.data.actualMinutes === 25, afterOne.data.actualMinutes)

  const logged = await req('POST', '/study-sessions', {
    date: today, minutes: sessionOneMinutes, categoryId: null, taskId: id,
    note: 'Focus session: FOCUS VERIFY task',
  })
  check('POST /study-sessions returns 201', logged.status === 201, logged.status)
  check('study session records the minutes', logged.data.minutes === 25, logged.data.minutes)
  check('study session links back to the task', logged.data.taskId === id)
  check('study session is dated today', logged.data.date === today)

  // A second session must add to the first, not replace it.
  const before2 = await req('GET', `/tasks/${id}`)
  const sessionTwoMinutes = sessionMinutes(12 * MIN)
  const afterTwo = await req('PUT', `/tasks/${id}`, {
    actualMinutes: nextActualMinutes(before2.data.actualMinutes, sessionTwoMinutes),
    status: 'COMPLETED',
  })
  check('second session accumulates to 37, not 12', afterTwo.data.actualMinutes === 37, afterTwo.data.actualMinutes)
  check('stop({markComplete}) completes the task', afterTwo.data.status === 'COMPLETED', afterTwo.data.status)

  await req('POST', '/study-sessions', {
    date: today, minutes: sessionTwoMinutes, categoryId: null, taskId: id, note: 'Focus session 2',
  })
  const allSessions = await req('GET', '/study-sessions')
  const mine = (allSessions.data as any[]).filter(s => s.taskId === id)
  check('both sessions are logged separately', mine.length === 2, mine.length)
  check('logged minutes sum to actualMinutes',
    mine.reduce((sum, s) => sum + s.minutes, 0) === 37,
    mine.map(s => s.minutes))

  // ----------------------------------------------------------------- teardown
  for (const s of mine) await req('DELETE', `/study-sessions/${s.id}`)
  await req('DELETE', `/tasks/${id}`)
  const gone = await req('GET', `/tasks/${id}`)
  check('cleanup removed the test task', gone.status === 404, gone.status)

  console.log(`\n${pass}/${pass + failures.length} checks passed`)
  if (failures.length) {
    console.log('FAILED: ' + failures.join(', '))
    process.exit(1)
  }
  console.log('Both data loops verified.')
}

main().catch(e => { console.error(e); process.exit(1) })
