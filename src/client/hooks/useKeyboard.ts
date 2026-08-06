import { useEffect } from 'react'

type Handler = (e: KeyboardEvent) => void

/**
 * Global keyboard shortcut hook.
 * Ignores events when focus is inside an input, textarea, or select.
 */
export function useKeyboard(bindings: Record<string, Handler>, deps: any[] = []) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName?.toLowerCase()
      const isEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable

      // Allow Cmd/Ctrl combos even in inputs
      const isModified = e.metaKey || e.ctrlKey
      if (isEditable && !isModified) return

      // Build key signature
      let key = e.key.toLowerCase()
      if (isModified) key = `mod+${key}`

      const fn = bindings[key]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, deps)
}
