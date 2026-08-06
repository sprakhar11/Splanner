/**
 * Verifies Task 5: the Reflection and Settings pages.
 *   - pure settings parse/serialise/clamp over the string-typed KV store
 *   - pure reflection prefill rules
 *   - live reflections API round trip, including the whitelist hardening
 *   - headless render of both pages on empty and populated data
 *
 * Run: npx tsx scripts/verify-settings-reflection.tsx
 */

import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import { readFileSync } from 'fs'
import {
  readSetting, readAll, writeSetting, clampSetting, DEFAULTS,
} from '../src/client/lib/settings'
import { monthGrid, dowLabels } from '../src/client/lib/date'

/** Files that are allowed to consume a setting. Every key must appear in one. */
const CONSUMER_FILES = [
  'src/client/components/layout/TopBar.tsx',
  'src/client/components/tasks/TaskEditor.tsx',
  'src/client/hooks/useAppearance.ts',
  'src/client/hooks/useReminders.ts',
  'src/client/hooks/useFocusTimer.tsx',
  'src/client/pages/Planner.tsx',
  'src/client/pages/Stats.tsx',
  'src/client/pages/Reflection.tsx',
]
import {
  dayActuals, initialReflectionForm, matchesActuals, toReflectionPayload, DEFAULT_MOOD,
} from '../src/client/lib/reflection'
import { ToastProvider } from '../src/client/components/ui/toast'
import Reflection from '../src/client/pages/Reflection'
import SettingsPage from '../src/client/pages/Settings'

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
const nowD = new Date()
const today = `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}-${pad(nowD.getDate())}`

function render(node: any, seed: Record<string, unknown>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
  })
  for (const [key, value] of Object.entries(seed)) {
    qc.setQueryData(JSON.parse(key), value)
  }
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client: qc },
      createElement(MemoryRouter, null,
        createElement(ToastProvider, null, createElement(node))))
  )
}

