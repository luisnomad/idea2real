import { describe, it, expect } from 'vitest'
import {
  ErrorEnvelopeSchema,
  HealthResponseSchema,
  UserSchema,
  PromptSchema,
  GenerationSchema,
  ModelSchema,
  AssetSchema,
  JobSchema,
  CleanupRequestSchema,
  CleanupResponseSchema,
  CleanupResultSchema,
  PaginationRequestSchema,
  PaginationMetaSchema,
} from '../index.js'

const validUuid = '550e8400-e29b-41d4-a716-446655440000'
const validTimestamps = {
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

describe('ErrorEnvelopeSchema', () => {
  it('accepts a valid error envelope', () => {
    const result = ErrorEnvelopeSchema.parse({
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    })
    expect(result.error.code).toBe('NOT_FOUND')
  })

  it('accepts error with requestId', () => {
    const result = ErrorEnvelopeSchema.parse({
      error: { code: 'ERR', message: 'fail', requestId: 'req-123' },
    })
    expect(result.error.requestId).toBe('req-123')
  })

  it('rejects missing error.code', () => {
    expect(() =>
      ErrorEnvelopeSchema.parse({ error: { message: 'fail' } })
    ).toThrow()
  })
})

describe('HealthResponseSchema', () => {
  it('accepts a valid health response', () => {
    const result = HealthResponseSchema.parse({ status: 'ok', version: '1.0.0' })
    expect(result.status).toBe('ok')
  })

  it('rejects status other than ok', () => {
    expect(() =>
      HealthResponseSchema.parse({ status: 'degraded', version: '1.0.0' })
    ).toThrow()
  })
})

describe('UserSchema', () => {
  it('accepts a valid user', () => {
    const result = UserSchema.parse({
      id: validUuid,
      email: 'test@example.com',
      displayName: 'Test User',
      ...validTimestamps,
    })
    expect(result.email).toBe('test@example.com')
  })

  it('rejects invalid email', () => {
    expect(() =>
      UserSchema.parse({
        id: validUuid,
        email: 'not-an-email',
        displayName: 'Test',
        ...validTimestamps,
      })
    ).toThrow()
  })

  it('rejects empty displayName', () => {
    expect(() =>
      UserSchema.parse({
        id: validUuid,
        email: 'test@example.com',
        displayName: '',
        ...validTimestamps,
      })
    ).toThrow()
  })
})

describe('PromptSchema', () => {
  it('accepts a valid prompt', () => {
    const result = PromptSchema.parse({
      id: validUuid,
      userId: validUuid,
      text: 'A 1:32 scale DeLorean',
      printTech: 'fdm',
      ...validTimestamps,
    })
    expect(result.printTech).toBe('fdm')
  })

  it('rejects invalid printTech', () => {
    expect(() =>
      PromptSchema.parse({
        id: validUuid,
        userId: validUuid,
        text: 'test',
        printTech: 'laser',
        ...validTimestamps,
      })
    ).toThrow()
  })

  it('allows optional negativePrompt', () => {
    const result = PromptSchema.parse({
      id: validUuid,
      userId: validUuid,
      text: 'test',
      printTech: 'resin',
      negativePrompt: 'blurry, low quality',
      ...validTimestamps,
    })
    expect(result.negativePrompt).toBe('blurry, low quality')
  })
})

describe('GenerationSchema', () => {
  it('accepts valid generation with all statuses', () => {
    for (const status of ['queued', 'processing', 'succeeded', 'failed'] as const) {
      const result = GenerationSchema.parse({
        id: validUuid,
        promptId: validUuid,
        userId: validUuid,
        status,
        provider: 'hunyuan3d',
        ...validTimestamps,
      })
      expect(result.status).toBe(status)
    }
  })

  it('accepts optional providerJobId and errorMessage', () => {
    const result = GenerationSchema.parse({
      id: validUuid,
      promptId: validUuid,
      userId: validUuid,
      status: 'failed',
      provider: 'hunyuan3d',
      providerJobId: 'job_abc',
      errorMessage: 'Timeout',
      ...validTimestamps,
    })
    expect(result.errorMessage).toBe('Timeout')
  })
})

describe('ModelSchema', () => {
  it('accepts a valid model', () => {
    const result = ModelSchema.parse({
      id: validUuid,
      generationId: validUuid,
      userId: validUuid,
      format: 'glb',
      storageKey: 'models/abc.glb',
      fileSizeBytes: 1024000,
      ...validTimestamps,
    })
    expect(result.format).toBe('glb')
  })

  it('rejects negative fileSizeBytes', () => {
    expect(() =>
      ModelSchema.parse({
        id: validUuid,
        generationId: validUuid,
        userId: validUuid,
        format: 'stl',
        storageKey: 'models/abc.stl',
        fileSizeBytes: -1,
        ...validTimestamps,
      })
    ).toThrow()
  })
})

describe('AssetSchema', () => {
  it('accepts all asset kinds', () => {
    for (const kind of [
      'reference_image',
      'generated_image',
      'model_source',
      'model_cleaned',
      'stl_export',
    ] as const) {
      const result = AssetSchema.parse({
        id: validUuid,
        userId: validUuid,
        kind,
        mimeType: 'application/octet-stream',
        storageKey: `assets/${kind}`,
        fileSizeBytes: 100,
        ...validTimestamps,
      })
      expect(result.kind).toBe(kind)
    }
  })

  it('allows optional parentId', () => {
    const result = AssetSchema.parse({
      id: validUuid,
      userId: validUuid,
      kind: 'model_cleaned',
      mimeType: 'model/gltf-binary',
      storageKey: 'assets/cleaned.glb',
      fileSizeBytes: 500,
      parentId: validUuid,
      ...validTimestamps,
    })
    expect(result.parentId).toBe(validUuid)
  })
})

describe('JobSchema', () => {
  it('accepts a valid job', () => {
    const result = JobSchema.parse({
      id: validUuid,
      userId: validUuid,
      type: 'geometry_cleanup',
      status: 'queued',
      payload: { modelId: validUuid, operations: ['remove_doubles'] },
      ...validTimestamps,
    })
    expect(result.type).toBe('geometry_cleanup')
  })

  it('accepts all job statuses', () => {
    for (const status of ['queued', 'processing', 'succeeded', 'failed', 'cancelled'] as const) {
      expect(() =>
        JobSchema.parse({
          id: validUuid,
          userId: validUuid,
          type: 'stl_export',
          status,
          payload: {},
          ...validTimestamps,
        })
      ).not.toThrow()
    }
  })

  it('accepts optional timing fields', () => {
    const result = JobSchema.parse({
      id: validUuid,
      userId: validUuid,
      type: 'model_generation',
      status: 'succeeded',
      payload: {},
      result: { outputKey: 'models/out.glb' },
      startedAt: '2024-01-01T00:00:00.000Z',
      completedAt: '2024-01-01T00:01:00.000Z',
      ...validTimestamps,
    })
    expect(result.startedAt).toBeDefined()
    expect(result.completedAt).toBeDefined()
  })
})

describe('CleanupRequestSchema', () => {
  it('accepts a valid cleanup request', () => {
    const result = CleanupRequestSchema.parse({
      modelId: validUuid,
      operations: ['remove_doubles', 'voxel_remesh', 'decimate'],
      params: { voxelSize: 5, targetFaces: 50000 },
    })
    expect(result.operations).toHaveLength(3)
  })

  it('rejects empty operations array', () => {
    expect(() =>
      CleanupRequestSchema.parse({
        modelId: validUuid,
        operations: [],
      })
    ).toThrow()
  })

  it('rejects invalid operation name', () => {
    expect(() =>
      CleanupRequestSchema.parse({
        modelId: validUuid,
        operations: ['magic_smooth'],
      })
    ).toThrow()
  })
})

describe('CleanupResponseSchema', () => {
  it('accepts a valid cleanup response', () => {
    const result = CleanupResponseSchema.parse({
      jobId: validUuid,
      status: 'accepted',
    })
    expect(result.status).toBe('accepted')
  })
})

describe('CleanupResultSchema', () => {
  it('accepts a valid cleanup result', () => {
    const result = CleanupResultSchema.parse({
      jobId: validUuid,
      modelId: validUuid,
      outputStorageKey: 'models/cleaned.glb',
      vertexCount: 12000,
      faceCount: 24000,
      isManifold: true,
      isWatertight: true,
    })
    expect(result.isWatertight).toBe(true)
  })
})

describe('PaginationRequestSchema', () => {
  it('applies default limit', () => {
    const result = PaginationRequestSchema.parse({})
    expect(result.limit).toBe(20)
  })

  it('rejects limit over 100', () => {
    expect(() => PaginationRequestSchema.parse({ limit: 200 })).toThrow()
  })
})

describe('PaginationMetaSchema', () => {
  it('accepts valid pagination meta', () => {
    const result = PaginationMetaSchema.parse({
      nextCursor: 'abc123',
      hasMore: true,
    })
    expect(result.hasMore).toBe(true)
  })

  it('accepts null nextCursor', () => {
    const result = PaginationMetaSchema.parse({
      nextCursor: null,
      hasMore: false,
    })
    expect(result.nextCursor).toBeNull()
  })
})
