import { useCallback, useState } from 'react'

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_SIZE = 50 * 1024 * 1024

interface ImageUploadProps {
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export default function ImageUpload({ onFileSelected, disabled }: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const validate = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Only PNG, JPEG, and WebP images are accepted.'
    if (file.size > MAX_SIZE) return 'File must be under 50MB.'
    if (file.size === 0) return 'File is empty.'
    return null
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      const err = validate(file)
      if (err) {
        setError(err)
        return
      }
      setError(null)
      setPreview(URL.createObjectURL(file))
      onFileSelected(file)
    },
    [validate, onFileSelected],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div className="space-y-3">
      <div
        data-testid="upload-dropzone"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center
          border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer
          ${dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-surface-border dark:border-surface-dark-border'}
          ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-brand-500/50'}
        `}
      >
        {preview ? (
          <img src={preview} alt="Selected" className="max-h-48 rounded object-contain" />
        ) : (
          <>
            <span className="text-3xl mb-2" aria-hidden>+</span>
            <p className="text-sm text-ink-secondary dark:text-ink-dark-secondary">
              Drop an image here or click to browse
            </p>
            <p className="text-xs text-ink-muted dark:text-ink-dark-muted mt-1">
              PNG, JPEG, WebP up to 50MB
            </p>
          </>
        )}
        <input
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleInputChange}
          disabled={disabled}
          className="absolute inset-0 opacity-0 cursor-pointer"
          aria-label="Upload image"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
