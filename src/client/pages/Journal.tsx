import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Star, Search, X, BookOpen } from 'lucide-react'
import { Input } from '@client/components/ui'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@client/hooks/useNotes'
import { useKeyboard } from '@client/hooks/useKeyboard'
import { cn } from '@client/lib/utils'

const TYPES = ['CONCEPT', 'INTERVIEW_QUESTION', 'CODE_SNIPPET', 'MISTAKE', 'GENERAL']

const TYPE_COLOR: Record<string, string> = {
  CONCEPT: 'var(--ev-blue)',
  INTERVIEW_QUESTION: 'var(--ev-orange)',
  CODE_SNIPPET: 'var(--ev-purple)',
  MISTAKE: 'var(--ev-red)',
  GENERAL: 'var(--ev-teal)',
}

const pretty = (t: string) => t.charAt(0) + t.slice(1).toLowerCase().replace('_', ' ')

const selectClass =
  'h-9 rounded-lg border border-input bg-surface-3 px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-primary/60'

export default function Journal() {
  const { data: notes = [], isLoading } = useNotes()
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [favOnly, setFavOnly] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [open, setOpen] = useState(false)

  const filtered = notes.filter((n: any) => {
    if (type && n.type !== type) return false
    if (favOnly && !n.isFavorite) return false
    if (search) {
      const q = search.toLowerCase()
      return n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q)
    }
    return true
  })

  const openNew = () => { setEditing(null); setOpen(true) }
  const close = () => { setOpen(false); setEditing(null) }

  const save = (data: any) => {
    if (editing) updateNote.mutate({ id: editing.id, data })
    else createNote.mutate(data)
    close()
  }

  useKeyboard({ c: openNew, escape: close }, [editing])

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes"
            className="h-9 w-full rounded-lg bg-surface-3 pl-9 pr-3 text-[12.5px] placeholder:text-muted-foreground
                       ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>

        <select value={type} onChange={e => setType(e.target.value)} className={selectClass}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{pretty(t)}</option>)}
        </select>

        <button
          onClick={() => setFavOnly(!favOnly)}
          aria-pressed={favOnly}
          className={cn(
            'grid h-9 w-9 place-items-center rounded-lg ring-1 ring-border transition',
            favOnly ? 'bg-primary/20 text-primary' : 'bg-surface-3 text-muted-foreground hover:text-foreground'
          )}
          title="Favourites only"
        >
          <Star className={cn('h-3.5 w-3.5', favOnly && 'fill-current')} />
        </button>

        <button
          onClick={openNew}
          className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-white transition hover:opacity-90"
          style={{ background: 'var(--grad-selected)' }}
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>

      <div className="h-px bg-border" />

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid gap-2 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-[86px] animate-pulse rounded-xl bg-surface-3" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-surface-3">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[13px] font-medium">
              {notes.length === 0 ? 'No notes yet' : 'No matches'}
            </p>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              {notes.length === 0 ? 'Capture a concept, question, or mistake.' : 'Try a different search or filter.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {filtered.map((n: any) => (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => { setEditing(n); setOpen(true) }}
                  className="cursor-pointer overflow-hidden rounded-xl bg-surface-3 ring-1 ring-border transition hover:ring-primary/40"
                >
                  <div className="h-[3px] w-full" style={{ background: TYPE_COLOR[n.type] }} />
                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-tight">{n.title}</p>
                      {n.isFavorite && <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />}
                    </div>
                    {n.content && (
                      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                        {n.content}
                      </p>
                    )}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{pretty(n.type)}</span>
                      {n.revisionScheduled && (
                        <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9.5px] font-medium text-primary">
                          Revision
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={close}
              className="absolute inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', stiffness: 460, damping: 34 }}
              className="absolute left-1/2 top-1/2 z-50 w-[440px] -translate-x-1/2 -translate-y-1/2
                         overflow-hidden rounded-2xl bg-popover shadow-2xl ring-1 ring-border"
            >
              <NoteForm
                note={editing}
                onSave={save}
                onClose={close}
                onDelete={id => { deleteNote.mutate(id); close() }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

function NoteForm({
  note, onSave, onClose, onDelete,
}: { note: any; onSave: (d: any) => void; onClose: () => void; onDelete: (id: string) => void }) {
  const [f, setF] = useState({
    title: note?.title ?? '',
    content: note?.content ?? '',
    type: note?.type ?? 'GENERAL',
    isFavorite: note?.isFavorite ?? false,
    revisionScheduled: note?.revisionScheduled ?? false,
    tags: note?.tags?.join(', ') ?? '',
  })

  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }))

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!f.title.trim()) return
        onSave({ ...f, tags: f.tags.split(',').map((t: string) => t.trim()).filter(Boolean) })
      }}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-[14px] font-semibold">{note ? 'Edit note' : 'New note'}</h3>
        <div className="flex items-center gap-1">
          {note && (
            <button
              type="button"
              onClick={() => onDelete(note.id)}
              className="rounded-md px-2 py-1 text-[12px] text-destructive transition hover:bg-destructive/10"
            >
              Delete
            </button>
          )}
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <Input placeholder="Note title" value={f.title} onChange={e => set('title', e.target.value)} autoFocus className="h-10 font-medium" />

        <textarea
          placeholder="Write in markdown…"
          value={f.content}
          onChange={e => set('content', e.target.value)}
          rows={8}
          className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 font-mono text-[12px]
                     leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Type</label>
            <select value={f.type} onChange={e => set('type', e.target.value)} className={cn(selectClass, 'w-full')}>
              {TYPES.map(t => <option key={t} value={t}>{pretty(t)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Tags</label>
            <Input placeholder="dsa, dp, recursion" value={f.tags} onChange={e => set('tags', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4">
          {[
            { k: 'isFavorite', label: 'Favourite' },
            { k: 'revisionScheduled', label: 'Schedule revision' },
          ].map(o => (
            <label key={o.k} className="flex cursor-pointer items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={(f as any)[o.k]}
                onChange={e => set(o.k, e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-[var(--primary)]"
              />
              {o.label}
            </label>
          ))}
        </div>

        <button
          type="submit"
          disabled={!f.title.trim()}
          className="w-full rounded-lg py-2.5 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
          style={{ background: 'var(--grad-selected)' }}
        >
          {note ? 'Save changes' : 'Create note'}
        </button>
      </div>
    </form>
  )
}
