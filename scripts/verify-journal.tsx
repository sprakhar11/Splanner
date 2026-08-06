/**
 * Verifies the smart stopwatch work:
 *   - the journal prompt threshold and note-type derivation (pure)
 *   - entry building, appending, and tag merging across repeat sessions (pure)
 *   - live round trip: session -> note -> optional revision card
 *   - append-on-second-session preserves revision progress
 *   - the notes PUT hardening
 *   - headless render of the sheet
 *
 * Run: npx tsx scripts/verify-journal.tsx
 */

import { readFileSync } from 'fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { MemoryRouter } from 'react-router-dom'

import {
  shouldPromptJournal, deriveNoteType, isDraftEmpty, buildEntry, appendEntry,
  mergeTags, parseTags, initialDraft, countEntries,
  JOURNAL_PROMPT_MIN_MINUTES, NOTE_TYPES,
  initialUntitledDraft, isUntitledDraftValid, buildTaskFromSession,
} from '../src/client/lib/journal'
import { sessionMinutes } from '../src/client/lib/focus'
import { readSetting, DEFAULTS } from '../src/client/lib/settings'
import { ToastProvider } from '../src/client/components/ui/toast'
import { PictureInPictureProvider } from '../src/client/hooks/usePictureInPicture'
import { FocusTimerProvider } from '../src/client/hooks/useFocusTimer'
import SessionJournalSheet from '../src/client/components/focus/SessionJournalSheet'

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
const d = new Date()
const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const MIN = 60_000

