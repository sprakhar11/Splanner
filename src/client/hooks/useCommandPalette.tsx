import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type PaletteContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const PaletteContext = createContext<PaletteContextValue | null>(null)

/**
 * Owns command palette visibility and the global Cmd/Ctrl+K binding.
 *
 * The listener lives here rather than in useKeyboard because the palette must
 * open even while focus is inside an input, and it must be able to close itself
 * on Escape while its own search field has focus.
 */
export function CommandPaletteProvider({
  children,
  /** Starts open. Used by verification scripts to render the open state. */
  defaultOpen = false,
}: { children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(v => !v), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && k === 'k') {
        e.preventDefault()
        toggle()
      }
      // Also accept the conventional "/" when not already typing somewhere.
      if (k === '/' && !isOpen) {
        const t = e.target as HTMLElement
        const tag = t.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return
        e.preventDefault()
        open()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, open, isOpen])

  return (
    <PaletteContext.Provider value={{ isOpen, open, close, toggle }}>
      {children}
    </PaletteContext.Provider>
  )
}

export function useCommandPalette() {
  const ctx = useContext(PaletteContext)
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteProvider>')
  return ctx
}
