import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, beforeEach } from 'vitest'
import App from '../App'

// Given the app respects system theme preference
// When the user toggles the theme button
// Then the html element gains or loses the "dark" class

describe('Theme toggle', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
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
