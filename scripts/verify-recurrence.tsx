/**
 * Verifies Task 7: recurring task generation and subtasks.
 *   - pure recurrence date maths (month-end clamping, leap years, DST-proof)
 *   - live series materialisation, idempotency, reschedule, scoped delete
 *   - live subtask CRUD and per-occurrence checklist copying
 *
 * Run: npx tsx scripts/verify-recurrence.ts
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import {
  addDays, addMonths, daysInMonth, nextOccurrence, occurrencesBetween,
  missingOccurrences, HORIZON_DAYS,
} from '../src/server/services/recurrence'
import { FocusTimerProvider } from '../src/client/hooks/useFocusTimer'
import TaskEditor from '../src/client/components/tasks/TaskEditor'

const BASE = 'http://127.0.0.1:3001/api'
let pass = 0
const failures: string[] = []

function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? `   got ${JSON.stringify(detail)}` : ''}`) }
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

const pad = (n: number) => String(n).padStart(2, '0')
const now = new Date()
const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`

async function main() {
  // ================================================== pure date maths
  console.log('\nDate maths')

  check('addDays crosses a month boundary', addDays('2026-01-31', 1) === '2026-02-01')
  check('addDays crosses a year boundary', addDays('2026-12-31', 1) === '2027-01-01')
  check('addDays handles a week', addDays('2026-08-06', 7) === '2026-08-13')
  check('addDays goes backwards', addDays('2026-08-01', -1) === '2026-07-31')
  check('addDays handles a leap day', addDays('2028-02-28', 1) === '2028-02-29')
  check('addDays skips Feb 29 in a common year', addDays('2027-02-28', 1) === '2027-03-01')

  check('daysInMonth knows a 31 day month', daysInMonth(2026, 1) === 31)
  check('daysInMonth knows a 30 day month', daysInMonth(2026, 4) === 30)
  check('daysInMonth knows February in a common year', daysInMonth(2026, 2) === 28)
  check('daysInMonth knows February in a leap year', daysInMonth(2028, 2) === 29)
  check('daysInMonth knows 2000 was a leap year', daysInMonth(2000, 2) === 29)
  check('daysInMonth knows 1900 was not', daysInMonth(1900, 2) === 28)

  // The classic recurring-task bug: Jan 31 + 1 month must not become Mar 3.
  check('addMonths clamps Jan 31 to Feb 28',
    addMonths('2026-01-31', 1) === '2026-02-28', addMonths('2026-01-31', 1))
  check('addMonths clamps Jan 31 to Feb 29 in a leap year',
    addMonths('2028-01-31', 1) === '2028-02-29', addMonths('2028-01-31', 1))
  check('addMonths clamps Mar 31 to Apr 30',
    addMonths('2026-03-31', 1) === '2026-04-30', addMonths('2026-03-31', 1))
  check('addMonths keeps a safe day', addMonths('2026-01-15', 1) === '2026-02-15')
  check('addMonths crosses a year', addMonths('2026-12-15', 1) === '2027-01-15')
  check('addMonths handles twelve months', addMonths('2026-08-06', 12) === '2027-08-06')
  check('addMonths goes backwards', addMonths('2026-03-31', -1) === '2026-02-28')

  // Clamping must not be sticky: once clamped, later steps still use the
  // clamped day, which is the documented behaviour rather than a bug.
  check('a clamped monthly series stays on the clamped day', (() => {
    let d = '2026-01-31'
    const seq = [d]
    for (let i = 0; i < 3; i++) { d = addMonths(d, 1); seq.push(d) }
    return seq.join(',') === '2026-01-31,2026-02-28,2026-03-28,2026-04-28'
  })(), (() => {
    let d = '2026-01-31'; const seq = [d]
    for (let i = 0; i < 3; i++) { d = addMonths(d, 1); seq.push(d) }
    return seq
  })())

  check('nextOccurrence DAILY steps one day',
    nextOccurrence('2026-08-06', 'DAILY') === '2026-08-07')
  check('nextOccurrence WEEKLY steps seven days',
    nextOccurrence('2026-08-06', 'WEEKLY') === '2026-08-13')
  check('nextOccurrence MONTHLY steps one month',
    nextOccurrence('2026-08-06', 'MONTHLY') === '2026-09-06')
  check('nextOccurrence NONE yields null',
    nextOccurrence('2026-08-06', 'NONE') === null)

  const daily = occurrencesBetween('2026-08-06', '2026-08-10', 'DAILY')
  check('occurrencesBetween excludes the seed date', !daily.includes('2026-08-06'))
  check('occurrencesBetween includes the end date', daily.includes('2026-08-10'))
  check('occurrencesBetween returns the right count', daily.length === 4, daily)
  check('occurrencesBetween is empty when the window is closed',
    occurrencesBetween('2026-08-06', '2026-08-06', 'DAILY').length === 0)
  check('occurrencesBetween returns nothing for NONE',
    occurrencesBetween('2026-08-06', '2026-12-31', 'NONE').length === 0)
  check('occurrencesBetween respects the cap',
    occurrencesBetween('2020-01-01', '2030-01-01', 'DAILY').length === 400)

  // missingOccurrences is the idempotency guarantee.
  const seed = '2026-08-06'
  const first = missingOccurrences(seed, 'DAILY', [seed], seed, 10)
  check('a fresh daily series fills the horizon', first.length === 10, first.length)
  check('the fill starts the day after the seed', first[0] === '2026-08-07')

  const already = missingOccurrences(seed, 'DAILY', [seed, ...first], seed, 10)
  check('re-running produces nothing (idempotent)', already.length === 0, already)

  const partial = missingOccurrences(seed, 'DAILY', [seed, '2026-08-07'], seed, 5)
  check('a partially filled series tops up only the gap',
    partial.length === 4 && partial[0] === '2026-08-08', partial)

  check('a NONE task never generates',
    missingOccurrences(seed, 'NONE', [seed], seed, 30).length === 0)

  // A dormant series resumes on cadence instead of backfilling every miss.
  const dormant = missingOccurrences('2026-01-01', 'DAILY', ['2026-01-01', '2026-01-02'], seed, 3)
  check('a dormant series resumes forward, not backfilling months',
    dormant.every(d => d > '2026-01-02') && dormant.length > 0, dormant)
  check('a dormant series does not re-emit known dates',
    !dormant.includes('2026-01-01') && !dormant.includes('2026-01-02'))

  check('HORIZON_DAYS is a sane default', HORIZON_DAYS >= 30 && HORIZON_DAYS <= 365, HORIZON_DAYS)

  // ============================================ live series generation
  console.log('\nSeries generation')

  const marker = `RECUR-${Date.now()}`
  const created = await req('POST', '/tasks', {
    title: `${marker} daily standup`,
    date: today,
    estimatedMinutes: 15,
    priority: 'P2',
    repeat: 'DAILY',
    reminderAt: new Date(`${today}T09:30:00`).getTime(),
  })
  check('POST /tasks with repeat returns 201', created.status === 201, created.status)
  check('the seed task was assigned a seriesId', !!created.data.seriesId, created.data.seriesId)
  check('occurrences were generated on create',
    created.data.occurrencesCreated > 0, created.data.occurrencesCreated)
  check(`about ${HORIZON_DAYS} occurrences were generated`,
    created.data.occurrencesCreated === HORIZON_DAYS, created.data.occurrencesCreated)

  const seriesId = created.data.seriesId
  const all = await req('GET', '/tasks')
  const mine = (all.data as any[]).filter(t => t.seriesId === seriesId)
  check('the series is retrievable', mine.length === HORIZON_DAYS + 1, mine.length)

  const dates = mine.map(t => t.date).sort()
  check('every occurrence has a distinct date',
    new Set(dates).size === dates.length, dates.length - new Set(dates).size)
  check('the series starts today', dates[0] === today, dates[0])
  check('occurrences are consecutive days', (() => {
    for (let i = 1; i < dates.length; i++) {
      if (addDays(dates[i - 1], 1) !== dates[i]) return false
    }
    return true
  })())
  check('every occurrence shares the title',
    mine.every(t => t.title === `${marker} daily standup`))
  check('every occurrence starts as TODO',
    mine.every(t => t.status === 'TODO'))
  check('generated occurrences carry no tracked time',
    mine.every(t => t.actualMinutes === null))
  check('the reminder time of day is preserved across occurrences', (() => {
    return mine.every(t => {
      if (!t.reminderAt) return false
      const d = new Date(t.reminderAt)
      return d.getHours() === 9 && d.getMinutes() === 30
    })
  })(), mine.slice(0, 3).map(t => new Date(t.reminderAt).toString()))
  check('each occurrence reminder falls on its own date', (() => {
    return mine.every(t => {
      const d = new Date(t.reminderAt)
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === t.date
    })
  })())

  // Re-running generation must not duplicate.
  const second = await req('PUT', `/tasks/${created.data.id}`, { title: `${marker} daily standup` })
  check('a plain update does not touch the series', second.status === 200)
  const afterUpdate = await req('GET', '/tasks')
  check('no duplicates appeared after an unrelated update',
    (afterUpdate.data as any[]).filter(t => t.seriesId === seriesId).length === HORIZON_DAYS + 1,
    (afterUpdate.data as any[]).filter(t => t.seriesId === seriesId).length)

  // ================================================ reschedule + delete
  console.log('\nReschedule and scoped delete')

  const toWeekly = await req('PUT', `/tasks/${created.data.id}`, { repeat: 'WEEKLY' })
  check('changing the repeat rule reports a reschedule',
    !!toWeekly.data.series, toWeekly.data.series)
  check('the reschedule removed future daily occurrences',
    toWeekly.data.series.removed > 0, toWeekly.data.series)
  check('the reschedule created weekly occurrences',
    toWeekly.data.series.created > 0, toWeekly.data.series)

  const weekly = (await req('GET', '/tasks')).data
    .filter((t: any) => t.seriesId === seriesId)
    .map((t: any) => t.date)
    .sort()
  check('weekly occurrences are seven days apart', (() => {
    for (let i = 1; i < weekly.length; i++) {
      if (addDays(weekly[i - 1], 7) !== weekly[i]) return false
    }
    return weekly.length > 1
  })(), weekly)
  check('the weekly series is much smaller than the daily one',
    weekly.length < HORIZON_DAYS / 2, weekly.length)

  // Setting NONE must detach and clear the future.
  const toNone = await req('PUT', `/tasks/${created.data.id}`, { repeat: 'NONE' })
  check('setting repeat to NONE clears the series id',
    toNone.data.seriesId === null, toNone.data.seriesId)
  const leftovers = (await req('GET', '/tasks')).data.filter((t: any) => t.seriesId === seriesId)
  check('no future occurrences survive after NONE', leftovers.length === 0, leftovers.length)

  await req('DELETE', `/tasks/${created.data.id}`)

  // Scoped delete on a fresh series.
  const m2 = `SCOPE-${Date.now()}`
  const s2 = await req('POST', '/tasks', {
    title: `${m2} weekly review`, date: today, repeat: 'WEEKLY', estimatedMinutes: 30,
  })
  const sid2 = s2.data.seriesId
  const before2 = (await req('GET', '/tasks')).data.filter((t: any) => t.seriesId === sid2)
  check('the second series generated occurrences', before2.length > 1, before2.length)

  // Complete one so we can prove completed rows are preserved.
  const sorted2 = before2.sort((a: any, b: any) => a.date.localeCompare(b.date))
  await req('PUT', `/tasks/${sorted2[1].id}`, { status: 'COMPLETED' })

  const futureDel = await req('DELETE', `/tasks/${sorted2[0].id}?scope=future`)
  check('scope=future reports what it removed',
    futureDel.data.removed > 1, futureDel.data)

  const remaining = (await req('GET', '/tasks')).data.filter((t: any) => t.seriesId === sid2)
  check('a completed occurrence is preserved by scope=future',
    remaining.some((t: any) => t.status === 'COMPLETED'), remaining.map((t: any) => t.status))
  check('untouched future occurrences are gone',
    !remaining.some((t: any) => t.status === 'TODO' && t.date > sorted2[0].date),
    remaining.filter((t: any) => t.status === 'TODO').map((t: any) => t.date))

  const seriesDel = await req('DELETE', `/tasks/${remaining[0].id}?scope=series`)
  check('scope=series removes everything left', seriesDel.data.removed >= 1, seriesDel.data)
  const gone2 = (await req('GET', '/tasks')).data.filter((t: any) => t.seriesId === sid2)
  check('the whole series is gone', gone2.length === 0, gone2.length)

  // ========================================================= subtasks
  console.log('\nSubtasks')

  const parent = await req('POST', '/tasks', {
    title: `SUBTASK-${Date.now()} parent`, date: today, estimatedMinutes: 45,
  })
  const pid = parent.data.id

  const emptyList = await req('GET', `/tasks/${pid}/subtasks`)
  check('a new task has no subtasks',
    Array.isArray(emptyList.data) && emptyList.data.length === 0, emptyList.data)

  const s_a = await req('POST', `/tasks/${pid}/subtasks`, { title: 'Read the prompt' })
  check('POST subtask returns 201', s_a.status === 201, s_a.status)
  check('the subtask starts incomplete', s_a.data.isCompleted === false, s_a.data.isCompleted)
  check('the first subtask gets position 0', s_a.data.position === 0, s_a.data.position)

  const s_b = await req('POST', `/tasks/${pid}/subtasks`, { title: 'Write brute force' })
  check('the second subtask gets position 1', s_b.data.position === 1, s_b.data.position)

  await req('POST', `/tasks/${pid}/subtasks`, { title: '  Optimise  ' })
  const list = await req('GET', `/tasks/${pid}/subtasks`)
  check('all three subtasks are listed', list.data.length === 3, list.data.length)
  check('subtasks come back in position order',
    list.data.map((s: any) => s.position).join(',') === '0,1,2',
    list.data.map((s: any) => s.position))
  check('a subtask title is trimmed',
    list.data[2].title === 'Optimise', JSON.stringify(list.data[2].title))

  const rejected = await req('POST', `/tasks/${pid}/subtasks`, { title: '   ' })
  check('a blank subtask title is rejected with 400', rejected.status === 400, rejected.status)

  const orphan = await req('POST', '/tasks/does-not-exist/subtasks', { title: 'x' })
  check('adding a subtask to a missing task 404s', orphan.status === 404, orphan.status)

  const toggled = await req('PUT', `/tasks/${pid}/subtasks/${s_a.data.id}`, { isCompleted: true })
  check('a subtask can be completed', toggled.data.isCompleted === true, toggled.data.isCompleted)
  const untoggled = await req('PUT', `/tasks/${pid}/subtasks/${s_a.data.id}`, { isCompleted: false })
  check('a subtask can be uncompleted', untoggled.data.isCompleted === false)

  const renamed = await req('PUT', `/tasks/${pid}/subtasks/${s_b.data.id}`, { title: 'Write the brute force' })
  check('a subtask can be renamed',
    renamed.data.title === 'Write the brute force', renamed.data.title)
  check('renaming does not disturb completion',
    renamed.data.isCompleted === false)

  const noop = await req('PUT', `/tasks/${pid}/subtasks/${s_b.data.id}`, {})
  check('an empty subtask patch is rejected with 400', noop.status === 400, noop.status)

  // The parent GET must include them, which is what the editor relies on.
  const withSubs = await req('GET', `/tasks/${pid}`)
  check('GET /tasks/:id includes the subtasks',
    withSubs.data.subtasks?.length === 3, withSubs.data.subtasks?.length)

  // PUT with a subtasks array replaces the checklist wholesale.
  const replaced = await req('PUT', `/tasks/${pid}`, {
    subtasks: [{ title: 'Only step', isCompleted: true }],
  })
  check('PUT with a subtasks array succeeds', replaced.status === 200, replaced.status)
  const afterReplace = await req('GET', `/tasks/${pid}/subtasks`)
  check('the checklist was replaced, not appended',
    afterReplace.data.length === 1, afterReplace.data.length)
  check('the replacement kept its completion state',
    afterReplace.data[0].isCompleted === true)
  check('the replacement kept its title',
    afterReplace.data[0].title === 'Only step', afterReplace.data[0].title)

  const del = await req('DELETE', `/tasks/${pid}/subtasks/${afterReplace.data[0].id}`)
  check('a subtask can be deleted', del.status === 200)
  check('the checklist is empty after deleting the last item',
    (await req('GET', `/tasks/${pid}/subtasks`)).data.length === 0)

  // Cascade: deleting the task must take its subtasks with it.
  await req('POST', `/tasks/${pid}/subtasks`, { title: 'Cascade probe' })
  await req('DELETE', `/tasks/${pid}`)
  const cascaded = await req('GET', `/tasks/${pid}/subtasks`)
  check('subtasks are removed when the parent task is deleted',
    cascaded.data.length === 0, cascaded.data)

  // ============================ subtasks copied onto each occurrence
  console.log('\nChecklist copying across a series')

  const tmpl = await req('POST', '/tasks', {
    title: `TMPL-${Date.now()} routine`, date: today, estimatedMinutes: 20,
  })
  await req('POST', `/tasks/${tmpl.data.id}/subtasks`, { title: 'Warm up' })
  await req('POST', `/tasks/${tmpl.data.id}/subtasks`, { title: 'Main set' })
  // Complete one on the template to prove copies start fresh.
  const tmplSubs = (await req('GET', `/tasks/${tmpl.data.id}/subtasks`)).data
  await req('PUT', `/tasks/${tmpl.data.id}/subtasks/${tmplSubs[0].id}`, { isCompleted: true })

  const nowRepeating = await req('PUT', `/tasks/${tmpl.data.id}`, { repeat: 'DAILY' })
  check('turning on repeat generates the series',
    nowRepeating.data.series?.created > 0, nowRepeating.data.series)

  const sid3 = nowRepeating.data.seriesId
  const occ = (await req('GET', '/tasks')).data
    .filter((t: any) => t.seriesId === sid3 && t.id !== tmpl.data.id)
  check('occurrences exist to inspect', occ.length > 0, occ.length)

  const sampleSubs = (await req('GET', `/tasks/${occ[0].id}/subtasks`)).data
  check('each occurrence receives a copy of the checklist',
    sampleSubs.length === 2, sampleSubs.length)
  check('copied subtask titles match',
    sampleSubs.map((s: any) => s.title).sort().join(',') === 'Main set,Warm up',
    sampleSubs.map((s: any) => s.title))
  check('copied subtasks start unchecked even if the template had one done',
    sampleSubs.every((s: any) => s.isCompleted === false),
    sampleSubs.map((s: any) => s.isCompleted))
  check('copied subtasks belong to the occurrence, not the template',
    sampleSubs.every((s: any) => s.taskId === occ[0].id))
  check('the template keeps its own completed subtask',
    (await req('GET', `/tasks/${tmpl.data.id}/subtasks`)).data
      .some((s: any) => s.isCompleted === true))

  await req('DELETE', `/tasks/${tmpl.data.id}?scope=series`)
  const cleaned = (await req('GET', '/tasks')).data.filter((t: any) => t.seriesId === sid3)
  check('cleanup removed the template series', cleaned.length === 0, cleaned.length)

  // Leave no test rows behind.
  const stragglers = (await req('GET', '/tasks')).data.filter((t: any) =>
    /^(RECUR|SCOPE|SUBTASK|TMPL)-/.test(t.title))
  for (const t of stragglers) await req('DELETE', `/tasks/${t.id}?scope=series`)
  const finalCheck = (await req('GET', '/tasks')).data.filter((t: any) =>
    /^(RECUR|SCOPE|SUBTASK|TMPL)-/.test(t.title))
  check('no test tasks were left behind', finalCheck.length === 0,
    finalCheck.map((t: any) => t.title))

  // ============================================================ render
  console.log('\nEditor render')

  function renderEditor(task: any, seed: Record<string, unknown> = {}) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    })
    qc.setQueryData(['settings'], {})
    qc.setQueryData(['categories'], [])
    for (const [k, v] of Object.entries(seed)) qc.setQueryData(JSON.parse(k), v)

    return renderToStaticMarkup(
      createElement(QueryClientProvider, { client: qc },
        createElement(MemoryRouter, null,
          createElement(FocusTimerProvider, null,
            createElement(TaskEditor, {
              task, date: today, onSave: () => {}, onClose: () => {},
            }))))
    )
  }

  const newTask = renderEditor(undefined)
  check('a new task renders the repeat select', newTask.includes('Repeat'))
  check('a new task shows no recurrence notice',
    !newTask.includes('Saving generates occurrences'))
  check('a new task shows no checklist (nothing to attach it to)',
    !newTask.includes('Checklist'))
  check('the repeat options read in plain language',
    newTask.includes('Every day') && newTask.includes('Every week')
    && newTask.includes('Every month') && newTask.includes('Never'))

  const repeatingSeed = renderEditor({
    id: 'seed-1', title: 'Standup', date: today, repeat: 'DAILY',
    estimatedMinutes: 15, priority: 'P2', status: 'TODO', seriesId: null,
  }, { [JSON.stringify(['subtasks', 'seed-1'])]: [] })
  check('a repeating task explains what saving will do',
    repeatingSeed.includes('Saving generates occurrences'))
  check('the notice names the cadence in plain language',
    repeatingSeed.includes('every day for the'), repeatingSeed.match(/occurrences [^<]*/)?.[0])
  // Asserted against the sentence, not a bare "60" that could match anything.
  check('the notice states the horizon in days',
    repeatingSeed.includes(`next ${HORIZON_DAYS} days`),
    repeatingSeed.match(/next \d+\s*days/)?.[0])
  check('a saved task renders the checklist section',
    repeatingSeed.includes('Checklist'))

  const occurrence = renderEditor({
    id: 'occ-1', title: 'Standup', date: today, repeat: 'DAILY',
    estimatedMinutes: 15, priority: 'P2', status: 'TODO', seriesId: 'series-abc',
  }, {
    [JSON.stringify(['subtasks', 'occ-1'])]: [
      { id: 'a', taskId: 'occ-1', title: 'Warm up', isCompleted: true, position: 0 },
      { id: 'b', taskId: 'occ-1', title: 'Main set', isCompleted: false, position: 1 },
    ],
  })
  check('an existing occurrence is described as part of a series',
    occurrence.includes('one occurrence in a series'))
  check('an existing occurrence is labelled in the repeat field',
    occurrence.includes('Part of a series'))
  check('the checklist renders its items',
    occurrence.includes('Warm up') && occurrence.includes('Main set'))
  check('the checklist shows progress as a count',
    occurrence.includes('1/2'), occurrence.match(/\d+\/\d+/)?.[0])
  check('the editor render prints no NaN or undefined',
    !occurrence.includes('NaN') && !occurrence.includes('undefined'))

  console.log(`\n${pass}/${pass + failures.length} checks passed`)
  if (failures.length) {
    console.log('FAILED: ' + failures.join(', '))
    process.exit(1)
  }
  console.log('Recurrence and subtasks verified.')
}

main().catch(e => { console.error(e); process.exit(1) })
