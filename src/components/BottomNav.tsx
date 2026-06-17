import { NavLink } from 'react-router-dom'
import { Home, LineChart, CalendarDays, Settings } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Home', Icon: Home, end: true },
  { to: '/trends', label: 'Trends', Icon: LineChart, end: false },
  { to: '/plan', label: 'Plan', Icon: CalendarDays, end: false },
  { to: '/settings', label: 'Settings', Icon: Settings, end: false },
]

export function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-xl">
        {tabs.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                  isActive ? 'text-[var(--color-brand)]' : 'text-muted'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
