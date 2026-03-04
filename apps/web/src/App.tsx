import { useState, useEffect } from 'react'
import Shell from './components/Shell'
import AppRoutes from './router'
import { getSystemTheme, applyTheme, type Theme } from './theme'

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => getSystemTheme())

  useEffect(() => {
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
