import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@client/lib/utils'

/**
 * A modal panel, either centred or sliding in from the right.
 *
 * Built on Radix Dialog rather than a bare `position: fixed` div, which buys
 * focus trapping, Escape to close, scroll locking, and correct aria wiring —
 * all of which the hand-rolled sheet in `components/focus` is missing. Motion
 * still drives the animation, so it matches the rest of the app.
 *
 * `forceMount` plus AnimatePresence is what lets the exit animation run: Radix
 * would otherwise unmount the content the instant `open` flips to false.
 */

export type SheetSide = 'center' | 'right'

const PANEL: Record<SheetSide, string> = {
  center:
    'left-1/2 top-1/2 max-h-[86vh] w-[min(560px,94vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl',
  right:
    'right-3 top-3 bottom-3 w-[min(460px,94vw)] rounded-2xl',
}

const MOTION: Record<SheetSide, {
  initial: Record<string, number>
  animate: Record<string, number>
  exit: Record<string, number>
}> = {
  center: {
    initial: { opacity: 0, y: 24, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 24, scale: 0.98 },
  },
  right: {
    initial: { opacity: 0, x: 32 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 32 },
  },
}

export function Sheet({
  open,
  onOpenChange,
  title,
  subtitle,
  side = 'center',
  footer,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required: it labels the dialog for assistive tech, not just for looks. */
  title: React.ReactNode
  subtitle?: React.ReactNode
  side?: SheetSide
  footer?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-[2px]"
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content
              asChild
              forceMount
              // No description is supplied, so point aria-describedby at nothing
              // rather than let Radix warn about a missing one.
              aria-describedby={undefined}
            >
              <motion.div
                {...MOTION[side]}
                transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                className={cn(
                  'fixed z-[86] flex flex-col overflow-hidden bg-popover shadow-2xl ring-1 ring-border',
                  PANEL[side],
                  className
                )}
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="min-w-0">
                    <DialogPrimitive.Title className="text-[14px] font-semibold leading-tight">
                      {title}
                    </DialogPrimitive.Title>
                    {subtitle && (
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <DialogPrimitive.Close
                    aria-label="Close"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </DialogPrimitive.Close>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>

                {footer && (
                  <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3">
                    {footer}
                  </div>
                )}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