async function main() {
  // ============================================== threshold + derivation
  console.log('\nPrompt threshold')

  check('the threshold is 10 minutes as agreed',
    JOURNAL_PROMPT_MIN_MINUTES === 10, JOURNAL_PROMPT_MIN_MINUTES)
  check('a 4 minute session does not prompt', !shouldPromptJournal(4))
  check('a 9 minute session does not prompt', !shouldPromptJournal(9))
  check('exactly 10 minutes prompts', shouldPromptJournal(10))
  check('a 45 minute session prompts', shouldPromptJournal(45))
  check('a zero minute session does not prompt', !shouldPromptJournal(0))
  check('the threshold is overridable', shouldPromptJournal(5, { threshold: 5 }))

  // A 3-second session still logs 1 minute (focus.ts) but must not prompt.
  check('a session rounded up to 1 minute still does not prompt',
    !shouldPromptJournal(sessionMinutes(3000)), sessionMinutes(3000))

  // An untitled session has nothing but minutes: skipping the prompt would
  // orphan the time with no name and no task, so it always prompts.
  console.log('\nUntitled sessions always prompt')

  check('a 1 minute untitled session still prompts',
    shouldPromptJournal(1, { hasTask: false }))
  check('a 4 minute untitled session still prompts',
    shouldPromptJournal(4, { hasTask: false }))
  check('a 4 minute session WITH a task does not prompt',
    !shouldPromptJournal(4, { hasTask: true }))
  check('hasTask defaults to true so existing behaviour is unchanged',
    !shouldPromptJournal(4))

  console.log('\nUntitled draft')

  check('an untitled draft starts blank', initialUntitledDraft().title === '')
  check('retroactive logging defaults to done',
    initialUntitledDraft().markComplete === true)
  check('an untitled draft starts with no category',
    initialUntitledDraft().categoryId === '')
  check('a blank title is invalid', !isUntitledDraftValid({ title: '' }))
  check('a whitespace title is invalid', !isUntitledDraftValid({ title: '   ' }))
  check('a real title is valid', isUntitledDraftValid({ title: 'Read docs' }))

  const built = buildTaskFromSession({
    title: '  Reviewed system design  ', categoryId: '', minutes: 37,
    date: today, markComplete: true,
  })
  check('the generated task title is trimmed',
    built.title === 'Reviewed system design', built.title)
  check('the generated task carries the tracked time',
    built.actualMinutes === 37, built.actualMinutes)
  check('estimate equals actual so estimate-accuracy stays honest',
    built.estimatedMinutes === built.actualMinutes,
    { est: built.estimatedMinutes, act: built.actualMinutes })
  check('an empty category becomes null, not an FK violation',
    built.categoryId === null, built.categoryId)
  check('marking done yields COMPLETED', built.status === 'COMPLETED')
  check('leaving it open yields IN_PROGRESS',
    buildTaskFromSession({
      title: 'x', categoryId: '', minutes: 5, date: today, markComplete: false,
    }).status === 'IN_PROGRESS')
  check('the generated task is dated today', built.date === today)

  console.log('\nNote type derivation')

  check('a recorded mistake makes it a MISTAKE note',
    deriveNoteType('off by one', '') === 'MISTAKE')
  check('a mistake wins over a lesson',
    deriveNoteType('off by one', 'sliding window') === 'MISTAKE')
  check('only a lesson makes it a CONCEPT note',
    deriveNoteType('', 'sliding window') === 'CONCEPT')
  check('an empty draft stays GENERAL', deriveNoteType('', '') === 'GENERAL')
  check('whitespace does not count as content',
    deriveNoteType('   ', '  ') === 'GENERAL')
  check('MISTAKE is offered first in the type list',
    NOTE_TYPES[0] === 'MISTAKE', NOTE_TYPES[0])

  check('an empty draft is detected', isDraftEmpty({ mistake: '', learned: '' }))
  check('a whitespace draft is empty', isDraftEmpty({ mistake: ' ', learned: '\n' }))
  check('a draft with only a mistake is not empty',
    !isDraftEmpty({ mistake: 'x', learned: '' }))
  check('a draft with only a lesson is not empty',
    !isDraftEmpty({ mistake: '', learned: 'x' }))

  console.log('\nEntry building')

  const entry = buildEntry({ date: today, minutes: 45, mistake: 'Off by one', learned: 'Monotonic' })
  check('the entry heads with date and duration',
    entry.startsWith(`## ${today} · 45m`), entry.split('\n')[0])
  check('the entry includes the lesson', entry.includes('Monotonic'))
  check('the entry includes the mistake', entry.includes('Off by one'))
  check('the entry labels both sections',
    entry.includes('**Learned**') && entry.includes('**Went wrong**'))

  const mistakeOnly = buildEntry({ date: today, minutes: 20, mistake: 'Bad comparator', learned: '' })
  check('an entry with no lesson omits that section',
    !mistakeOnly.includes('**Learned**'), mistakeOnly)
  check('an entry with no lesson keeps the mistake',
    mistakeOnly.includes('Bad comparator'))

  console.log('\nAppending across sessions')

  check('appending to nothing returns the entry alone',
    appendEntry(null, entry) === entry)
  check('appending to a blank note replaces rather than pads',
    appendEntry('   ', entry) === entry)

  const two = appendEntry(entry, mistakeOnly)
  check('appending keeps the earlier entry', two.includes('Monotonic'))
  check('appending adds the newer entry', two.includes('Bad comparator'))
  check('the newest entry comes last (chronological)',
    two.indexOf('Bad comparator') > two.indexOf('Monotonic'))
  check('entries are separated by a blank line', two.includes('\n\n## '))

  check('an empty note counts zero entries', countEntries('') === 0)
  check('a null note counts zero entries', countEntries(null) === 0)
  check('one entry is counted', countEntries(entry) === 1)
  check('two entries are counted', countEntries(two) === 2, countEntries(two))

  console.log('\nTag handling')

  check('tags are parsed from a comma list',
    JSON.stringify(parseTags('dsa, arrays')) === JSON.stringify(['dsa', 'arrays']))
  check('a leading hash is stripped',
    JSON.stringify(parseTags('#dsa')) === JSON.stringify(['dsa']))
  check('blank entries are dropped',
    JSON.stringify(parseTags('dsa, , ,arrays')) === JSON.stringify(['dsa', 'arrays']))
  check('merging is case-insensitive but keeps the first spelling',
    JSON.stringify(mergeTags(['DSA'], ['dsa'])) === JSON.stringify(['DSA']),
    mergeTags(['DSA'], ['dsa']))
  check('merging unions distinct tags',
    JSON.stringify(mergeTags(['a'], ['b'])) === JSON.stringify(['a', 'b']))
  check('repeat sessions do not duplicate tags',
    mergeTags(['dsa', 'arrays'], ['dsa', 'arrays']).length === 2)

  console.log('\nInitial draft')

  const seeded = initialDraft({ tags: ['dsa', 'sliding-window'] })
  check('the draft prefills tags from the task',
    JSON.stringify(seeded.tags) === JSON.stringify(['dsa', 'sliding-window']))
  check('revision scheduling is OFF by default',
    seeded.scheduleRevision === false)
  check('the prose fields start empty',
    seeded.mistake === '' && seeded.learned === '')
  check('a task with no tags yields an empty tag list',
    initialDraft({}).tags.length === 0)
  check('a null task is tolerated', initialDraft(null).tags.length === 0)

  console.log('\nPop-out setting')

  check('focusPopOut defaults to on', DEFAULTS.focusPopOut === true)
  check('focusPopOut reads back from storage',
    readSetting({ focusPopOut: 'false' }, 'focusPopOut') === false)
  check('focusPopOut is seeded server-side, so a fresh database has it',
    readFileSync(new URL('../src/server/db/seed.ts', import.meta.url), 'utf8')
      .includes('focusPopOut'))

  // The seed used to only run on an empty table, so a key added in a later
  // version never reached an existing database until the user saved Settings.
  const live = await req('GET', '/settings')
  check('every client setting key is present in the live database', (() => {
    const missing = Object.keys(DEFAULTS).filter(k => !(k in live.data))
    return missing.length === 0
  })(), Object.keys(DEFAULTS).filter(k => !(k in live.data)))
  check('the backfill did not clobber an existing value',
    live.data.userName === 'Prakhar', live.data.userName)

  // ================================================= live: note creation
  console.log('\nLive: session to note')

  const task = await req('POST', '/tasks', {
    title: `JOURNAL-${Date.now()} Trapping Rain Water`,
    date: today, estimatedMinutes: 40,
    tags: ['dsa', 'two-pointers'],
  })
  const taskId = task.data.id
  check('the probe task was created', task.status === 201, task.status)
  check('the probe task starts with no linked note',
    !task.data.linkedNoteId, task.data.linkedNoteId)

  // Mirrors the sheet's create path, with revision opted OUT.
  const firstEntry = buildEntry({
    date: today, minutes: 45, mistake: 'Forgot the running max from the right', learned: '',
  })
  const note = await req('POST', '/notes', {
    title: task.data.title,
    content: firstEntry,
    type: 'MISTAKE',
    categoryId: null,
    revisionScheduled: false,
    tags: ['dsa', 'two-pointers'],
  })
  check('POST /notes returns 201', note.status === 201, note.status)
  check('the note stored the entry', note.data.content.includes('running max'))
  check('the note type is MISTAKE', note.data.type === 'MISTAKE')
  check('revisionScheduled is false when opted out',
    !note.data.revisionScheduled, note.data.revisionScheduled)

  const revsAfterOptOut = await req('GET', '/revisions')
  check('opting out creates NO revision card',
    !(revsAfterOptOut.data as any[]).some(r => r.noteId === note.data.id),
    (revsAfterOptOut.data as any[]).filter(r => r.noteId === note.data.id))

  // Link it back, as the sheet does.
  const linked = await req('PUT', `/tasks/${taskId}`, { linkedNoteId: note.data.id })
  check('the task is linked to the note',
    linked.data.linkedNoteId === note.data.id, linked.data.linkedNoteId)

  // ============================================ live: append + opt-in card
  console.log('\nLive: second session appends and opts in')

  const existing = await req('GET', `/notes/${note.data.id}`)
  check('GET /notes/:id returns tags for merging',
    Array.isArray(existing.data.tags), existing.data.tags)

  const secondEntry = buildEntry({
    date: today, minutes: 25, mistake: '', learned: 'Two pointers beat the DP here',
  })
  const appended = await req('PUT', `/notes/${note.data.id}`, {
    title: existing.data.title,
    content: appendEntry(existing.data.content, secondEntry),
    type: 'CONCEPT',
    revisionScheduled: true,
    tags: mergeTags(existing.data.tags, ['optimisation']),
  })
  check('PUT /notes succeeds', appended.status === 200, appended.status)
  check('the appended note keeps the first entry',
    appended.data.content.includes('running max'))
  check('the appended note adds the second entry',
    appended.data.content.includes('Two pointers beat'))
  check('the note now holds two entries',
    countEntries(appended.data.content) === 2, countEntries(appended.data.content))
  check('opting in flipped revisionScheduled',
    !!appended.data.revisionScheduled)

  const merged = await req('GET', `/notes/${note.data.id}`)
  check('tags were merged, not replaced',
    ['dsa', 'two-pointers', 'optimisation'].every(t => merged.data.tags.includes(t)),
    merged.data.tags)

  const revs = await req('GET', '/revisions')
  const card = (revs.data as any[]).find(r => r.noteId === note.data.id)
  check('opting in DID create a revision card', !!card, card)
  check('the card is due today (stage 0)', card?.nextDueDate === today, card?.nextDueDate)
  check('the card derives its concept from the note',
    typeof card?.concept === 'string' && card.concept.length > 0, card?.concept)

  // Grading then re-appending must not reset the schedule.
  const graded = await req('POST', `/revisions/${card.id}/grade`, { grade: 'GOOD' })
  check('the card can be graded', graded.status === 200, graded.status)
  const advanced = (await req('GET', '/revisions')).data
    .find((r: any) => r.noteId === note.data.id)
  check('grading advanced the stage',
    advanced.currentStepIndex > 0, advanced.currentStepIndex)

  const thirdEntry = buildEntry({ date: today, minutes: 15, mistake: 'Slipped again', learned: '' })
  await req('PUT', `/notes/${note.data.id}`, {
    title: merged.data.title,
    content: appendEntry(advanced ? merged.data.content : '', thirdEntry),
    revisionScheduled: true,
  })
  const preserved = (await req('GET', '/revisions')).data
    .find((r: any) => r.noteId === note.data.id)
  check('a later append PRESERVES revision progress',
    preserved.currentStepIndex === advanced.currentStepIndex,
    { before: advanced.currentStepIndex, after: preserved.currentStepIndex })

  // Turning revision back off removes the card.
  await req('PUT', `/notes/${note.data.id}`, { revisionScheduled: false })
  const removed = (await req('GET', '/revisions')).data
    .find((r: any) => r.noteId === note.data.id)
  check('opting back out deletes the card', !removed, removed)

  // Deleting a note must take its derived card with it. The FK is
  // ON DELETE SET NULL, so without explicit cleanup the card survived as an
  // orphan: stuck in the queue with no source to edit or trace back to.
  console.log('\nDeleting a note cleans up its card')

  const cardNote = await req('POST', '/notes', {
    title: `ORPHAN-PROBE-${Date.now()}`,
    content: 'Concept worth revisiting.',
    type: 'CONCEPT',
    revisionScheduled: true,
  })
  const probeCard = (await req('GET', '/revisions')).data
    .find((r: any) => r.noteId === cardNote.data.id)
  check('the probe note produced a card', !!probeCard, probeCard)

  const cardsBefore = (await req('GET', '/revisions')).data.length
  await req('DELETE', `/notes/${cardNote.data.id}`)
  const after = (await req('GET', '/revisions')).data

  check('deleting the note removed its card', after.length === cardsBefore - 1,
    { before: cardsBefore, after: after.length })
  check('no card is left pointing at the deleted note',
    !after.some((r: any) => r.noteId === cardNote.data.id))
  check('no orphaned card with a null source was created',
    !after.some((r: any) => r.id === probeCard.id),
    after.filter((r: any) => r.noteId === null))

  // ============================ live: general stopwatch with no task
  console.log('\nLive: general stopwatch becomes a task')

  // A general session logs its time with taskId null, before any task exists.
  const orphanLog = await req('POST', '/study-sessions', {
    date: today, minutes: 37, categoryId: null, taskId: null,
    note: 'Untitled focus session',
  })
  check('time can be logged with no task attached',
    orphanLog.status === 201, orphanLog.status)
  check('the logged session has a null taskId',
    orphanLog.data.taskId === null, orphanLog.data.taskId)
  check('the minutes are recorded regardless',
    orphanLog.data.minutes === 37, orphanLog.data.minutes)

  // Naming it creates the task, exactly as the sheet does.
  const spec = buildTaskFromSession({
    title: `GENERAL-${Date.now()} Reviewed system design`,
    categoryId: '', minutes: 37, date: today, markComplete: true,
  })
  const madeTask = await req('POST', '/tasks', spec)
  check('the named task is created', madeTask.status === 201, madeTask.status)
  check('the task carries the tracked minutes',
    madeTask.data.actualMinutes === 37, madeTask.data.actualMinutes)
  check('the task is marked completed',
    madeTask.data.status === 'COMPLETED', madeTask.data.status)
  check('the task lands on today so it shows in the planner',
    madeTask.data.date === today, madeTask.data.date)

  // Re-point the already-logged time at the new task.
  const repointed = await req('PUT', `/study-sessions/${orphanLog.data.id}`, {
    taskId: madeTask.data.id,
    categoryId: null,
    note: `Focus session: ${madeTask.data.title}`,
  })
  check('the logged time can be re-pointed at the new task',
    repointed.data.taskId === madeTask.data.id, repointed.data.taskId)
  check('re-pointing preserves the minutes',
    repointed.data.minutes === 37, repointed.data.minutes)
  check('the note text was updated to name the task',
    repointed.data.note.includes('Reviewed system design'), repointed.data.note)

  // The time must not be double counted.
  const sessionsForTask = (await req('GET', '/study-sessions')).data
    .filter((s: any) => s.taskId === madeTask.data.id)
  check('exactly one study session points at the task',
    sessionsForTask.length === 1, sessionsForTask.length)
  check('total logged equals the session length, not double',
    sessionsForTask.reduce((sum: number, s: any) => sum + s.minutes, 0) === 37,
    sessionsForTask.map((s: any) => s.minutes))

  // And it can be journalled + queued for revision like any other session.
  const generalNote = await req('POST', '/notes', {
    title: madeTask.data.title,
    content: buildEntry({ date: today, minutes: 37, mistake: '', learned: 'CAP is about partitions' }),
    type: 'CONCEPT',
    revisionScheduled: true,
    tags: ['system-design'],
  })
  check('a general session can be journalled', generalNote.status === 201, generalNote.status)
  const generalCard = (await req('GET', '/revisions')).data
    .find((r: any) => r.noteId === generalNote.data.id)
  check('a general session can be queued for revision', !!generalCard, generalCard)

  await req('DELETE', `/notes/${generalNote.data.id}`)
  await req('DELETE', `/study-sessions/${orphanLog.data.id}`)
  await req('DELETE', `/tasks/${madeTask.data.id}`)

  // ==================================================== PUT hardening
  console.log('\nNotes PUT hardening')

  const junk = await req('PUT', `/notes/${note.data.id}`, {
    title: 'Still fine', notAColumn: 'boom', linkedNoteId: 'nope', subtasks: [1, 2],
  })
  check('unknown keys do not 500 the notes PUT', junk.status === 200, junk.status)
  check('valid keys still apply alongside junk',
    junk.data.title === 'Still fine', junk.data.title)

  const emptyCat = await req('PUT', `/notes/${note.data.id}`, { categoryId: '' })
  check('an empty categoryId is coerced to NULL, not an FK violation',
    emptyCat.status === 200 && emptyCat.data.categoryId === null,
    { status: emptyCat.status, categoryId: emptyCat.data?.categoryId })

  // ========================================================== teardown
  await req('DELETE', `/notes/${note.data.id}`)
  await req('DELETE', `/tasks/${taskId}`)
  const leftovers = (await req('GET', '/tasks')).data
    .filter((t: any) => /^(JOURNAL|GENERAL)-/.test(t.title))
  check('no test tasks were left behind', leftovers.length === 0, leftovers.length)
  // Scoped to this run's own row. Asserting no untitled session exists anywhere
  // would fail whenever the app is genuinely in use alongside the suite.
  const allSessions = (await req('GET', '/study-sessions')).data
  check('this run left no study session behind',
    !allSessions.some((s: any) => s.id === orphanLog.data.id),
    allSessions.filter((s: any) => s.id === orphanLog.data.id))
  const noteLeft = (await req('GET', '/notes')).data
    .filter((n: any) => n.title === 'Still fine')
  check('no test notes were left behind', noteLeft.length === 0, noteLeft.length)

  // ============================================================ render
  console.log('\nSheet render')

  function render(pending: any) {
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } },
    })
    qc.setQueryData(['settings'], {})
    if (pending) {
      qc.setQueryData(['tasks', pending.taskId], {
        id: pending.taskId, title: pending.taskTitle, tags: ['dsa'], linkedNoteId: null,
      })
    }
    // The sheet reads pendingJournal from the provider, which only fills after a
    // real stop(), so the closed state is what SSR can observe.
    return renderToStaticMarkup(
      createElement(QueryClientProvider, { client: qc },
        createElement(MemoryRouter, null,
          createElement(ToastProvider, null,
            createElement(PictureInPictureProvider, null,
              createElement(FocusTimerProvider, null,
                createElement(SessionJournalSheet))))))
    )
  }

  let closed = ''
  try {
    closed = render(null)
    check('the sheet renders nothing before a session ends',
      !closed.includes('role="dialog"'), closed.slice(0, 100))
  } catch (e: any) {
    check('the sheet renders nothing before a session ends', false, e.message)
  }
  check('no journal copy leaks while closed', !closed.includes('What went wrong?'))
  check('the provider tree mounts without a browser',
    typeof closed === 'string')

  // The timer must not hard-require the PiP provider: the floating window is an
  // enhancement, and a browser without Document PiP has to keep working.
  try {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    qc.setQueryData(['settings'], {})
    const withoutPip = renderToStaticMarkup(
      createElement(QueryClientProvider, { client: qc },
        createElement(MemoryRouter, null,
          createElement(ToastProvider, null,
            createElement(FocusTimerProvider, null,
              createElement(SessionJournalSheet)))))
    )
    check('the focus timer works with NO PictureInPictureProvider mounted',
      typeof withoutPip === 'string')
  } catch (e: any) {
    check('the focus timer works with NO PictureInPictureProvider mounted', false, e.message)
  }

  console.log(`\n${pass}/${pass + failures.length} checks passed`)
  if (failures.length) {
    console.log('FAILED: ' + failures.join(', '))
    process.exit(1)
  }
  console.log('Journal flow verified.')
}

main().catch(e => { console.error(e); process.exit(1) })
