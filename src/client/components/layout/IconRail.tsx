import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  LayoutGrid, CalendarDays, Brain, BookOpen, BarChart3,
  Briefcase, Settings, Sunset, PanelLeftOpen, PanelLeftClose, Heart,
  Eye, EyeOff, Sprout,
} from 'lucide-react'
import { cn } from '@client/lib/utils'
import { useSettings } from '@client/hooks/useSettings'
import { getDisabledTabs } from '@client/lib/settings'

/**
 * `tabKey`, not `key`: these objects are spread into JSX, and a property named
 * `key` is consumed by React as the element key instead of reaching the
 * component. That silently overrode the real key with null on every entry that
 * cannot be disabled, so several siblings shared a null key.
 */
const primary = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, tabKey: null },
  { to: '/planner', label: 'Planner', icon: CalendarDays, tabKey: null },
  { to: '/revise', label: 'Revise', icon: Brain, tabKey: 'revise' as const },
  { to: '/journal', label: 'Journal', icon: BookOpen, tabKey: null },
  { to: '/stats', label: 'Stats', icon: BarChart3, tabKey: 'stats' as const },
  { to: '/interview', label: 'Interview Prep', icon: Briefcase, tabKey: 'interview' as const },
  { to: '/habits', label: 'Habits', icon: Sprout, tabKey: 'habit' as const },
  { to: '/life', label: 'Life', icon: Heart, tabKey: 'life' as const },
]

const secondary = [
  { to: '/settings', label: 'Settings', icon: Settings, tabKey: null },
  { to: '/reflection', label: 'Reflection', icon: Sunset, tabKey: 'reflection' as const },
]

const COLLAPSED_W = 68
const EXPANDED_W = 200

function RailLink({
  to, label, icon: Icon, expanded,
}: { to: string; label: string; icon: React.ComponentType<any>; expanded: boolean }) {
  return (
    <NavLink to={to} end={to === '/'} title={!expanded ? label : undefined} aria-label={label} className="group relative block w-full">
      {({ isActive }) => (
        <>
          <div
            className={cn(
              'relative flex items-center gap-3 rounded-xl transition-colors duration-200',
              expanded ? 'px-3 py-2.5' : 'h-11 w-11 justify-center',
              isActive
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
            )}
          >
            {isActive && (
              <motion.span
                layoutId="rail-active"
                className="absolute inset-0 rounded-xl"
                style={{ background: 'var(--grad-selected)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={2} />
            {expanded && (
              <span className="relative truncate text-[13px] font-medium">{label}</span>
            )}
          </div>

          {/* Tooltip — only in collapsed mode */}
          {!expanded && (
            <span
              className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap
                         rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg
                         ring-1 ring-border transition-opacity duration-150 group-hover:opacity-100"
            >
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

/** Same shape as RailLink, but for actions rather than navigation. */
function RailButton({
  label, icon: Icon, expanded, active, onClick,
}: {
  label: string
  icon: React.ComponentType<any>
  expanded: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={!expanded ? label : undefined}
      aria-label={label}
      aria-pressed={active}
      className="group relative block w-full"
    >
      <div
        className={cn(
          'relative flex items-center gap-3 rounded-xl transition-colors duration-200',
          expanded ? 'px-3 py-2.5' : 'h-11 w-11 justify-center',
          active
            ? 'bg-surface-3 text-foreground'
            : 'text-muted-foreground hover:bg-surface-3 hover:text-foreground'
        )}
      >
        <Icon className="relative h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        {expanded && (
          <span className="relative truncate text-[13px] font-medium">{label}</span>
        )}
      </div>

      {!expanded && (
        <span
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap
                     rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg
                     ring-1 ring-border transition-opacity duration-150 group-hover:opacity-100"
        >
          {label}
        </span>
      )}
    </button>
  )
}

export default function IconRail() {
  const [expanded, setExpanded] = useState(() => {
    try { return localStorage.getItem('splanner.railExpanded') === 'true' } catch { return false }
  })

  const { data: settings } = useSettings()
  const disabled = getDisabledTabs(settings)

  // Privacy blur. Persisted so the mode survives a reload — index.html applies
  // the class before first paint so blurred content never flashes into view.
  const [blurred, setBlurred] = useState(() => {
    try { return localStorage.getItem('splanner.privacyBlur') === 'true' } catch { return false }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('privacy-blur', blurred)
  }, [blurred])

  const toggleBlur = () => {
    setBlurred(v => {
      const next = !v
      try { localStorage.setItem('splanner.privacyBlur', String(next)) } catch {}
      return next
    })
  }

  const toggle = () => {
    setExpanded(v => {
      const next = !v
      try { localStorage.setItem('splanner.railExpanded', String(next)) } catch {}
      return next
    })
  }

  return (
    <motion.aside
      animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="flex shrink-0 flex-col overflow-hidden py-5"
    >
      <div className={cn('flex flex-col', expanded ? 'items-stretch px-3' : 'items-center')}>
        {/* Logo + expand toggle */}
        <div className={cn('mb-4 flex items-center', expanded ? 'justify-between px-1' : 'justify-center')}>
          <div className="grid h-10 w-10 shrink-0 place-items-center">
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none">
              <rect width="32" height="32" rx="7" fill="var(--surface-3)"/>
              <path d="M8 12h16M8 18h16M14 8v18M20 8v18" stroke="var(--border)" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
              <path d="M10 16.5l4 4 8-9" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="7" r="1.5" fill="var(--primary)"/>
              <circle cx="20" cy="7" r="1.5" fill="var(--primary)"/>
            </svg>
          </div>
          {expanded && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[15px] font-semibold tracking-tight"
            >
              Splanner
            </motion.span>
          )}
          <button
            onClick={toggle}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            className={cn(
              'grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition hover:bg-surface-3 hover:text-foreground',
              !expanded && 'mt-2'
            )}
          >
            {expanded
              ? <PanelLeftClose className="h-4 w-4" />
              : <PanelLeftOpen className="h-4 w-4" />}
          </button>
        </div>

        <nav className={cn('flex flex-col gap-1', expanded ? 'items-stretch' : 'items-center')}>
          {primary
            .filter(i => !i.tabKey || !disabled.has(i.tabKey))
            .map(({ tabKey, ...i }) => <RailLink key={i.to} {...i} expanded={expanded} />)}
        </nav>

        <div className={cn('mt-auto flex flex-col gap-1 pt-4', expanded ? 'items-stretch' : 'items-center')}>
          <RailButton
            label={blurred ? 'Unblur content' : 'Blur content'}
            icon={blurred ? EyeOff : Eye}
            expanded={expanded}
            active={blurred}
            onClick={toggleBlur}
          />
          {secondary
            .filter(i => !i.tabKey || !disabled.has(i.tabKey))
            .map(({ tabKey, ...i }) => <RailLink key={i.to} {...i} expanded={expanded} />)}
        </div>
      </div>
    </motion.aside>
  )
}
