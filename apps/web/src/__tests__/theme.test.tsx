import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'

// Given the app respects system theme preference
// When the user toggles the theme button
// Then the html element gains or loses the "dark" class

describe('Theme toggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
    // Reset matchMedia to light mode default
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })),
    })
  })

  // Given the system prefers dark mode
  // When the app first renders
  // Then the "dark" class is applied immediately (no FOUC)
  it('applies dark class on initial render when system prefers dark', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      })),
    })
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('renders a theme toggle button', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /toggle theme/i })).toBeInTheDocument()
  })

  it('adds "dark" class to <html> when toggled on', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    const toggle = screen.getByRole('button', { name: /toggle theme/i })
    await user.click(toggle)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('removes "dark" class from <html> when toggled off again', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    )
    const toggle = screen.getByRole('button', { name: /toggle theme/i })
    await user.click(toggle) // on
    await user.click(toggle) // off
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
