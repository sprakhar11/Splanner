import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Plus, Star, Search, X, BookOpen, ExternalLink, Copy } from 'lucide-react'
import { Input } from '@client/components/ui'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@client/hooks/useNotes'
import { useSettings } from '@client/hooks/useSettings'
import { useKeyboard } from '@client/hooks/useKeyboard'
import { cn } from '@client/lib/utils'

const DEFAULT_NOTE_TYPES = ['CONCEPT', 'INTERVIEW_QUESTION', 'CODE_SNIPPET', 'MISTAKE', 'GENERAL']

function useNoteTypes() {
  const { data: settings } = useSettings()
  let parsed: string[] = []
  try { parsed = settings?.noteTypes ? JSON.parse(settings.noteTypes) : [] } catch {}
  return parsed.length > 0 ? parsed : DEFAULT_NOTE_TYPES
}

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
  const noteTypes = useNoteTypes()

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
          {noteTypes.map(t => <option key={t} value={t}>{pretty(t)}</option>)}
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
                        <ContentWithLinks text={n.content} />
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
              className="absolute left-1/2 top-1/2 z-50 flex max-h-[92%] w-[750px] -translate-x-1/2 -translate-y-1/2
                         flex-col overflow-hidden rounded-2xl bg-popover shadow-2xl ring-1 ring-border"
            >
              <NoteForm
                note={editing}
                noteTypes={noteTypes}
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
  note, noteTypes, onSave, onClose, onDelete,
}: { note: any; noteTypes: string[]; onSave: (d: any) => void; onClose: () => void; onDelete: (id: string) => void }) {
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
      className="flex min-h-0 flex-1 flex-col"
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

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <Input placeholder="Note title" value={f.title} onChange={e => set('title', e.target.value)} autoFocus className="h-10 font-medium" />

        <RichEditor
          value={f.content}
          onChange={v => set('content', v)}
          placeholder="Write here… URLs become clickable links (right-click to copy)"
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Type</label>
            <select value={f.type} onChange={e => set('type', e.target.value)} className={cn(selectClass, 'w-full')}>
              {noteTypes.map(t => <option key={t} value={t}>{pretty(t)}</option>)}
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

      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
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

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g

/** Converts plain text to HTML with URLs wrapped in <a> tags. */
function textToHtml(text: string): string {
  // Escape HTML entities first
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Wrap URLs in anchor tags
  const withLinks = escaped.replace(
    /https?:\/\/[^\s&<>"{}|\\^`\[\]]+/g,
    url => `<a href="${url}" target="_blank" rel="noreferrer" class="text-primary underline decoration-primary/40 hover:decoration-primary cursor-pointer">${url}</a>`
  )
  // Preserve newlines
  return withLinks.replace(/\n/g, '<br>')
}

/** Extracts plain text from HTML (strips tags). */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

/**
 * A contentEditable editor that renders URLs as clickable <a> tags inline.
 * Right-click any link for the browser's native "Copy Link Address".
 */
function RichEditor({
  value, onChange, placeholder,
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isComposing = useRef(false)

  // Sync external value into the div only when it genuinely differs
  // (avoids resetting cursor on every keystroke).
  useEffect(() => {
    if (!ref.current) return
    const current = htmlToText(ref.current.innerHTML)
    if (current !== value) {
      // Save and restore cursor position
      const sel = window.getSelection()
      const hadFocus = document.activeElement === ref.current
      ref.current.innerHTML = textToHtml(value)
      if (hadFocus && sel) {
        // Move cursor to end after external update
        const range = document.createRange()
        range.selectNodeContents(ref.current)
        range.collapse(false)
        sel.removeAllRanges()
        sel.addRange(range)
      }
    }
  }, [value])

  const handleInput = () => {
    if (isComposing.current || !ref.current) return
    const text = htmlToText(ref.current.innerHTML)
    onChange(text)

    // Re-render with links after a short delay so typing isn't interrupted
    setTimeout(() => {
      if (!ref.current || document.activeElement !== ref.current) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return

      // Save cursor offset
      const range = sel.getRangeAt(0)
      const preRange = document.createRange()
      preRange.selectNodeContents(ref.current)
      preRange.setEnd(range.startContainer, range.startOffset)
      const cursorOffset = preRange.toString().length

      // Re-render HTML with links
      const newHtml = textToHtml(text)
      if (ref.current.innerHTML !== newHtml) {
        ref.current.innerHTML = newHtml
        // Restore cursor
        restoreCursor(ref.current, cursorOffset)
      }
    }, 300)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        contentEditable
        onInput={handleInput}
        onCompositionStart={() => { isComposing.current = true }}
        onCompositionEnd={() => { isComposing.current = false; handleInput() }}
        onPaste={handlePaste}
        suppressContentEditableWarning
        className="min-h-[320px] w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-[12px]
                   leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/60 whitespace-pre-wrap break-words"
        style={{ overflowY: 'auto', maxHeight: '50vh' }}
      />
      {!value && (
        <p className="pointer-events-none absolute left-3 top-2 font-mono text-[12px] text-muted-foreground">
          {placeholder}
        </p>
      )}
    </div>
  )
}

/** Restores cursor to a character offset within a contentEditable element. */
function restoreCursor(el: HTMLElement, offset: number) {
  const sel = window.getSelection()
  if (!sel) return

  let remaining = offset
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let node: Text | null = null

  while ((node = walker.nextNode() as Text | null)) {
    if (remaining <= node.length) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    remaining -= node.length
  }

  // If offset exceeds content, put cursor at end
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

/** Renders text with URLs as clickable links (for the card preview). */
function ContentWithLinks({ text }: { text: string }) {
  const parts: { text: string; isLink: boolean }[] = []
  let last = 0
  let match: RegExpExecArray | null

  const re = new RegExp(URL_RE.source, 'g')
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), isLink: false })
    parts.push({ text: match[0], isLink: true })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), isLink: false })

  return (
    <>
      {parts.map((p, i) =>
        p.isLink ? (
          <a
            key={i}
            href={p.text}
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-primary underline decoration-primary/40 hover:decoration-primary"
          >
            {p.text.length > 50 ? p.text.slice(0, 47) + '...' : p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  )
}

/** Extracts all URLs from text content. */
function extractLinks(text: string): string[] {
  return [...(text.match(URL_RE) || [])].filter((v, i, a) => a.indexOf(v) === i)
}

/** Copyable link chip shown below the editor. */
function LinkChip({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const display = (() => {
    try {
      const u = new URL(url)
      return u.hostname + (u.pathname.length > 1 ? u.pathname.slice(0, 30) : '')
    } catch {
      return url.slice(0, 40)
    }
  })()

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1.5 ring-1 ring-border">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1 truncate text-[11.5px] text-primary underline decoration-primary/40 hover:decoration-primary"
        title={url}
      >
        <ExternalLink className="mr-1 inline h-3 w-3" />
        {display}
      </a>
      <button
        type="button"
        onClick={copy}
        title="Copy link"
        className="shrink-0 rounded p-0.5 text-muted-foreground transition hover:text-foreground"
      >
        {copied
          ? <span className="text-[10px] text-[var(--ev-green)]">Copied</span>
          : <Copy className="h-3 w-3" />}
      </button>
    </div>
  )
}
