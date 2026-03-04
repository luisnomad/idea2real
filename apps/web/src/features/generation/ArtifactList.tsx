import type { GenerationArtifact } from '@idea2real/contracts'

interface ArtifactListProps {
  artifacts: GenerationArtifact[]
  onViewModel?: (url: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const KIND_LABELS: Record<string, string> = {
  reference_image: 'Source Image',
  generated_image: 'Generated Image',
  model_source: 'Source Model (GLB)',
  model_cleaned: 'Cleaned Model',
  stl_export: 'STL Export',
}

export default function ArtifactList({ artifacts, onViewModel }: ArtifactListProps) {
  if (artifacts.length === 0) return null

  return (
    <div data-testid="artifact-list" className="space-y-2">
      <h3 className="text-sm font-semibold text-ink-secondary dark:text-ink-dark-secondary">
        Artifacts
      </h3>
      <ul className="divide-y divide-surface-border dark:divide-surface-dark-border">
        {artifacts.map((artifact) => {
          const isModel = artifact.kind === 'model_source' || artifact.kind === 'model_cleaned'
          return (
            <li key={artifact.id} className="flex items-center justify-between py-2 gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {KIND_LABELS[artifact.kind] ?? artifact.kind}
                </p>
                <p className="text-xs text-ink-muted dark:text-ink-dark-muted">
                  {formatBytes(artifact.fileSizeBytes)}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {isModel && onViewModel && (
                  <button
                    type="button"
                    onClick={() => onViewModel(artifact.downloadUrl)}
                    className="text-xs text-brand-500 hover:underline"
                  >
                    View
                  </button>
                )}
                <a
                  href={artifact.downloadUrl}
                  download
                  className="text-xs text-brand-500 hover:underline"
                >
                  Download
                </a>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
