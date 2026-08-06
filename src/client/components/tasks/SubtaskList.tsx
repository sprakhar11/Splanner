import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Plus, Trash2, ListChecks } from 'lucide-react'
import { useSubtasks, useSubtaskMutations } from '@client/hooks/useTasks'
import { cn } from '@client/lib/utils'

/**
 * Checklist for a saved task.
 *
 * Subtasks are written through their own endpoints rather than being bundled
 * into the parent form, so ticking one is immediate and does not require
 * saving the whole task.
 */
export default function SubtaskList({ taskId }: { taskId: string }) {
  const { data: items = [], isLoading } = useSubtasks(taskId)
  const { add, toggle, rename, remove } = useSubtaskMutations(taskId)
  const [draft, setDraft] = useState('')

  const done = items.filter((s: any) => s.isCompleted).length
  const pct = items.length ? Math.round((done / items.length) * 100) : 0

  const submit = () => {
    const title = draft.trim()
    if (!title) return
    add.mutate(title)
    setDraft('')
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          Checklist
        </label>
        {items.length > 0 && (
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {done}/{items.length}
          </span>
        )}
      </div>

      {/* Progress */}
      {items.length > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-surface-3">
          <motion.div
            className="h-full rounded-full"
            style={{ background: pct === 100 ? 'var(--ev-green)' : 'var(--primary)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-1">
          {[1, 2].map(i => <div key={i} className="h-7 animate-pulse rounded-md bg-surface-3" />)}
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {items.map((s: any) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.14 }}
                className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-surface-3/60"
              >
                <button
                  type="button"
                  onClick={() => toggle.mutate({ id: s.id, isCompleted: !s.isCompleted })}
                  aria-label={s.isCompleted ? `Mark "${s.title}" incomplete` : `Mark "${s.title}" complete`}
                  className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded ring-1 transition',
                    s.isCompleted
                      ? 'bg-primary text-primary-foreground ring-primary'
                      : 'text-transparent ring-input hover:ring-primary hover:text-muted-foreground'
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </button>

                <input
                  defaultValue={s.title}
                  onBlur={e => {
                    const next = e.target.value.trim()
                    if (next && next !== s.title) rename.mutate({ id: s.id, title: next })
                    else e.target.value = s.title
                  }}
                  onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  aria-label={`Rename ${s.title}`}
                  className={cn(
                    'min-w-0 flex-1 bg-transparent text-[12.5px] focus:outline-none',
                    s.isCompleted && 'text-muted-foreground line-through'
                  )}
                />

                <button
                  type="button"
                  onClick={() => remove.mutate(s.id)}
                  aria-label={`Delete ${s.title}`}
                  className="shrink-0 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Add */}
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
          }}
          placeholder="Add a step…"
          className="h-7 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim() || add.isPending}
          aria-label="Add step"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-3 text-muted-foreground ring-1 ring-border transition hover:text-foreground disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
