import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from '../App'

// Given the user opens the app in a browser
// When the page loads
// Then they see the three-column layout and all primary nav sections

describe('App shell', () => {
  function renderApp() {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    )
  }

  it('renders the left navigation column', () => {
    renderApp()
    expect(screen.getByRole('navigation', { name: /primary/i })).toBeInTheDocument()
  })

  it('renders the workspace column', () => {
    renderApp()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders the inspector column', () => {
    renderApp()
    expect(screen.getByRole('complementary', { name: /inspector/i })).toBeInTheDocument()
  })

  it('shows all seven primary nav sections', () => {
    renderApp()
    const sections = ['Dashboard', 'Create', 'Prompt Studio', 'Library', 'History', 'Print Prep', 'Settings']
    sections.forEach((name) => {
      expect(screen.getByRole('link', { name: new RegExp(name, 'i') })).toBeInTheDocument()
    })
  })
})
