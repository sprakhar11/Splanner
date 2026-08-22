import { useMemo, useState } from 'react'
import { Plus, Sprout, Quote } from 'lucide-react'
import PlantCard from '@client/components/habits/PlantCard'
import HabitEditor from '@client/components/habits/HabitEditor'
import HabitSheet from '@client/components/habits/HabitSheet'
import {
  useGarden, useCreateHabit, useUpdateHabit, useArchiveHabit, useLogHabit,
  type HabitWithState,
} from '@client/hooks/useHabits'
import { useToast } from '@client/components/ui/toast'
import { quoteForDay } from '@client/lib/quotes'

export default function Habits() {
  const { habits, today, isLoading } = useGarden()
  const create = useCreateHabit()
  const update = useUpdateHabit()
  const archive = useArchiveHabit()
  const log = useLogHabit()
  const { toast } = useToast()

  const [editing, setEditing] = useState<HabitWithState | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)

  // Keyed off the logical day, so it turns over when the user's day does rather
  // than at midnight, and stays put across reloads without being stored.
  const quote = useMemo(() => quoteForDay(today), [today])

  // Read through the live list so the sheet reflects optimistic updates.
  const viewed = viewing ? habits.find(h => h.id === viewing) ?? null : null

  const doneToday = habits.filter(h => h.state.todayStatus === 'COMPLETED').length

  const toggle = (h: HabitWithState) => {
    const next = h.state.todayStatus === 'COMPLETED' ? null : 'COMPLETED'
    log.mutate({ id: h.id, date: today, status: next })
  }

  const save = (data: { title: string; plantType: string; color: string | null }) => {
    if (editing) {
      update.mutate({ id: editing.id, data }, {
        onError: (e: any) => toast({ title: 'Could not save', body: e.message, tone: 'warning' }),
      })
    } else {
      create.mutate(data, {
        onError: (e: any) => toast({ title: 'Could not create', body: e.message, tone: 'warning' }),
      })
    }
    setEditorOpen(false)
    setEditing(null)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-3">
        {/* Banner */}
        <div className="flex items-start gap-3 rounded-xl bg-surface-2 p-4 ring-1 ring-border">
          <Quote className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-relaxed">{quote}</p>
            {habits.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                {doneToday} of {habits.length} done today
              </p>
            )}
          </div>
          <button
            onClick={() => { setEditing(null); setEditorOpen(true) }}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold text-white transition hover:opacity-90"
            style={{ background: 'var(--grad-selected)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            New habit
          </button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : habits.length === 0 ? (
          <div className="rounded-xl bg-surface-2 py-16 text-center ring-1 ring-border">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface-3">
              <Sprout className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[13px] font-medium">Nothing planted yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-muted-foreground">
              Add one habit you want to do most days. Plants grow from how often you
              finish, not how long your streak is, so a missed day never costs you
              what you have already built.
            </p>
            <button
              onClick={() => { setEditing(null); setEditorOpen(true) }}
              className="mt-4 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90"
              style={{ background: 'var(--grad-selected)' }}
            >
              Plant your first habit
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {habits.map(h => (
              <PlantCard
                key={h.id}
                habit={h}
                onToggle={() => toggle(h)}
                onSkip={() => log.mutate({ id: h.id, date: today, status: 'SKIPPED' })}
                onClear={() => log.mutate({ id: h.id, date: today, status: null })}
                onEdit={() => { setEditing(h); setEditorOpen(true) }}
                onOpen={() => setViewing(h.id)}
                onArchive={() => {
                  archive.mutate({ id: h.id })
                  toast({
                    title: `Archived "${h.title}"`,
                    body: 'Its history is kept. Re-enable it from settings.',
                    tone: 'success',
                  })
                }}
              />
            ))}
          </div>
        )}
      </div>

      <HabitEditor
        open={editorOpen}
        habit={editing}
        onClose={() => { setEditorOpen(false); setEditing(null) }}
        onSave={save}
      />

      <HabitSheet habit={viewed} today={today} onClose={() => setViewing(null)} />
    </div>
  )
}
