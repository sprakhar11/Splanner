import { NavLink } from 'react-router-dom'
import { Home, Calendar, BookOpen, Brain, BarChart3, Briefcase, Moon, Settings } from 'lucide-react'

const mainNav = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/planner', label: 'Planner', icon: Calendar },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/revise', label: 'Revise', icon: Brain },
  { to: '/stats', label: 'Stats', icon: BarChart3 },
]

const secondaryNav = [
  { to: '/interview', label: 'Interview Prep', icon: Briefcase },
  { to: '/reflection', label: 'Reflection', icon: Moon },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function NavItem({ to, label, icon: Icon }: { to: string; label: string; icon: React.ComponentType<any> }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  )
}

export default function Sidebar() {
  return (
    <aside
      className="h-screen sticky top-0 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      style={{ width: 'var(--sidebar-width)' }}
    >
      <div className="p-4 pb-2">
        <h1 className="text-base font-semibold tracking-tight">Splanner</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {mainNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <div className="my-3 mx-2 border-t border-sidebar-border" />

        {secondaryNav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground">All data stays on device</p>
      </div>
    </aside>
  )
}
