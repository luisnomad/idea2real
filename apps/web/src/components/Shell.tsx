import type { ReactNode } from 'react'
import NavItem from './NavItem'

const NAV_ITEMS = [
  { to: '/dashboard',     label: 'Dashboard',     icon: '⊞' },
  { to: '/create',        label: 'Create',         icon: '✦' },
  { to: '/prompt-studio', label: 'Prompt Studio',  icon: '✎' },
  { to: '/library',       label: 'Library',        icon: '▤' },
  { to: '/history',       label: 'History',        icon: '↺' },
  { to: '/print-prep',    label: 'Print Prep',     icon: '⬡' },
  { to: '/settings',      label: 'Settings',       icon: '⚙' },
]

interface ShellProps {
  onToggleTheme: () => void
  isDark: boolean
  children: ReactNode
}

export default function Shell({ onToggleTheme, isDark, children }: ShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-base dark:bg-surface-dark-base text-ink-primary dark:text-ink-dark-primary">
      {/* Left nav */}
      <nav
        aria-label="primary"
        className="flex flex-col w-nav shrink-0 border-r border-surface-border dark:border-surface-dark-border bg-surface-raised dark:bg-surface-dark-raised"
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 py-5 border-b border-surface-border dark:border-surface-dark-border">
          <span className="text-brand-500 font-bold text-lg tracking-tight">idea2real</span>
        </div>

        {/* Nav links */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </div>

        {/* Theme toggle */}
        <div className="px-4 py-4 border-t border-surface-border dark:border-surface-dark-border">
          <button
            type="button"
            aria-label="toggle theme"
            onClick={onToggleTheme}
            className="flex items-center gap-2 text-xs text-ink-muted dark:text-ink-dark-muted hover:text-ink-primary dark:hover:text-ink-dark-primary transition-colors"
          >
            <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </nav>

      {/* Workspace */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Inspector */}
      <aside
        aria-label="inspector"
        className="w-inspector shrink-0 border-l border-surface-border dark:border-surface-dark-border bg-surface-raised dark:bg-surface-dark-raised overflow-y-auto"
      >
        <div className="px-4 py-5 border-b border-surface-border dark:border-surface-dark-border">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-muted dark:text-ink-dark-muted">Inspector</p>
        </div>
        <div className="px-4 py-4 text-sm text-ink-muted dark:text-ink-dark-muted">
          Select an item to inspect
        </div>
      </aside>
    </div>
  )
}
