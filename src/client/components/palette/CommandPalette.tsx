import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Loader2,
  LayoutDashboard, CalendarDays, BookOpen, Brain, BarChart3, Briefcase,
  Sparkles, SlidersHorizontal, Plus, Timer, Sprout,
} from 'lucide-react'
import { useCommandPalette } from '@client/hooks/useCommandPalette'
import { useSearch } from '@client/hooks/useSearch'
import { useFocusTimer } from '@client/hooks/useFocusTimer'
import { useSettings } from '@client/hooks/useSettings'
import { useGarden, useLogHabit } from '@client/hooks/useHabits'
import { isTabEnabled } from '@client/lib/settings'
import {
  ROUTE_FOR, GROUP_LABEL, TYPE_COLOR, parseSnippet, filterCommands, groupHits, moveIndex,
  type SearchHit,
} from '@client/lib/palette'
import { cn } from '@client/lib/utils'

type Command = {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<any>
  run: (ctx: { navigate: (to: string) => void }) => void
}

const COMMANDS: Command[] = [
  { id: 'go-dashboard', label: 'Go to Dashboard', hint: 'today at a glance', icon: LayoutDashboard, run: c => c.navigate('/') },
  { id: 'go-planner', label: 'Go to Planner', hint: 'calendar and agenda', icon: CalendarDays, run: c => c.navigate('/planner') },
  { id: 'go-journal', label: 'Go to Journal', hint: 'notes', icon: BookOpen, run: c => c.navigate('/journal') },
  { id: 'go-revise', label: 'Go to Revise', hint: 'spaced repetition', icon: Brain, run: c => c.navigate('/revise') },
  { id: 'go-interview', label: 'Go to Interview Prep', hint: 'DSA, system design, LLD, HR', icon: Briefcase, run: c => c.navigate('/interview') },
  { id: 'go-stats', label: 'Go to Stats', hint: 'streaks and readiness', icon: BarChart3, run: c => c.navigate('/stats') },
  { id: 'go-reflection', label: 'Go to Reflection', hint: 'close out the day', icon: Sparkles, run: c => c.navigate('/reflection') },
  { id: 'go-settings', label: 'Go to Settings', hint: 'goals, data, appearance', icon: SlidersHorizontal, run: c => c.navigate('/settings') },
  { id: 'new-task', label: 'New task', hint: 'opens the planner', icon: Plus, run: c => c.navigate('/planner?new=1') },
]

