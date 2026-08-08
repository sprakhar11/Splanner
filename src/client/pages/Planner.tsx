import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus, X, Grid3X3 } from 'lucide-react'
import { Button } from '@client/components/ui'
import MonthGrid from '@client/components/planner/MonthGrid'
import AgendaPanel from '@client/components/planner/AgendaPanel'
import TaskEditor from '@client/components/tasks/TaskEditor'
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@client/hooks/useTasks'
import { useKeyboard } from '@client/hooks/useKeyboard'
import { useSettings } from '@client/hooks/useSettings'
import { readSetting } from '@client/lib/settings'
import { cn } from '@client/lib/utils'
import { MONTHS, monthGrid, monthRange, toISO, fromISO, dowLabels } from '@client/lib/date'

export default function Planner() {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(toISO(today))
  const [editing, setEditing] = useState<any>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [view, setView] = useState<'month' | 'year'>('month')

  // The palette's "New task" command arrives as /planner?new=1.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null)
      setShowEditor(true)
      // Drop the param so a refresh does not reopen the editor.
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const { data: settings } = useSettings()
  const mondayFirst = readSetting(settings, 'weekStartsMonday')

  const cells = useMemo(() => monthGrid(cursor.y, cursor.m, mondayFirst), [cursor, mondayFirst])
  const range = useMemo(() => monthRange(cursor.y, cursor.m, mondayFirst), [cursor, mondayFirst])

  const { data: tasks = [] } = useTasks({ from: range.from, to: range.to })
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  const tasksByDate = useMemo(() => {
    return tasks.reduce<Record<string, any[]>>((acc, t: any) => {
      ;(acc[t.date] ??= []).push(t)
      return acc
    }, {})
  }, [tasks])

  const dayTasks = tasksByDate[selected] ?? []

  const shiftMonth = (delta: number) => {
    setCursor(c => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const shiftDay = (delta: number) => {
    const d = fromISO(selected)
    d.setDate(d.getDate() + delta)
    const iso = toISO(d)
    setSelected(iso)
    if (d.getMonth() !== cursor.m || d.getFullYear() !== cursor.y) {
      setCursor({ y: d.getFullYear(), m: d.getMonth() })
    }
  }

  const goToday = () => {
    const t = new Date()
    setSelected(toISO(t))
    setCursor({ y: t.getFullYear(), m: t.getMonth() })
  }

  const openNew = () => { setEditing(null); setShowEditor(true) }
  const openTask = (id: string) => { setEditing(tasks.find((t: any) => t.id === id)); setShowEditor(true) }
  const close = () => { setShowEditor(false); setEditing(null) }

  const save = (data: any) => {
    if (editing) updateTask.mutate({ id: editing.id, data })
    else createTask.mutate(data)
    close()
  }

  const toggle = (id: string, done: boolean) =>
    updateTask.mutate({ id, data: { status: done ? 'COMPLETED' : 'TODO' } })

  /**
   * Deleting one occurrence of a series would silently leave the rest behind,
   * so ask what the user actually meant.
   */
  const removeTask = (task: any) => {
    if (!task.seriesId) {
      deleteTask.mutate({ id: task.id })
      close()
      return
    }

    const wholeSeries = confirm(
      `"${task.title}" repeats.\n\n` +
      'OK  — delete this and all future occurrences\n' +
      'Cancel — delete only this one'
    )
    deleteTask.mutate({ id: task.id, scope: wholeSeries ? 'future' : 'one' })
    close()
  }

  useKeyboard({
    c: openNew,
    escape: close,
    arrowleft: () => shiftDay(-1),
    arrowright: () => shiftDay(1),
    t: goToday,
  }, [selected, editing, cursor])

  return (
    <div className="relative flex h-full gap-3">
      {/* Calendar */}
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface-2 p-4 ring-1 ring-border">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            {view === 'month' && <h2 className="text-[17px] font-semibold tracking-tight">{MONTHS[cursor.m]}</h2>}
            <span className="text-[17px] font-semibold text-muted-foreground tabular-nums">{cursor.y}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToday} className="h-8 text-[12px]">Today</Button>
            <button
              onClick={() => setView(view === 'month' ? 'year' : 'month')}
              aria-label={view === 'month' ? 'Show year view' : 'Show month view'}
              title={view === 'month' ? 'Year view' : 'Month view'}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg transition',
                view === 'year'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-3 text-muted-foreground hover:text-foreground'
              )}
            >
              <Grid3X3 className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => view === 'year' ? setCursor(c => ({ ...c, y: c.y - 1 })) : shiftMonth(-1)}
                aria-label={view === 'year' ? 'Previous year' : 'Previous month'}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-muted-foreground transition hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => view === 'year' ? setCursor(c => ({ ...c, y: c.y + 1 })) : shiftMonth(1)}
                aria-label={view === 'year' ? 'Next year' : 'Next month'}
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-muted-foreground transition hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" onClick={openNew} className="h-8 rounded-lg text-[12px]">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>

        {view === 'month' ? (
          <MonthGrid
            cells={cells}
            tasksByDate={tasksByDate}
            selected={selected}
            onSelect={setSelected}
            mondayFirst={mondayFirst}
          />
        ) : (
          <YearGrid
            year={cursor.y}
            selected={selected}
            mondayFirst={mondayFirst}
            onSelectDay={(iso) => {
              setSelected(iso)
              const d = fromISO(iso)
              setCursor({ y: d.getFullYear(), m: d.getMonth() })
              setView('month')
            }}
          />
        )}
      </section>

      {/* Agenda — hidden in year view */}
      {view === 'month' && (
        <AgendaPanel
          iso={selected}
          tasks={dayTasks}
          onShift={shiftDay}
          onToday={goToday}
          onSelectTask={openTask}
          onToggleTask={toggle}
        />
      )}

      {/* Editor overlay */}
      <AnimatePresence>
        {showEditor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
              className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              className="absolute left-1/2 top-1/2 z-50 flex max-h-[calc(100%-1.5rem)] w-[380px]
                         -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
                         bg-popover shadow-2xl ring-1 ring-border"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-[14px] font-semibold">{editing ? 'Edit task' : 'New task'}</h3>
                <div className="flex items-center gap-1">
                  {editing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[12px] text-destructive hover:text-destructive"
                      onClick={() => removeTask(editing)}
                    >
                      Delete
                    </Button>
                  )}
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <TaskEditor task={editing} date={selected} onSave={save} onClose={close} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function YearGrid({
  year, selected, mondayFirst, onSelectDay,
}: {
  year: number
  selected: string
  mondayFirst: boolean
  onSelectDay: (iso: string) => void
}) {
  const todayStr = toISO(new Date())

  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto py-1 lg:grid-cols-4">
      {MONTHS.map((monthName, monthIdx) => {
        const cells = monthGrid(year, monthIdx, mondayFirst)
        return (
          <div key={monthIdx}>
            <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{monthName}</p>
            <div className="grid grid-cols-7 gap-px text-[9px]">
              {dowLabels(mondayFirst).map(d => (
                <span key={d} className="text-center text-[8px] text-muted-foreground/60">
                  {d.slice(0, 1)}
                </span>
              ))}
              {cells.map(cell => {
                const isToday = cell.iso === todayStr
                const isSelected = cell.iso === selected
                return (
                  <button
                    key={cell.iso}
                    onClick={() => onSelectDay(cell.iso)}
                    className={cn(
                      'grid h-5 w-5 place-items-center rounded-sm text-[9px] transition',
                      !cell.inMonth && 'text-muted-foreground/30',
                      cell.inMonth && !isToday && !isSelected && 'text-muted-foreground hover:bg-surface-3',
                      isToday && !isSelected && 'font-bold text-primary',
                      isSelected && 'bg-primary text-primary-foreground font-bold',
                    )}
                  >
                    {cell.day}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
