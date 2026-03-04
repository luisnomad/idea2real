import { describe, it, expectTypeOf } from 'vitest'
import type {
  UploadRequest,
  UploadResponse,
  CreateGenerationRequest,
  CreateGenerationResponse,
  GenerationDetailResponse,
  GenerationArtifact,
  ListGenerationsRequest,
  ListGenerationsResponse,
  ArtifactDownloadResponse,
  JobDetailResponse,
} from '../schemas/generation/index.js'

describe('P1 generation types compile correctly', () => {
  it('UploadRequest has fileName, mimeType, fileSizeBytes', () => {
    expectTypeOf<UploadRequest>().toHaveProperty('fileName')
    expectTypeOf<UploadRequest>().toHaveProperty('mimeType')
    expectTypeOf<UploadRequest>().toHaveProperty('fileSizeBytes')
  })

  it('UploadResponse has assetId, uploadUrl, expiresAt', () => {
    expectTypeOf<UploadResponse>().toHaveProperty('assetId')
    expectTypeOf<UploadResponse>().toHaveProperty('uploadUrl')
    expectTypeOf<UploadResponse>().toHaveProperty('expiresAt')
  })

  it('CreateGenerationRequest has imageAssetId and provider', () => {
    expectTypeOf<CreateGenerationRequest>().toHaveProperty('imageAssetId')
    expectTypeOf<CreateGenerationRequest>().toHaveProperty('provider')
  })

  it('CreateGenerationResponse has generationId, jobId, status', () => {
    expectTypeOf<CreateGenerationResponse>().toHaveProperty('generationId')
    expectTypeOf<CreateGenerationResponse>().toHaveProperty('jobId')
    expectTypeOf<CreateGenerationResponse>().toHaveProperty('status')
  })

  it('GenerationDetailResponse has artifacts array', () => {
    expectTypeOf<GenerationDetailResponse>().toHaveProperty('artifacts')
    expectTypeOf<GenerationDetailResponse['artifacts']>().toEqualTypeOf<GenerationArtifact[]>()
  })

  it('GenerationArtifact has downloadUrl', () => {
    expectTypeOf<GenerationArtifact>().toHaveProperty('downloadUrl')
    expectTypeOf<GenerationArtifact>().toHaveProperty('kind')
    expectTypeOf<GenerationArtifact>().toHaveProperty('fileSizeBytes')
  })

  it('ListGenerationsRequest has optional status filter', () => {
    expectTypeOf<ListGenerationsRequest>().toHaveProperty('limit')
  })

  it('ListGenerationsResponse has items and pagination', () => {
    expectTypeOf<ListGenerationsResponse>().toHaveProperty('items')
    expectTypeOf<ListGenerationsResponse>().toHaveProperty('pagination')
  })

  it('ArtifactDownloadResponse has downloadUrl and metadata', () => {
    expectTypeOf<ArtifactDownloadResponse>().toHaveProperty('downloadUrl')
    expectTypeOf<ArtifactDownloadResponse>().toHaveProperty('fileName')
    expectTypeOf<ArtifactDownloadResponse>().toHaveProperty('expiresAt')
  })

  it('JobDetailResponse has progress field', () => {
    expectTypeOf<JobDetailResponse>().toHaveProperty('progress')
  })
})
