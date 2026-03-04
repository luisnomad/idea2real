import { useState, useLayoutEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import Shell from './components/Shell'
import AppRoutes from './router'
import { getSystemTheme, applyTheme, type Theme } from './theme'
import { queryClient } from './lib/query-client'

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
    <QueryClientProvider client={queryClient}>
      <Shell onToggleTheme={toggleTheme} isDark={theme === 'dark'}>
        <AppRoutes />
      </Shell>
    </QueryClientProvider>
  )
}
