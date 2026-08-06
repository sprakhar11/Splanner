import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@client/lib/utils'

type ToastTone = 'info' | 'success' | 'warning'

export type Toast = {
  id: string
  title: string
  body?: string
  tone?: ToastTone
  /** Optional click-through action, e.g. jump to the task. */
  action?: { label: string; onClick: () => void }
}

const ToastContext = createContext<{
  toast: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
} | null>(null)

const ICONS: Record<ToastTone, React.ComponentType<any>> = {
  info: Bell,
  success: CheckCircle2,
  warning: AlertCircle,
}

const TONE_COLOR: Record<ToastTone, string> = {
  info: 'var(--primary)',
  success: 'var(--ev-green)',
  warning: 'var(--ev-orange)',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setItems(list => list.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID()
    setItems(list => [...list.slice(-3), { ...t, id }])
    // Warnings linger; everything else clears on its own.
    if (t.tone !== 'warning') setTimeout(() => dismiss(id), 6000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      <div
        className="pointer-events-none fixed right-5 top-5 z-[70] flex w-[320px] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <AnimatePresence>
          {items.map(t => {
            const tone = t.tone ?? 'info'
            const Icon = ICONS[tone]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="pointer-events-auto flex gap-3 rounded-xl bg-popover/95 p-3 shadow-2xl ring-1 ring-border backdrop-blur"
              >
                <div
                  className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                  style={{ background: `color-mix(in oklch, ${TONE_COLOR[tone]} 18%, transparent)` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: TONE_COLOR[tone] }} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold leading-tight">{t.title}</p>
                  {t.body && (
                    <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{t.body}</p>
                  )}
                  {t.action && (
                    <button
                      onClick={() => { t.action!.onClick(); dismiss(t.id) }}
                      className="mt-2 text-[11.5px] font-medium text-primary transition hover:underline"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className={cn(
                    'grid h-5 w-5 shrink-0 place-items-center rounded-md text-muted-foreground',
                    'transition hover:bg-surface-3 hover:text-foreground'
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
