import { useState, useCallback, useEffect } from 'react'
import {
  ImageUpload,
  JobStatus,
  ArtifactList,
  useGenerationDetail,
  useJobDetail,
  requestUploadUrl,
  uploadFile,
  createGeneration,
} from '../features/generation'
import { ModelViewer } from '../features/viewer'

type FlowStep = 'upload' | 'generating' | 'done' | 'error'

export default function Create() {
  const [step, setStep] = useState<FlowStep>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [generationId, setGenerationId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [viewerUrl, setViewerUrl] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const generation = useGenerationDetail(generationId)
  const job = useJobDetail(jobId)

  useEffect(() => {
    if (step !== 'generating') return
    if (generation.data?.status === 'succeeded') {
      setStep('done')
    }
    if (generation.data?.status === 'failed') {
      setStep('error')
      setErrorMsg(generation.data.errorMessage ?? 'Generation failed')
    }
  }, [generation.data?.errorMessage, generation.data?.status, step])

  const handleGenerate = useCallback(async () => {
    if (!file) return
    setErrorMsg(null)
    setUploading(true)

    try {
      // 1. Get presigned URL
      const upload = await requestUploadUrl({
        fileName: file.name,
        mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        fileSizeBytes: file.size,
      })

      // 2. Upload to S3
      await uploadFile(upload.uploadUrl, file)

      // 3. Create generation
      const gen = await createGeneration({
        imageAssetId: upload.assetId,
        provider: 'hunyuan3d',
      })

      setGenerationId(gen.generationId)
      setJobId(gen.jobId)
      setStep('generating')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed')
      setStep('error')
    } finally {
      setUploading(false)
    }
  }, [file])

  const handleRetry = useCallback(() => {
    setStep('upload')
    setGenerationId(null)
    setJobId(null)
    setViewerUrl(null)
    setErrorMsg(null)
  }, [])

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create</h1>
        <p className="mt-1 text-sm text-ink-secondary dark:text-ink-dark-secondary">
          Upload an image and generate a 3D-printable model.
        </p>
      </div>

      {/* Step 1: Upload */}
      <ImageUpload
        onFileSelected={setFile}
        disabled={step !== 'upload' && step !== 'error'}
      />

      {/* Generate button */}
      {(step === 'upload' || step === 'error') && file && (
        <button
          type="button"
          onClick={handleGenerate}
          disabled={uploading}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-600 disabled:opacity-50 transition-colors"
        >
          {uploading ? 'Uploading...' : 'Generate 3D Model'}
        </button>
      )}

      {/* Error */}
      {step === 'error' && errorMsg && (
        <p role="alert" className="text-sm text-red-500">{errorMsg}</p>
      )}

      {/* Step 2: Job progress */}
      {(step === 'generating' || step === 'done') && (
        <JobStatus
          job={job.data}
          isLoading={job.isLoading}
          error={job.error}
          onRetry={handleRetry}
        />
      )}

      {/* Step 3: Results */}
      {step === 'done' && generation.data && (
        <>
          <ModelViewer url={viewerUrl} />
          <ArtifactList
            artifacts={generation.data.artifacts}
            onViewModel={setViewerUrl}
          />
        </>
      )}
    </div>
  )
}
