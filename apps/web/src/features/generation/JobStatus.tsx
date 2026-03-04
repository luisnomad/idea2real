import type { JobDetailResponse } from '@idea2real/contracts'

interface JobStatusProps {
  job: JobDetailResponse | undefined
  isLoading: boolean
  error: Error | null
  onRetry?: () => void
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'Queued',
  processing: 'Processing',
  succeeded: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  queued: 'text-yellow-500',
  processing: 'text-blue-500',
  succeeded: 'text-green-500',
  failed: 'text-red-500',
  cancelled: 'text-ink-muted dark:text-ink-dark-muted',
}

export default function JobStatus({ job, isLoading, error, onRetry }: JobStatusProps) {
  if (isLoading && !job) {
    return <p className="text-sm text-ink-muted dark:text-ink-dark-muted">Loading job status...</p>
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        <p>Failed to fetch job status.</p>
        {onRetry && (
          <button onClick={onRetry} className="underline mt-1" type="button">
            Retry
          </button>
        )}
      </div>
    )
  }

  if (!job) return null

  return (
    <div data-testid="job-status" className="space-y-2">
      <div className="flex items-center gap-2">
        <span className={`font-medium ${STATUS_COLORS[job.status] ?? ''}`}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
        {job.status === 'processing' && job.progress != null && (
          <span className="text-xs text-ink-muted dark:text-ink-dark-muted">
            {job.progress}%
          </span>
        )}
      </div>

      {job.status === 'processing' && job.progress != null && (
        <div className="h-1.5 rounded-full bg-surface-border dark:bg-surface-dark-border overflow-hidden">
          <div
            className="h-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}

      {job.status === 'failed' && job.errorMessage && (
        <p className="text-sm text-red-400">{job.errorMessage}</p>
      )}

      {job.status === 'failed' && onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="text-sm text-brand-500 hover:underline"
        >
          Retry generation
        </button>
      )}
    </div>
  )
}
