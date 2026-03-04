import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import App from '../App'

// Given the app shell is rendered
// When the user clicks a nav item
// Then the workspace shows the corresponding view

const routes = [
  { label: 'Dashboard',     heading: /dashboard/i },
  { label: 'Create',        heading: /create/i },
  { label: 'Prompt Studio', heading: /prompt studio/i },
  { label: 'Library',       heading: /library/i },
  { label: 'History',       heading: /history/i },
  { label: 'Print Prep',    heading: /print prep/i },
  { label: 'Settings',      heading: /settings/i },
]

describe('Navigation routing', () => {
  routes.forEach(({ label, heading }) => {
    it(`clicking "${label}" shows the ${label} view`, async () => {
      const user = userEvent.setup()
      render(
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      )
      await user.click(screen.getByRole('link', { name: new RegExp(label, 'i') }))
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
    })
  })
})