async function main() {
  // ===================================================== settings pure layer
  console.log('\nSettings — typed layer over the string KV store')

  check('a missing key falls back to its default',
    readSetting(undefined, 'dailyStudyGoalHours') === DEFAULTS.dailyStudyGoalHours)
  check('an empty string falls back to its default',
    readSetting({ pomodoroMinutes: '' }, 'pomodoroMinutes') === DEFAULTS.pomodoroMinutes)
  check('a numeric string parses to a number',
    readSetting({ pomodoroMinutes: '50' }, 'pomodoroMinutes') === 50)
  check('a fractional setting parses',
    readSetting({ dailyStudyGoalHours: '2.5' }, 'dailyStudyGoalHours') === 2.5)
  check('a non-numeric string falls back rather than yielding NaN',
    readSetting({ pomodoroMinutes: 'abc' }, 'pomodoroMinutes') === DEFAULTS.pomodoroMinutes)
  check('"true" parses to boolean true',
    readSetting({ notificationsEnabled: 'true' }, 'notificationsEnabled') === true)
  check('"false" parses to boolean false',
    readSetting({ notificationsEnabled: 'false' }, 'notificationsEnabled') === false)
  check('any other string is not truthy for a boolean',
    readSetting({ notificationsEnabled: '1' }, 'notificationsEnabled') === false)
  check('a string setting round trips',
    readSetting({ userName: 'Ada' }, 'userName') === 'Ada')
  check('an invalid choice falls back to the default',
    readSetting({ darkMode: 'neon' }, 'darkMode') === DEFAULTS.darkMode)
  check('a valid choice is kept',
    readSetting({ darkMode: 'light' }, 'darkMode') === 'light')

  // Guards against inventing client-only keys that a fresh database never seeds.
  check('every client setting key exists in the server seed defaults', (() => {
    const seed = readFileSync(
      new URL('../src/server/db/seed.ts', import.meta.url), 'utf8'
    )
    const missing = (Object.keys(DEFAULTS) as string[])
      .filter(k => k !== 'weekStartsMonday' ? !seed.includes(`${k}:`) : !seed.includes(`${k}:`))
    return missing.length === 0
  })(), (() => {
    const seed = readFileSync(new URL('../src/server/db/seed.ts', import.meta.url), 'utf8')
    return (Object.keys(DEFAULTS) as string[]).filter(k => !seed.includes(`${k}:`))
  })())

  // Guards against shipping a control that writes a setting nothing reads.
  check('every setting is consumed by at least one consumer', (() => {
    const consumers = CONSUMER_FILES.map(f =>
      readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n')
    return (Object.keys(DEFAULTS) as string[]).every(k => consumers.includes(k))
  })(), (() => {
    const consumers = CONSUMER_FILES.map(f =>
      readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')).join('\n')
    return (Object.keys(DEFAULTS) as string[]).filter(k => !consumers.includes(k))
  })())

  check('booleans serialise to "true"/"false"',
    writeSetting(true) === 'true' && writeSetting(false) === 'false')
  check('numbers serialise to digits', writeSetting(42) === '42')

  const roundTrip = readAll(
    Object.fromEntries(
      Object.entries(DEFAULTS).map(([k, v]) => [k, writeSetting(v as any)])
    )
  )
  check('write-then-read reproduces every default exactly',
    JSON.stringify(roundTrip) === JSON.stringify(DEFAULTS),
    { roundTrip, DEFAULTS })

  check('readAll returns every known key',
    Object.keys(readAll(undefined)).length === Object.keys(DEFAULTS).length)

  check('clamp raises a below-range value',
    clampSetting('pomodoroMinutes', 1) === 5)
  check('clamp lowers an above-range value',
    clampSetting('pomodoroMinutes', 9999) === 180)
  check('clamp leaves an in-range value alone',
    clampSetting('pomodoroMinutes', 25) === 25)
  check('clamp rounds a fractional pomodoro to a whole minute',
    clampSetting('pomodoroMinutes', 30.6) === 31)
  check('clamp snaps the study goal to the nearest half hour',
    clampSetting('dailyStudyGoalHours', 3.3) === 3.5, clampSetting('dailyStudyGoalHours', 3.3))
  check('clamp keeps a valid half-hour study goal',
    clampSetting('dailyStudyGoalHours', 2.5) === 2.5)
  check('clamp floors the study goal at half an hour',
    clampSetting('dailyStudyGoalHours', 0) === 0.5)
  check('clamp caps the study goal at 16 hours',
    clampSetting('dailyStudyGoalHours', 40) === 16)
  check('clamp passes through a key with no range',
    clampSetting('userName' as any, 5) === 5)

  // ------------------------------------------------- week start wiring
  console.log('\nWeek start setting')

  check('Sunday-first labels begin on Sunday', dowLabels(false)[0] === 'Sunday')
  check('Monday-first labels begin on Monday', dowLabels(true)[0] === 'Monday')
  check('Monday-first labels end on Sunday', dowLabels(true)[6] === 'Sunday')
  check('both label sets have seven days',
    dowLabels(true).length === 7 && dowLabels(false).length === 7)

  // August 2026 starts on a Saturday.
  const sunGrid = monthGrid(2026, 7, false)
  const monGrid = monthGrid(2026, 7, true)
  check('both grids are 42 cells',
    sunGrid.length === 42 && monGrid.length === 42)
  check('Sunday-first grid starts on a Sunday',
    sunGrid[0].date.getDay() === 0, sunGrid[0].iso)
  check('Monday-first grid starts on a Monday',
    monGrid[0].date.getDay() === 1, monGrid[0].iso)
  check('both grids contain the first of the month',
    sunGrid.some(c => c.iso === '2026-08-01') && monGrid.some(c => c.iso === '2026-08-01'))
  check('both grids contain the last of the month',
    sunGrid.some(c => c.iso === '2026-08-31') && monGrid.some(c => c.iso === '2026-08-31'))
  check('the two grids genuinely differ', sunGrid[0].iso !== monGrid[0].iso,
    [sunGrid[0].iso, monGrid[0].iso])

  // A month that begins exactly on Monday must not gain a blank leading week.
  const june2026 = monthGrid(2026, 5, true) // June 2026 starts on a Monday
  check('a Monday-starting month needs no lead in Monday-first mode',
    june2026[0].iso === '2026-06-01', june2026[0].iso)

  // =================================================== reflection pure layer
  console.log('\nReflection — prefill rules')

  const sessions = [
    { date: today, minutes: 50 },
    { date: today, minutes: 40 },
    { date: '2020-01-01', minutes: 999 },
  ]
  const tasks = [
    { date: today, status: 'COMPLETED' },
    { date: today, status: 'COMPLETED' },
    { date: today, status: 'TODO' },
    { date: '2020-01-01', status: 'COMPLETED' },
  ]

  const actuals = dayActuals(sessions, tasks, today)
  check('actuals sum only the requested day', actuals.minutes === 90, actuals.minutes)
  check('actuals convert minutes to hours', actuals.hours === 1.5, actuals.hours)
  check('actuals count only completed tasks', actuals.completed === 2, actuals.completed)
  check('actuals handle a day with nothing', (() => {
    const a = dayActuals(sessions, tasks, '1999-05-05')
    return a.minutes === 0 && a.hours === 0 && a.completed === 0
  })())
  check('actuals tolerate a null minutes value',
    dayActuals([{ date: today, minutes: null }], [], today).minutes === 0)

  const fresh = initialReflectionForm(null, actuals)
  check('a new entry prefills tasks from tracked activity',
    fresh.tasksCompletedCount === 2, fresh.tasksCompletedCount)
  check('a new entry prefills hours from tracked activity',
    fresh.hoursStudied === 1.5, fresh.hoursStudied)
  check('a new entry leaves problems solved at zero',
    fresh.problemsSolvedCount === 0)
  check('a new entry defaults mood to neutral', fresh.mood === DEFAULT_MOOD)
  check('a new entry starts with empty prompts',
    fresh.learnedSummary === '' && fresh.struggledSummary === '' && fresh.gratitude === '')

  // The important rule: a saved entry must never be overwritten by actuals.
  const saved = initialReflectionForm(
    { tasksCompletedCount: 7, hoursStudied: 9, mood: 5, learnedSummary: 'kept' },
    actuals
  )
  check('a saved entry wins over tracked activity',
    saved.tasksCompletedCount === 7 && saved.hoursStudied === 9, saved)
  check('a saved prompt is preserved', saved.learnedSummary === 'kept')
  check('a saved mood is preserved', saved.mood === 5)

  // A legitimate saved zero must survive, not be replaced by actuals.
  const savedZero = initialReflectionForm(
    { tasksCompletedCount: 0, hoursStudied: 0 }, actuals
  )
  check('a saved zero is respected, not treated as missing',
    savedZero.tasksCompletedCount === 0 && savedZero.hoursStudied === 0, savedZero)

  check('matchesActuals is true for a fresh prefill', matchesActuals(fresh, actuals))
  check('matchesActuals is false once edited',
    !matchesActuals({ ...fresh, hoursStudied: 3 }, actuals))

  const payload = toReflectionPayload(today, { ...fresh, mood: 4 })
  check('payload carries the date', payload.date === today)
  check('payload coerces numerics', typeof payload.hoursStudied === 'number')
  check('payload falls back to neutral mood on a zero',
    toReflectionPayload(today, { ...fresh, mood: 0 }).mood === DEFAULT_MOOD)
  check('payload contains only writable columns',
    JSON.stringify(Object.keys(payload).sort()) === JSON.stringify([
      'date', 'gratitude', 'hoursStudied', 'learnedSummary', 'mood',
      'problemsSolvedCount', 'struggledSummary', 'tasksCompletedCount',
    ]), Object.keys(payload).sort())

  // ==================================================== reflections API live
  console.log('\nReflections API')

  const testDate = '2019-03-14'
  const created = await req('POST', '/reflections', {
    date: testDate, tasksCompletedCount: 3, hoursStudied: 2.5,
    problemsSolvedCount: 4, mood: 4,
    learnedSummary: 'Binary search on answers.',
    struggledSummary: 'Off by one.', gratitude: 'Good coffee.',
  })
  check('POST /reflections creates and returns 201', created.status === 201, created.status)
  check('hoursStudied keeps its decimal', created.data.hoursStudied === 2.5, created.data.hoursStudied)
  check('mood persists', created.data.mood === 4)

  // Upsert by date: a second POST must update, not duplicate.
  const upserted = await req('POST', '/reflections', {
    date: testDate, mood: 2, learnedSummary: 'Changed my mind.',
  })
  check('a second POST for the same date upserts', upserted.status === 200, upserted.status)
  check('upsert applies the new mood', upserted.data.mood === 2, upserted.data.mood)
  check('upsert leaves untouched columns alone',
    upserted.data.problemsSolvedCount === 4, upserted.data.problemsSolvedCount)

  const all = await req('GET', '/reflections')
  check('upsert did not create a duplicate row',
    (all.data as any[]).filter(r => r.date === testDate).length === 1)

  // The hardening: unknown keys must be dropped, not passed into the statement.
  const withJunk = await req('POST', '/reflections', {
    date: testDate, mood: 5, notAColumn: 'boom', tags: ['x'],
  })
  check('POST tolerates unknown keys without a 500',
    withJunk.status === 200, withJunk.status)
  check('unknown keys are dropped but valid ones still apply',
    withJunk.data.mood === 5, withJunk.data.mood)

  const noDate = await req('POST', '/reflections', { mood: 3 })
  check('POST without a date is rejected with 400', noDate.status === 400, noDate.status)

  const missing = await req('GET', '/reflections/1998-01-01')
  check('GET for an unwritten day 404s (the hook maps this to null)',
    missing.status === 404, missing.status)

  await req('DELETE', `/reflections/${created.data.id}`)
  const gone = await req('GET', `/reflections/${testDate}`)
  check('cleanup removed the test reflection', gone.status === 404, gone.status)

  // ======================================================== settings API live
  console.log('\nSettings API')

  const before = await req('GET', '/settings')
  const saveRes = await req('PUT', '/settings', {
    userName: 'VerifyBot', pomodoroMinutes: '45', notificationsEnabled: 'true',
  })
  check('PUT /settings returns the full map', saveRes.status === 200, saveRes.status)
  check('PUT persists a string setting', saveRes.data.userName === 'VerifyBot')
  check('PUT persists a numeric setting as text', saveRes.data.pomodoroMinutes === '45')

  const reread = readAll(saveRes.data)
  check('the typed layer reads the saved number back as 45',
    reread.pomodoroMinutes === 45, reread.pomodoroMinutes)
  check('the typed layer reads the saved boolean back as true',
    reread.notificationsEnabled === true)
  check('unsaved keys still resolve to defaults',
    reread.dailyStudyGoalHours === DEFAULTS.dailyStudyGoalHours)

  // Restore whatever was there before, so verification leaves no trace.
  await req('PUT', '/settings', {
    userName: before.data.userName ?? DEFAULTS.userName,
    pomodoroMinutes: before.data.pomodoroMinutes ?? String(DEFAULTS.pomodoroMinutes),
    notificationsEnabled: before.data.notificationsEnabled ?? 'false',
  })
  const after = await req('GET', '/settings')
  check('prior settings were restored',
    after.data.userName === (before.data.userName ?? DEFAULTS.userName),
    after.data.userName)

  // ============================================================ page renders
  console.log('\nReflection page render')

  const wide = { from: today, to: today }
  let emptyRefl = ''
  try {
    emptyRefl = render(Reflection, {
      [JSON.stringify(['reflections', today])]: null,
      [JSON.stringify(['reflections'])]: [],
      [JSON.stringify(['studySessions', wide])]: [],
      [JSON.stringify(['tasks', wide])]: [],
    })
    check('Reflection renders with no entries', emptyRefl.length > 0)
  } catch (e: any) {
    check('Reflection renders with no entries', false, e.message)
  }
  check('empty Reflection invites a first entry', emptyRefl.includes('No entries yet'))
  check('empty Reflection says nothing is written',
    emptyRefl.includes('Nothing written for this day yet'))
  check('empty Reflection shows all three prompts',
    emptyRefl.includes('What did you learn?')
    && emptyRefl.includes('What did you struggle with?')
    && emptyRefl.includes('One good thing'))
  check('empty Reflection shows the mood picker', emptyRefl.includes('How did the day feel?'))
  check('Reflection prints no NaN or undefined',
    !emptyRefl.includes('NaN') && !emptyRefl.includes('undefined'))

  let fullRefl = ''
  try {
    fullRefl = render(Reflection, {
      [JSON.stringify(['reflections', today])]: {
        id: 'x', date: today, mood: 5, hoursStudied: 3.5,
        tasksCompletedCount: 4, problemsSolvedCount: 2,
        learnedSummary: 'Topological sort via in-degree.',
        struggledSummary: '', gratitude: '',
      },
      [JSON.stringify(['reflections'])]: [
        { id: 'x', date: today, mood: 5, hoursStudied: 3.5, learnedSummary: 'Topological sort via in-degree.' },
      ],
      [JSON.stringify(['studySessions', wide])]: [{ date: today, minutes: 210 }],
      [JSON.stringify(['tasks', wide])]: [{ date: today, status: 'COMPLETED' }],
    })
    check('Reflection renders a written day', fullRefl.length > 0)
  } catch (e: any) {
    check('Reflection renders a written day', false, e.message)
  }
  check('a written day is badged as written', fullRefl.includes('written'))
  check('a written day lists its entry in the sidebar',
    fullRefl.includes('Topological sort via in-degree.'))
  check('a written day offers an update rather than a save',
    fullRefl.includes('Update entry'), fullRefl.match(/(Update|Save) entry/)?.[0])

  console.log('\nSettings page render')

  let emptySet = ''
  try {
    emptySet = render(SettingsPage, {
      [JSON.stringify(['settings'])]: {},
      [JSON.stringify(['categories'])]: [],
    })
    check('Settings renders with no stored settings', emptySet.length > 0)
  } catch (e: any) {
    check('Settings renders with no stored settings', false, e.message)
  }
  check('Settings shows every section',
    ['Profile', 'Goals', 'Notifications', 'Appearance', 'Categories', 'Your data']
      .every(s => emptySet.includes(s)),
    ['Profile', 'Goals', 'Notifications', 'Appearance', 'Categories', 'Your data']
      .filter(s => !emptySet.includes(s)))
  check('Settings falls back to the default user name',
    emptySet.includes(DEFAULTS.userName))
  check('Settings renders the default study goal',
    emptySet.includes(String(DEFAULTS.dailyStudyGoalHours)))
  check('Settings warns that replace mode wipes data',
    emptySet.includes('Wipes everything first'))
  check('Settings prints no NaN or undefined',
    !emptySet.includes('NaN') && !emptySet.includes('undefined'))

  let fullSet = ''
  try {
    fullSet = render(SettingsPage, {
      [JSON.stringify(['settings'])]: {
        userName: 'Prakhar', pomodoroMinutes: '50', notificationsEnabled: 'true',
      },
      [JSON.stringify(['categories'])]: [
        { id: 'c1', name: 'DSA', color: 0xff3b82f6, iconName: 'folder', position: 0 },
        { id: 'c2', name: 'System Design', color: 0xff8b5cf6, iconName: 'folder', position: 1 },
      ],
    })
    check('Settings renders with stored settings and categories', fullSet.length > 0)
  } catch (e: any) {
    check('Settings renders with stored settings and categories', false, e.message)
  }
  check('stored numeric setting is rendered', fullSet.includes('50'))
  check('categories are listed', fullSet.includes('DSA') && fullSet.includes('System Design'))
  check('category count is reported', fullSet.includes('2 in use'))

  console.log(`\n${pass}/${pass + failures.length} checks passed`)
  if (failures.length) {
    console.log('FAILED: ' + failures.join(', '))
    process.exit(1)
  }
  console.log('Reflection and Settings verified.')
}

main().catch(e => { console.error(e); process.exit(1) })
