import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'

/**
 * Always-on-top floating window via the Document Picture-in-Picture API.
 *
 * Two constraints shape this:
 *
 *  1. requestWindow() needs transient user activation, so it can only be called
 *     synchronously from a real click. It is therefore opened when the timer is
 *     STARTED, not when the tab loses focus — visibilitychange is not a gesture,
 *     so auto-opening on navigate-away is impossible.
 *  2. The PiP document starts empty and inherits no styles, so the opener's
 *     stylesheets are copied across.
 *
 * Chromium-only. Everywhere else isSupported is false and callers fall back to
 * the document title.
 */

type PipContextValue = {
  isSupported: boolean
  pipWindow: Window | null
  /** Must be called from a user gesture. Resolves to null if unavailable. */
  popOut: (size?: { width: number; height: number }) => Promise<Window | null>
  close: () => void
}

const PipContext = createContext<PipContextValue | null>(null)

const DEFAULT_SIZE = { width: 350, height: 200 }

function isSupportedNow() {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window
}

/**
 * Clones the opener's styles into the PiP document.
 * Same-origin sheets are read directly; anything that throws on cssRules is
 * re-linked by href instead.
 */
function copyStyles(target: Window) {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      const css = Array.from(sheet.cssRules).map(r => r.cssText).join('\n')
      const style = target.document.createElement('style')
      style.textContent = css
      target.document.head.appendChild(style)
    } catch {
      // Cross-origin sheet: link it rather than inlining.
      if (sheet.href) {
        const link = target.document.createElement('link')
        link.rel = 'stylesheet'
        link.href = sheet.href
        target.document.head.appendChild(link)
      }
    }
  }

  // The PiP document has its own <html>/<body>, so the theme classes and
  // background have to be mirrored or the window renders unstyled white.
  target.document.documentElement.className = document.documentElement.className
  target.document.body.className = document.body.className
  target.document.body.style.margin = '0'
  target.document.body.style.background = 'var(--surface, #10151f)'
}

export function PictureInPictureProvider({ children }: { children: React.ReactNode }) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const supported = isSupportedNow()

  // Held in a ref so close() never captures a stale window.
  const windowRef = useRef<Window | null>(null)
  windowRef.current = pipWindow

  const close = useCallback(() => {
    try {
      windowRef.current?.close()
    } catch {
      /* already gone */
    }
    setPipWindow(null)
  }, [])

  const popOut = useCallback(async (size = DEFAULT_SIZE) => {
    if (!supported) return null

    // Reuse an open window rather than stacking a second one.
    if (windowRef.current && !windowRef.current.closed) return windowRef.current

    try {
      const win = await (window as any).documentPictureInPicture.requestWindow(size)
      copyStyles(win)

      // Closing via the window's own button must clear our state too.
      win.addEventListener('pagehide', () => setPipWindow(null), { once: true })

      setPipWindow(win)
      return win as Window
    } catch {
      // Denied, or no user activation left. Callers degrade to the title clock.
      return null
    }
  }, [supported])

  // Never leave an orphaned window behind on unmount.
  useEffect(() => () => {
    try { windowRef.current?.close() } catch { /* noop */ }
  }, [])

  return (
    <PipContext.Provider value={{ isSupported: supported, pipWindow, popOut, close }}>
      {children}
    </PipContext.Provider>
  )
}

export function usePictureInPicture() {
  const ctx = useContext(PipContext)
  if (!ctx) throw new Error('usePictureInPicture must be used inside <PictureInPictureProvider>')
  return ctx
}

/** Inert stand-in used when no provider is mounted. */
const NOOP_PIP: PipContextValue = {
  isSupported: false,
  pipWindow: null,
  popOut: async () => null,
  close: () => {},
}

/**
 * Same as usePictureInPicture but tolerates a missing provider.
 *
 * The focus timer is the core feature and the floating window is an
 * enhancement, so the timer must not hard-require this provider. Consumers get
 * a no-op and simply never float a window.
 */
export function useOptionalPictureInPicture(): PipContextValue {
  return useContext(PipContext) ?? NOOP_PIP
}
