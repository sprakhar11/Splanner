import { useEffect, useState } from 'react'
import { Sheet } from '@client/components/ui'
import Plant from '@client/components/habits/Plant'
import { PLANT_TYPES, PLANT_LABELS, type PlantType } from '@client/components/habits/Plant'
import type { HabitWithState } from '@client/hooks/useHabits'
import { cn } from '@client/lib/utils'

/** The `--ev-*` tokens, which the plant reads as its foliage colour. */
const COLORS = [
  { token: null, label: 'Default for the plant' },
  { token: 'ev-green', label: 'Green' },
  { token: 'ev-teal', label: 'Teal' },
  { token: 'ev-blue', label: 'Blue' },
  { token: 'ev-purple', label: 'Purple' },
  { token: 'ev-pink', label: 'Pink' },
  { token: 'ev-orange', label: 'Orange' },
  { token: 'ev-yellow', label: 'Yellow' },
]

export default function HabitEditor({
  open,
  habit,
  onClose,
  onSave,
}: {
  open: boolean
  /** Null when creating. */
  habit: HabitWithState | null
  onClose: () => void
  onSave: (data: { title: string; plantType: string; color: string | null }) => void
}) {
  const [title, setTitle] = useState('')
  const [plantType, setPlantType] = useState<PlantType>('OAK')
  const [color, setColor] = useState<string | null>(null)

  // Reseed whenever the sheet opens, so a cancelled edit leaves nothing behind.
  useEffect(() => {
    if (!open) return
    setTitle(habit?.title ?? '')
    setPlantType(((habit?.plantType ?? 'OAK') as PlantType))
    setColor(habit?.color ?? null)
  }, [open, habit])

  const canSave = title.trim().length > 0

  const submit = () => {
    if (!canSave) return
    onSave({ title: title.trim(), plantType, color })
  }

  return (
    <Sheet
      open={open}
      onOpenChange={o => { if (!o) onClose() }}
      title={habit ? 'Edit habit' : 'New habit'}
      subtitle={habit ? habit.title : 'One thing you want to do most days'}
      footer={
        <>
          <p className="flex-1 text-[10.5px] text-muted-foreground">
            {habit
              ? 'Renaming keeps every log and the streak.'
              : 'Starts as a seed. Four completions to sprout.'}
          </p>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-[12.5px] text-muted-foreground transition hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSave}
            className="rounded-lg px-4 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            style={{ background: 'var(--grad-selected)' }}
          >
            {habit ? 'Save changes' : 'Plant it'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Live preview, so the type and colour choices mean something. */}
        <div className="flex items-center gap-4 rounded-xl bg-surface-3 p-3 ring-1 ring-border">
          <div className="h-20 w-20 shrink-0">
            <Plant
              plantType={plantType}
              stage={habit?.state.stage ?? 'SPROUT'}
              health={habit?.state.health ?? 'THRIVING'}
              color={color}
              className="h-full w-full"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium">{title.trim() || 'Your habit'}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {PLANT_LABELS[plantType]}
              {habit && ` · ${habit.state.totalCompletions} completions so far`}
            </p>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Habit</label>
          <input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="Read 10 pages"
            className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
          <p className="mt-1 text-[10.5px] text-muted-foreground">
            Keep it small enough that a bad day still fits.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Plant</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {PLANT_TYPES.map(t => (
              <button
                key={t}
                onClick={() => setPlantType(t)}
                aria-pressed={plantType === t}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl py-2.5 ring-1 transition',
                  plantType === t ? 'ring-primary' : 'bg-surface-3 ring-border hover:ring-input'
                )}
                style={plantType === t ? { background: 'var(--grad-selected)' } : undefined}
              >
                <div className="h-10 w-10">
                  <Plant
                    plantType={t}
                    stage="MATURE"
                    health="THRIVING"
                    color={color}
                    animate={false}
                    className="h-full w-full"
                  />
                </div>
                <span className={cn('text-[10.5px]', plantType === t ? 'text-white' : 'text-muted-foreground')}>
                  {PLANT_LABELS[t]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-medium text-muted-foreground">Colour</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {COLORS.map(c => (
              <button
                key={c.token ?? 'default'}
                onClick={() => setColor(c.token)}
                aria-pressed={color === c.token}
                aria-label={c.label}
                title={c.label}
                className={cn(
                  'h-7 w-7 rounded-full ring-1 transition',
                  color === c.token ? 'ring-2 ring-primary ring-offset-2 ring-offset-popover' : 'ring-border'
                )}
                style={{
                  background: c.token ? `var(--${c.token})` : 'var(--surface-3)',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
