import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, X, ExternalLink, Brain, Check, Search } from 'lucide-react'
import { cn } from '@client/lib/utils'
import { useSettings } from '@client/hooks/useSettings'
import {
  useInterviewItems, useCreateInterviewItem, useUpdateInterviewItem,
  useDeleteInterviewItem, useReviseInterviewItem,
} from '@client/hooks/useInterviewItems'

const DEFAULT_TOPICS = ['DSA', 'SYSTEM_DESIGN', 'LLD']

/** Read topics from settings. If stored, use exactly that list. Otherwise default. */
function useTopics() {
  const { data: settings } = useSettings()
  const custom = settings?.interviewTopics
  let parsed: string[] = []
  try { parsed = custom ? JSON.parse(custom) : [] } catch {}
  return parsed.length > 0 ? parsed : DEFAULT_TOPICS
}

const STATUS_COLOR: Record<string, string> = {
  DONE: 'var(--ev-green)',
  REVISION_PENDING: 'var(--ev-orange)',
}

function statusLabel(s: string) {
  if (s === 'DONE') return 'Done'
  if (s === 'REVISION_PENDING') return 'Revision pending'
  const m = s.match(/^REVISION_(\d+)_DONE$/)
  if (m) return `Revision ${m[1]} done`
  return s
}

function statusColor(s: string) {
  if (s === 'DONE') return 'var(--ev-green)'
  if (s === 'REVISION_PENDING') return 'var(--ev-orange)'
  if (s.includes('DONE')) return 'var(--ev-teal)'
  return 'var(--muted-foreground)'
}

function topicLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

