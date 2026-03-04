import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock R3F — Canvas requires WebGL which jsdom doesn't support
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}))
vi.mock('@react-three/drei', () => ({
  OrbitControls: () => null,
  Stage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useGLTF: () => ({ scene: {} }),
}))

import ModelViewer from '../ModelViewer'

describe('ModelViewer', () => {
  it('shows empty state when no URL', () => {
    render(<ModelViewer url={null} />)
    expect(screen.getByTestId('viewer-empty')).toBeInTheDocument()
    expect(screen.getByText(/no model to display/i)).toBeInTheDocument()
  })

  it('renders Canvas when URL is provided', () => {
    render(<ModelViewer url="https://example.com/model.glb" />)
    expect(screen.getByTestId('model-viewer')).toBeInTheDocument()
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument()
  })
})
