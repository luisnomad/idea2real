import { useState, useLayoutEffect } from 'react'
import Shell from './components/Shell'
import AppRoutes from './router'
import { getSystemTheme, applyTheme, type Theme } from './theme'

// Apply before first paint to avoid flash of unstyled content
applyTheme(getSystemTheme())

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme())

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <Shell onToggleTheme={toggleTheme} isDark={theme === 'dark'}>
      <AppRoutes />
    </Shell>
  )
}