export default function InterviewPrep() {
  const topics = useTopics()
  const [active, setActive] = useState(topics[0])
  const { data: items = [], isLoading } = useInterviewItems(active)
  const create = useCreateInterviewItem()
  const update = useUpdateInterviewItem()
  const remove = useDeleteInterviewItem()
  const revise = useReviseInterviewItem()

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return items
    const q = search.toLowerCase()
    return items.filter((i: any) =>
      i.title.toLowerCase().includes(q) ||
      (i.tags ?? []).some((t: string) => t.toLowerCase().includes(q))
    )
  }, [items, search])

  const stats = useMemo(() => {
    const total = items.length
    const done = items.filter((i: any) => i.status === 'DONE').length
    const revPending = items.filter((i: any) => i.status === 'REVISION_PENDING').length
    const revised = items.filter((i: any) => i.status.startsWith('REVISION_') && i.status.endsWith('_DONE')).length
    return { total, done, revPending, revised }
  }, [items])

  const save = (data: any) => {
    if (editing) {
      update.mutate({ id: editing.id, data })
    } else {
      create.mutate({ ...data, topicType: active })
    }
    setOpen(false)
    setEditing(null)
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-surface-2 ring-1 ring-border">
      {/* Header + tabs */}
      <div className="shrink-0 border-b border-border px-6 pt-5">
        <h2 className="text-[17px] font-semibold tracking-tight">Interview Prep</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Track what you've studied. Add items to your revision queue for spaced recall.
        </p>

        <div role="tablist" aria-label="Interview topics" className="mt-4 flex gap-1">
          {topics.map(t => {
            const isActive = t === active
            return (
              <button
                key={t}
                role="tab"
                aria-selected={isActive}
                onClick={() => { setActive(t); setSearch('') }}
                className={cn(
                  'relative rounded-t-lg px-3.5 py-2.5 text-[12.5px] font-medium transition',
                  isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {topicLabel(t)}
                {isActive && (
                  <motion.span
                    layoutId="interview-tab-underline"
                    className="absolute inset-x-0 -bottom-px h-[2px] rounded-full"
                    style={{ background: 'var(--grad-selected)' }}
                    transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 px-5 pt-4 pb-2">
        <div className="flex gap-3 text-[11.5px] text-muted-foreground">
          <span>{stats.total} total</span>
          <span className="text-[var(--ev-green)]">{stats.done} done</span>
          {stats.revPending > 0 && <span className="text-[var(--ev-orange)]">{stats.revPending} pending</span>}
          {stats.revised > 0 && <span className="text-[var(--ev-teal)]">{stats.revised} revised</span>}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter…"
            className="h-8 w-40 rounded-lg border border-input bg-background pl-8 pr-3 text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>
        <button
          onClick={() => { setEditing(null); setOpen(true) }}
          className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-medium text-white"
          style={{ background: 'var(--grad-selected)' }}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {isLoading ? (
          <div className="space-y-2 pt-2">{[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-3" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-[13px] font-medium">{search ? 'No matches' : 'Nothing here yet'}</p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {search ? 'Try different keywords.' : 'Add your first item to start tracking.'}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 pt-1">
            <AnimatePresence mode="popLayout">
              {filtered.map((item: any) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  onClick={() => { setEditing(item); setOpen(true) }}
                  className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface-3 px-3.5 py-3 ring-1 ring-border transition hover:ring-primary/40"
                >
                  <span
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{ background: statusColor(item.status) }}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold leading-tight">{item.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {(item.tags ?? []).map((tag: string) => (
                        <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground ring-1 ring-border">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {item.link && (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 text-muted-foreground transition hover:text-primary"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      background: `color-mix(in oklch, ${statusColor(item.status)} 15%, transparent)`,
                      color: statusColor(item.status),
                    }}
                  >
                    {statusLabel(item.status)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <ItemModal
            item={editing}
            topicType={active}
            onSave={save}
            onDelete={editing ? () => { remove.mutate(editing.id); setOpen(false); setEditing(null) } : undefined}
            onRevise={editing?.revisionItemId ? (grade: string) => revise.mutate({ id: editing.id, grade }) : undefined}
            onClose={() => { setOpen(false); setEditing(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

/* =========================================================== modal + form */

function ItemModal({
  item, topicType, onSave, onDelete, onRevise, onClose,
}: {
  item: any
  topicType: string
  onSave: (data: any) => void
  onDelete?: () => void
  onRevise?: (grade: string) => void
  onClose: () => void
}) {
  const [f, setF] = useState({
    title: item?.title ?? '',
    description: item?.description ?? '',
    link: item?.link ?? '',
    tags: (item?.tags ?? []).join(', '),
    addToRevision: false,
  })
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.title.trim()) return
    onSave({
      title: f.title,
      description: f.description,
      link: f.link,
      tags: f.tags.split(',').map(t => t.trim()).filter(Boolean),
      addToRevision: f.addToRevision,
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
        className="fixed left-1/2 top-1/2 z-[71] flex max-h-[90%] w-[min(480px,94vw)]
                   -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl
                   bg-popover shadow-2xl ring-1 ring-border"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-[14px] font-semibold">
            {item ? 'Edit item' : `Add to ${topicLabel(topicType)}`}
          </h3>
          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-md px-2 py-1 text-[12px] text-destructive transition hover:bg-destructive/10"
              >
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <form onSubmit={submit} className="space-y-4 p-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Title</label>
              <input
                autoFocus
                value={f.title}
                onChange={e => set('title', e.target.value)}
                placeholder="Sliding window technique"
                className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-[13px] font-medium placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Description</label>
              <textarea
                rows={5}
                value={f.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Key points, mistakes, approach…"
                className="mt-1.5 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-[12.5px] leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Link</label>
              <input
                value={f.link}
                onChange={e => set('link', e.target.value)}
                placeholder="https://leetcode.com/problems/…"
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Tags</label>
              <input
                value={f.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="two-pointers, sliding-window, hard"
                className="mt-1.5 h-9 w-full rounded-lg border border-input bg-background px-3 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
              />
              <p className="mt-1 text-[10.5px] text-muted-foreground">Comma separated</p>
            </div>

            {/* Status display for existing items */}
            {item && (
              <div className="flex items-center gap-2.5 rounded-lg bg-surface-3 px-3 py-2.5 ring-1 ring-border">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: statusColor(item.status) }}
                />
                <span className="text-[12.5px] font-medium">{statusLabel(item.status)}</span>
                {item.revisionItemId && (
                  <span className="ml-auto text-[10.5px] text-muted-foreground">In revision queue</span>
                )}
              </div>
            )}

            {/* Revision grading for items already in the queue */}
            {onRevise && (
              <div className="rounded-lg bg-surface-3 p-3 ring-1 ring-border">
                <p className="text-[11px] font-medium text-muted-foreground">Mark today's revision</p>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {['AGAIN', 'HARD', 'GOOD', 'EASY'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => onRevise(g)}
                      className={cn(
                        'rounded-md py-2 text-[11px] font-medium ring-1 transition',
                        g === 'AGAIN' && 'ring-[var(--ev-red)] text-[var(--ev-red)] hover:bg-[var(--ev-red)]/10',
                        g === 'HARD' && 'ring-[var(--ev-orange)] text-[var(--ev-orange)] hover:bg-[var(--ev-orange)]/10',
                        g === 'GOOD' && 'ring-[var(--ev-green)] text-[var(--ev-green)] hover:bg-[var(--ev-green)]/10',
                        g === 'EASY' && 'ring-[var(--ev-teal)] text-[var(--ev-teal)] hover:bg-[var(--ev-teal)]/10',
                      )}
                    >
                      {g.charAt(0) + g.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add to revision — only for new items or items not yet in the queue */}
            {!item?.revisionItemId && (
              <button
                type="button"
                onClick={() => set('addToRevision', !f.addToRevision)}
                aria-pressed={f.addToRevision}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left ring-1 transition',
                  f.addToRevision ? 'ring-primary' : 'bg-surface-3 ring-border hover:ring-input'
                )}
                style={f.addToRevision ? { background: 'var(--grad-selected)' } : undefined}
              >
                <span
                  className={cn(
                    'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded ring-1 transition',
                    f.addToRevision ? 'bg-white text-primary ring-white' : 'text-transparent ring-input'
                  )}
                >
                  <Check className="h-2.5 w-2.5" strokeWidth={4} />
                </span>
                <span className="min-w-0">
                  <span className={cn('flex items-center gap-1.5 text-[12.5px] font-medium', f.addToRevision && 'text-white')}>
                    <Brain className="h-3 w-3" />
                    Add to revision queue
                  </span>
                  <span className={cn(
                    'mt-0.5 block text-[10.5px] leading-relaxed',
                    f.addToRevision ? 'text-white/75' : 'text-muted-foreground'
                  )}>
                    Status becomes "Revision pending". It updates to "Revision 1 done", "2 done", etc. as you grade.
                  </span>
                </span>
              </button>
            )}

            {/* Submit */}
            <div className="sticky -bottom-4 -mx-4 bg-popover px-4 pb-4 pt-3">
              <button
                type="submit"
                disabled={!f.title.trim()}
                className="w-full rounded-lg py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
                style={{ background: 'var(--grad-selected)' }}
              >
                {item ? 'Save changes' : 'Add item'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </>
  )
}
