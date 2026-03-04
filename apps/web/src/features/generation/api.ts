import { apiFetch } from '../../lib/api-client'
import type {
  UploadRequest,
  UploadResponse,
  CreateGenerationRequest,
  CreateGenerationResponse,
  GenerationDetailResponse,
  JobDetailResponse,
  ArtifactDownloadResponse,
} from '@idea2real/contracts'

export function requestUploadUrl(req: UploadRequest) {
  return apiFetch<UploadResponse>('/api/uploads/presign', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function uploadFile(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
}

export function createGeneration(req: CreateGenerationRequest) {
  return apiFetch<CreateGenerationResponse>('/api/generations', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export function getGeneration(id: string) {
  return apiFetch<GenerationDetailResponse>(`/api/generations/${id}`)
}

export function getJob(id: string) {
  return apiFetch<JobDetailResponse>(`/api/jobs/${id}`)
}

export function getArtifactDownload(assetId: string) {
  return apiFetch<ArtifactDownloadResponse>(`/api/assets/${assetId}/download`)
}
