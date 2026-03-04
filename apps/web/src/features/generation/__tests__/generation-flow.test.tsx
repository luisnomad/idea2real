import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import ImageUpload from '../ImageUpload'
import JobStatus from '../JobStatus'
import ArtifactList from '../ArtifactList'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  )
}

describe('ImageUpload', () => {
  it('renders dropzone with instructions', () => {
    render(<ImageUpload onFileSelected={vi.fn()} />, { wrapper })
    expect(screen.getByText(/drop an image here/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/upload image/i)).toBeInTheDocument()
  })

  it('calls onFileSelected with valid file', async () => {
    const onFile = vi.fn()
    render(<ImageUpload onFileSelected={onFile} />, { wrapper })

    const file = new File(['pixels'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText(/upload image/i)
    await userEvent.upload(input, file)

    expect(onFile).toHaveBeenCalledWith(file)
  })

  it('shows error for unsupported mime type', async () => {
    const onFile = vi.fn()
    render(<ImageUpload onFileSelected={onFile} />, { wrapper })

    // Simulate drop with invalid file type (bypasses input accept filter)
    const file = new File(['data'], 'bad.exe', { type: 'application/x-executable' })
    const dropzone = screen.getByTestId('upload-dropzone')

    fireEvent.drop(dropzone, {
      dataTransfer: { files: [file] },
    })

    expect(screen.getByRole('alert')).toHaveTextContent(/only png, jpeg, and webp/i)
    expect(onFile).not.toHaveBeenCalled()
  })

  it('disables when disabled prop is true', () => {
    render(<ImageUpload onFileSelected={vi.fn()} disabled />, { wrapper })
    const input = screen.getByLabelText(/upload image/i)
    expect(input).toBeDisabled()
  })
})

describe('JobStatus', () => {
  const baseJob = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    userId: '550e8400-e29b-41d4-a716-446655440000',
    type: 'model_generation' as const,
    payload: {},
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  }

  it('shows loading state', () => {
    render(<JobStatus job={undefined} isLoading={true} error={null} />, { wrapper })
    expect(screen.getByText(/loading job status/i)).toBeInTheDocument()
  })

  it('shows queued status', () => {
    render(
      <JobStatus job={{ ...baseJob, status: 'queued' }} isLoading={false} error={null} />,
      { wrapper },
    )
    expect(screen.getByText('Queued')).toBeInTheDocument()
  })

  it('shows processing with progress bar', () => {
    render(
      <JobStatus
        job={{ ...baseJob, status: 'processing', progress: 45, startedAt: '2024-01-01T00:00:00.000Z' }}
        isLoading={false}
        error={null}
      />,
      { wrapper },
    )
    expect(screen.getByText('Processing')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
  })

  it('shows failed status with error and retry button', () => {
    const onRetry = vi.fn()
    render(
      <JobStatus
        job={{ ...baseJob, status: 'failed', errorMessage: 'Provider timeout' }}
        isLoading={false}
        error={null}
        onRetry={onRetry}
      />,
      { wrapper },
    )
    expect(screen.getByText('Failed')).toBeInTheDocument()
    expect(screen.getByText('Provider timeout')).toBeInTheDocument()
    fireEvent.click(screen.getByText(/retry generation/i))
    expect(onRetry).toHaveBeenCalled()
  })

  it('shows succeeded status', () => {
    render(
      <JobStatus job={{ ...baseJob, status: 'succeeded' }} isLoading={false} error={null} />,
      { wrapper },
    )
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })
})

describe('ArtifactList', () => {
  const artifacts = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      kind: 'model_source' as const,
      mimeType: 'model/gltf-binary',
      storageKey: 'models/abc.glb',
      fileSizeBytes: 1048576,
      downloadUrl: 'https://example.com/abc.glb',
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      kind: 'stl_export' as const,
      mimeType: 'model/stl',
      storageKey: 'models/abc.stl',
      fileSizeBytes: 512000,
      downloadUrl: 'https://example.com/abc.stl',
    },
  ]

  it('renders artifacts with labels and sizes', () => {
    render(<ArtifactList artifacts={artifacts} />, { wrapper })
    expect(screen.getByText('Source Model (GLB)')).toBeInTheDocument()
    expect(screen.getByText('STL Export')).toBeInTheDocument()
    expect(screen.getByText('1.0 MB')).toBeInTheDocument()
    expect(screen.getByText('500.0 KB')).toBeInTheDocument()
  })

  it('shows View button for model artifacts', () => {
    const onView = vi.fn()
    render(<ArtifactList artifacts={artifacts} onViewModel={onView} />, { wrapper })
    const viewButtons = screen.getAllByText('View')
    expect(viewButtons).toHaveLength(1) // only model_source, not stl_export
    fireEvent.click(viewButtons[0])
    expect(onView).toHaveBeenCalledWith('https://example.com/abc.glb')
  })

  it('renders nothing when empty', () => {
    const { container } = render(<ArtifactList artifacts={[]} />, { wrapper })
    expect(container.firstChild).toBeNull()
  })

  it('provides download links', () => {
    render(<ArtifactList artifacts={artifacts} />, { wrapper })
    const links = screen.getAllByText('Download')
    expect(links).toHaveLength(2)
    expect(links[0].closest('a')).toHaveAttribute('href', 'https://example.com/abc.glb')
  })
})
