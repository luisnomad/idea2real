import { NavLink } from 'react-router-dom'

interface NavItemProps {
  to: string
  label: string
  icon: string
}

export default function NavItem({ to, label, icon }: NavItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-500 text-white'
            : 'text-ink-secondary hover:bg-surface-overlay hover:text-ink-primary dark:text-ink-dark-secondary dark:hover:bg-surface-dark-overlay dark:hover:text-ink-dark-primary',
        ].join(' ')
      }
    >
      <span aria-hidden="true">{icon}</span>
      {label}
    </NavLink>
  )
}
