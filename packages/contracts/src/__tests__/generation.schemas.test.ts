import { describe, it, expect } from 'vitest'
import {
  UploadRequestSchema,
  UploadResponseSchema,
  CreateGenerationRequestSchema,
  CreateGenerationResponseSchema,
  GenerationDetailResponseSchema,
  ListGenerationsRequestSchema,
  ListGenerationsResponseSchema,
  ArtifactDownloadResponseSchema,
  JobDetailResponseSchema,
} from '../schemas/generation/index.js'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validTimestamps = {
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

describe('UploadRequestSchema', () => {
  it('accepts a valid upload request', () => {
    const result = UploadRequestSchema.parse({
      fileName: 'hero.png',
      mimeType: 'image/png',
      fileSizeBytes: 2048000,
    })
    expect(result.fileName).toBe('hero.png')
  })

  it('rejects unsupported mime types', () => {
    expect(() =>
      UploadRequestSchema.parse({
        fileName: 'file.exe',
        mimeType: 'application/x-executable',
        fileSizeBytes: 100,
      })
    ).toThrow()
  })

  it('rejects files over 50MB', () => {
    expect(() =>
      UploadRequestSchema.parse({
        fileName: 'huge.png',
        mimeType: 'image/png',
        fileSizeBytes: 51 * 1024 * 1024,
      })
    ).toThrow()
  })

  it('rejects zero-byte files', () => {
    expect(() =>
      UploadRequestSchema.parse({
        fileName: 'empty.png',
        mimeType: 'image/png',
        fileSizeBytes: 0,
      })
    ).toThrow()
  })
})

describe('UploadResponseSchema', () => {
  it('accepts a valid upload response', () => {
    const result = UploadResponseSchema.parse({
      assetId: validUuid,
      uploadUrl: 'https://s3.example.com/presigned?token=abc',
      expiresAt: '2024-01-01T01:00:00.000Z',
    })
    expect(result.assetId).toBe(validUuid)
    expect(result.uploadUrl).toContain('https://')
  })
})

describe('CreateGenerationRequestSchema', () => {
  it('accepts a valid generation request with image asset', () => {
    const result = CreateGenerationRequestSchema.parse({
      imageAssetId: validUuid,
      provider: 'hunyuan3d',
    })
    expect(result.provider).toBe('hunyuan3d')
  })

  it('accepts optional params', () => {
    const result = CreateGenerationRequestSchema.parse({
      imageAssetId: validUuid,
      provider: 'hunyuan3d',
      params: { quality: 'detail' },
    })
    expect(result.params).toBeDefined()
  })

  it('rejects missing imageAssetId', () => {
    expect(() =>
      CreateGenerationRequestSchema.parse({ provider: 'hunyuan3d' })
    ).toThrow()
  })
})

describe('CreateGenerationResponseSchema', () => {
  it('accepts a valid generation response', () => {
    const result = CreateGenerationResponseSchema.parse({
      generationId: validUuid,
      jobId: validUuid,
      status: 'queued',
    })
    expect(result.status).toBe('queued')
  })
})

describe('GenerationDetailResponseSchema', () => {
  it('accepts a full generation detail', () => {
    const result = GenerationDetailResponseSchema.parse({
      id: validUuid,
      promptId: validUuid,
      userId: validUuid,
      status: 'succeeded',
      provider: 'hunyuan3d',
      ...validTimestamps,
      artifacts: [
        {
          id: validUuid,
          kind: 'model_source',
          mimeType: 'model/gltf-binary',
          storageKey: 'models/abc.glb',
          fileSizeBytes: 1024,
          downloadUrl: 'https://s3.example.com/models/abc.glb?token=xyz',
        },
      ],
    })
    expect(result.artifacts).toHaveLength(1)
  })

  it('accepts generation with no artifacts (still processing)', () => {
    const result = GenerationDetailResponseSchema.parse({
      id: validUuid,
      promptId: validUuid,
      userId: validUuid,
      status: 'processing',
      provider: 'hunyuan3d',
      ...validTimestamps,
      artifacts: [],
    })
    expect(result.artifacts).toHaveLength(0)
  })

  it('includes error info on failed generations', () => {
    const result = GenerationDetailResponseSchema.parse({
      id: validUuid,
      promptId: validUuid,
      userId: validUuid,
      status: 'failed',
      provider: 'hunyuan3d',
      errorMessage: 'Provider timeout',
      ...validTimestamps,
      artifacts: [],
    })
    expect(result.errorMessage).toBe('Provider timeout')
  })
})

describe('ListGenerationsRequestSchema', () => {
  it('applies defaults', () => {
    const result = ListGenerationsRequestSchema.parse({})
    expect(result.limit).toBe(20)
  })

  it('accepts status filter', () => {
    const result = ListGenerationsRequestSchema.parse({
      status: 'succeeded',
    })
    expect(result.status).toBe('succeeded')
  })

  it('rejects limit over 100', () => {
    expect(() => ListGenerationsRequestSchema.parse({ limit: 200 })).toThrow()
  })
})

describe('ListGenerationsResponseSchema', () => {
  it('accepts a valid paginated list', () => {
    const result = ListGenerationsResponseSchema.parse({
      items: [
        {
          id: validUuid,
          promptId: validUuid,
          userId: validUuid,
          status: 'succeeded',
          provider: 'hunyuan3d',
          ...validTimestamps,
        },
      ],
      pagination: {
        nextCursor: null,
        hasMore: false,
      },
    })
    expect(result.items).toHaveLength(1)
    expect(result.pagination.hasMore).toBe(false)
  })
})

describe('ArtifactDownloadResponseSchema', () => {
  it('accepts a valid download response', () => {
    const result = ArtifactDownloadResponseSchema.parse({
      assetId: validUuid,
      downloadUrl: 'https://s3.example.com/assets/abc.stl?token=xyz',
      fileName: 'model.stl',
      mimeType: 'model/stl',
      fileSizeBytes: 512000,
      expiresAt: '2024-01-01T01:00:00.000Z',
    })
    expect(result.downloadUrl).toContain('https://')
  })
})

describe('JobDetailResponseSchema', () => {
  it('accepts a job with typed generation result', () => {
    const result = JobDetailResponseSchema.parse({
      id: validUuid,
      userId: validUuid,
      type: 'model_generation',
      status: 'succeeded',
      payload: { imageAssetId: validUuid },
      result: { modelAssetId: validUuid, format: 'glb' },
      ...validTimestamps,
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
    })
    expect(result.type).toBe('model_generation')
  })

  it('accepts a queued job with no result', () => {
    const result = JobDetailResponseSchema.parse({
      id: validUuid,
      userId: validUuid,
      type: 'geometry_cleanup',
      status: 'queued',
      payload: { modelId: validUuid, operations: ['remove_doubles'] },
      ...validTimestamps,
    })
    expect(result.result).toBeUndefined()
  })

  it('includes progress percentage when processing', () => {
    const result = JobDetailResponseSchema.parse({
      id: validUuid,
      userId: validUuid,
      type: 'model_generation',
      status: 'processing',
      payload: {},
      progress: 45,
      ...validTimestamps,
      startedAt: '2024-01-01T00:00:00.000Z',
    })
    expect(result.progress).toBe(45)
  })
})