export default function CommandPalette() {
  const { isOpen, close } = useCommandPalette()
  const navigate = useNavigate()
  const { session, stop, start } = useFocusTimer()

  const { data: settings } = useSettings()
  const habitsEnabled = isTabEnabled(settings, 'habit')
  const { habits, today: habitToday } = useGarden()
  const logHabit = useLogHabit()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Debounce so a fast typist does not fire a query per keystroke.
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 130)
    return () => clearTimeout(id)
  }, [query])

  const { data: hits = [], isFetching } = useSearch(debounced)

  // Reset each time the palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setDebounced('')
      setActive(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen])

  const commands = useMemo(() => {
    const base = [...COMMANDS]

    // One command per habit still open today. Registered as ordinary commands so
    // the existing substring filter finds them — typing "read" surfaces
    // "Complete habit: Read 10 pages" with no new query syntax to learn.
    if (habitsEnabled) {
      base.push({
        id: 'go-habits',
        label: 'Go to Habits',
        hint: 'the garden',
        icon: Sprout,
        run: c => c.navigate('/habits'),
      })

      for (const h of habits) {
        if (h.state.todayStatus === 'COMPLETED') continue
        base.push({
          id: `habit-${h.id}`,
          label: `Complete habit: ${h.title}`,
          hint: h.state.currentStreak > 0 ? `${h.state.currentStreak} day streak` : 'no streak yet',
          icon: Sprout,
          run: () => { logHabit.mutate({ id: h.id, date: habitToday, status: 'COMPLETED' }) },
        })
      }
    }

    // Offer stopping the timer only while one is running, and starting a bare
    // stopwatch only while one is not.
    if (session) {
      base.unshift({
        id: 'stop-focus',
        label: session.taskTitle
          ? `Stop focus session on "${session.taskTitle}"`
          : 'Stop the stopwatch',
        hint: 'logs the time',
        icon: Timer,
        run: () => { stop() },
      })
    } else {
      base.unshift({
        id: 'start-stopwatch',
        label: 'Start a stopwatch',
        hint: 'name the task when you stop',
        icon: Timer,
        run: () => { start() },
      })
    }
    return filterCommands(base, query)
  }, [query, session, stop, start, habits, habitsEnabled, habitToday, logHabit])

  const grouped = useMemo(() => groupHits(hits as SearchHit[]), [hits])

  /** One flat list so arrow keys move across commands and results uniformly. */
  const flat = useMemo(() => {
    const items: { key: string; run: () => void }[] = []
    for (const cmd of commands) {
      items.push({ key: `c:${cmd.id}`, run: () => { cmd.run({ navigate }); close() } })
    }
    for (const group of grouped) {
      for (const hit of group.hits) {
        items.push({
          key: `r:${hit.entityId}`,
          run: () => { navigate(ROUTE_FOR[hit.entityType] ?? '/'); close() },
        })
      }
    }
    return items
  }, [commands, grouped, navigate, close])

  // Clamp the cursor whenever the list shrinks.
  useEffect(() => {
    setActive(a => (flat.length === 0 ? 0 : Math.min(a, flat.length - 1)))
  }, [flat.length])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => moveIndex(a, 1, flat.length)); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => moveIndex(a, -1, flat.length)); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      flat[active]?.run()
    }
  }

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  let cursor = 0

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={close}
            className="fixed inset-0 z-[80] bg-black/55 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 480, damping: 34 }}
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="fixed left-1/2 top-[12vh] z-[81] flex max-h-[70vh] w-[min(620px,92vw)]
                       -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-popover
                       shadow-2xl ring-1 ring-border"
          >
            {/* Input */}
            <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
                placeholder="Search everything, or jump to a page…"
                aria-label="Search or run a command"
                className="min-w-0 flex-1 bg-transparent text-[14px] placeholder:text-muted-foreground focus:outline-none"
              />
              {isFetching && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
              <kbd className="shrink-0 rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-2">
              {flat.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-[13px] font-medium">No matches</p>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {debounced
                      ? `Nothing indexed for "${debounced}".`
                      : 'Type to search tasks, notes, problems, and stories.'}
                  </p>
                </div>
              ) : (
                <>
                  {commands.length > 0 && (
                    <Group label="Commands">
                      {commands.map(cmd => {
                        const i = cursor++
                        return (
                          <Row
                            key={cmd.id}
                            index={i}
                            isActive={i === active}
                            onHover={() => setActive(i)}
                            onClick={() => { cmd.run({ navigate }); close() }}
                          >
                            <cmd.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate text-[12.5px]">{cmd.label}</span>
                            {cmd.hint && (
                              <span className="truncate text-[11px] text-muted-foreground">{cmd.hint}</span>
                            )}
                          </Row>
                        )
                      })}
                    </Group>
                  )}

                  {grouped.map(group => (
                    <Group key={group.type} label={GROUP_LABEL[group.type] ?? group.type}>
                      {group.hits.map(hit => {
                        const i = cursor++
                        const segments = parseSnippet(hit.snippet)
                        return (
                          <Row
                            key={hit.entityId}
                            index={i}
                            isActive={i === active}
                            onHover={() => setActive(i)}
                            onClick={() => { navigate(ROUTE_FOR[hit.entityType] ?? '/'); close() }}
                          >
                            <span
                              className="h-6 w-[2.5px] shrink-0 rounded-full"
                              style={{ background: TYPE_COLOR[hit.entityType] ?? 'var(--ev-teal)' }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12.5px] font-medium">{hit.title}</p>
                              {segments.length > 0 && (
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {segments.map((s, si) =>
                                    s.match ? (
                                      <mark
                                        key={si}
                                        className="bg-transparent font-semibold text-primary"
                                      >
                                        {s.text}
                                      </mark>
                                    ) : (
                                      <span key={si}>{s.text}</span>
                                    )
                                  )}
                                </p>
                              )}
                            </div>
                            {hit.meta && (
                              <span className="shrink-0 rounded-full bg-surface-3 px-2 py-0.5 text-[10px] text-muted-foreground">
                                {String(hit.meta).toLowerCase().replace(/_/g, ' ')}
                              </span>
                            )}
                          </Row>
                        )
                      })}
                    </Group>
                  ))}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-[10.5px] text-muted-foreground">
              <Hint icon={ArrowUp} extra={ArrowDown}>navigate</Hint>
              <Hint icon={CornerDownLeft}>open</Hint>
              <span className="ml-auto tabular-nums">
                {flat.length} {flat.length === 1 ? 'result' : 'results'}
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  )
}

function Row({
  index, isActive, onHover, onClick, children,
}: {
  index: number
  isActive: boolean
  onHover: () => void
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      data-index={index}
      onMouseMove={onHover}
      onClick={onClick}
      aria-selected={isActive}
      className={cn(
        'flex w-full items-center gap-2.5 px-4 py-2 text-left transition',
        isActive ? 'bg-surface-3' : 'hover:bg-surface-3/60'
      )}
    >
      {children}
    </button>
  )
}

function Hint({
  icon: Icon, extra: Extra, children,
}: { icon: React.ComponentType<any>; extra?: React.ComponentType<any>; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      <kbd className="grid h-4 w-4 place-items-center rounded border border-border bg-surface-3">
        <Icon className="h-2.5 w-2.5" />
      </kbd>
      {Extra && (
        <kbd className="grid h-4 w-4 place-items-center rounded border border-border bg-surface-3">
          <Extra className="h-2.5 w-2.5" />
        </kbd>
      )}
      {children}
    </span>
  )
}
