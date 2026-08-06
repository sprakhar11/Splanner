import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { Button } from '@client/components/ui'
import MonthGrid from '@client/components/planner/MonthGrid'
import AgendaPanel from '@client/components/planner/AgendaPanel'
import TaskEditor from '@client/components/tasks/TaskEditor'
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@client/hooks/useTasks'
import { useKeyboard } from '@client/hooks/useKeyboard'
import { useSettings } from '@client/hooks/useSettings'
import { readSetting } from '@client/lib/settings'
import { MONTHS, monthGrid, monthRange, toISO, fromISO } from '@client/lib/date'

export default function Planner() {
  const today = new Date()
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [selected, setSelected] = useState(toISO(today))
  const [editing, setEditing] = useState<any>(null)
  const [showEditor, setShowEditor] = useState(false)

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
            <h2 className="text-[17px] font-semibold tracking-tight">{MONTHS[cursor.m]}</h2>
            <span className="text-[17px] font-semibold text-muted-foreground tabular-nums">{cursor.y}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={goToday} className="h-8 text-[12px]">Today</Button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-muted-foreground transition hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
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

        <MonthGrid
          cells={cells}
          tasksByDate={tasksByDate}
          selected={selected}
          onSelect={setSelected}
          mondayFirst={mondayFirst}
        />
      </section>

      {/* Agenda */}
      <AgendaPanel
        iso={selected}
        tasks={dayTasks}
        onShift={shiftDay}
        onToday={goToday}
        onSelectTask={openTask}
        onToggleTask={toggle}
      />

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
