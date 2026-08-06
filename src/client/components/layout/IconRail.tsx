import { NavLink } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  LayoutGrid, CalendarDays, Brain, BookOpen, BarChart3,
  Briefcase, Settings, Sunset,
} from 'lucide-react'
import { cn } from '@client/lib/utils'

const primary = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid },
  { to: '/planner', label: 'Planner', icon: CalendarDays },
  { to: '/revise', label: 'Revise', icon: Brain },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
  { to: '/interview', label: 'Interview Prep', icon: Briefcase },
]

const secondary = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/reflection', label: 'Reflection', icon: Sunset },
]

function RailLink({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<any> }) {
  return (
    <NavLink to={to} end={to === '/'} title={label} aria-label={label} className="group relative block">
      {({ isActive }) => (
        <>
          <div
            className={cn(
              'relative grid h-11 w-11 place-items-center rounded-xl transition-colors duration-200',
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
            <Icon className="relative h-[18px] w-[18px]" strokeWidth={2} />
          </div>

          {/* Tooltip */}
          <span
            className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap
                       rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground opacity-0 shadow-lg
                       ring-1 ring-border transition-opacity duration-150 group-hover:opacity-100"
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

export default function IconRail() {
  return (
    <aside
      className="flex shrink-0 flex-col items-center gap-1 py-5"
      style={{ width: 'var(--rail-width)' }}
    >
      {/* Logo */}
      <div className="mb-4 grid h-10 w-10 place-items-center">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none">
          <path d="M4 4l8 16 8-16" stroke="var(--primary)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <nav className="flex flex-col items-center gap-1.5">
        {primary.map(i => <RailLink key={i.to} {...i} />)}
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1.5">
        {secondary.map(i => <RailLink key={i.to} {...i} />)}

        {/* Avatar */}
        <div className="mt-2 grid h-10 w-10 place-items-center rounded-full bg-surface-3 ring-2 ring-primary/40">
          <span className="text-sm font-semibold text-foreground">P</span>
        </div>
      </div>
    </aside>
  )
}
