import { OpenAPIHono } from '@hono/zod-openapi'
import { createRoute, z } from '@hono/zod-openapi'
import type { AppEnv } from '../../middleware/request-id.js'
import {
  UploadRequestSchema,
  UploadResponseSchema,
  CreateGenerationRequestSchema,
  CreateGenerationResponseSchema,
  GenerationDetailResponseSchema,
  JobDetailResponseSchema,
  ArtifactDownloadResponseSchema,
  ListGenerationsResponseSchema,
} from '@idea2real/contracts'
import { assetStore, generationStore, jobStore } from './store.js'
import type { StorageAdapter } from '../../adapters/storage/index.js'
import type { FalAdapter } from '../../adapters/fal/index.js'

// --- Route definitions ---

const presignRoute = createRoute({
  method: 'post',
  path: '/api/uploads/presign',
  tags: ['Uploads'],
  summary: 'Get presigned upload URL',
  request: {
    body: { content: { 'application/json': { schema: UploadRequestSchema } } },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UploadResponseSchema } },
      description: 'Presigned URL created',
    },
  },
})

const createGenerationRoute = createRoute({
  method: 'post',
  path: '/api/generations',
  tags: ['Generations'],
  summary: 'Create a generation job',
  request: {
    body: { content: { 'application/json': { schema: CreateGenerationRequestSchema } } },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: CreateGenerationResponseSchema } },
      description: 'Generation created',
    },
  },
})

const getGenerationRoute = createRoute({
  method: 'get',
  path: '/api/generations/{id}',
  tags: ['Generations'],
  summary: 'Get generation detail',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: GenerationDetailResponseSchema } },
      description: 'Generation found',
    },
    404: {
      content: { 'application/json': { schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }) } },
      description: 'Not found',
    },
  },
})

const listGenerationsRoute = createRoute({
  method: 'get',
  path: '/api/generations',
  tags: ['Generations'],
  summary: 'List generations',
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      status: z.enum(['queued', 'processing', 'succeeded', 'failed']).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ListGenerationsResponseSchema } },
      description: 'Generations list',
    },
  },
})

const getJobRoute = createRoute({
  method: 'get',
  path: '/api/jobs/{id}',
  tags: ['Jobs'],
  summary: 'Get job detail',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: JobDetailResponseSchema } },
      description: 'Job found',
    },
    404: {
      content: { 'application/json': { schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }) } },
      description: 'Not found',
    },
  },
})

const downloadRoute = createRoute({
  method: 'get',
  path: '/api/assets/{id}/download',
  tags: ['Assets'],
  summary: 'Get artifact download URL',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ArtifactDownloadResponseSchema } },
      description: 'Download URL generated',
    },
    404: {
      content: { 'application/json': { schema: z.object({ error: z.object({ code: z.string(), message: z.string() }) }) } },
      description: 'Not found',
    },
  },
})

// --- Handler factory ---

export function createGenerationModule(
  storage: StorageAdapter,
  fal: FalAdapter,
) {
  const router = new OpenAPIHono<AppEnv>()

  // POST /api/uploads/presign
  router.openapi(presignRoute, async (c) => {
    const body = c.req.valid('json')
    const assetId = crypto.randomUUID()
    const storageKey = `uploads/${assetId}/${body.fileName}`

    const presigned = await storage.createPresignedUploadUrl(storageKey, body.mimeType)

    const now = new Date().toISOString()
    assetStore.set(assetId, {
      id: assetId,
      userId: 'stub-user',
      kind: 'reference_image',
      mimeType: body.mimeType,
      storageKey: presigned.storageKey,
      fileSizeBytes: body.fileSizeBytes,
      createdAt: now,
      updatedAt: now,
    })

    return c.json({
      assetId,
      uploadUrl: presigned.uploadUrl,
      expiresAt: presigned.expiresAt,
    }, 200)
  })

  // POST /api/generations
  router.openapi(createGenerationRoute, async (c) => {
    const body = c.req.valid('json')
    const generationId = crypto.randomUUID()
    const jobId = crypto.randomUUID()
    const now = new Date().toISOString()

    // Get the image asset to pass URL to fal
    const asset = assetStore.get(body.imageAssetId)
    const imageUrl = asset
      ? await storage.getDownloadUrl(asset.storageKey)
      : ''

    // Submit to fal.ai
    const submission = await fal.submitImageTo3D(imageUrl)

    generationStore.set(generationId, {
      id: generationId,
      promptId: crypto.randomUUID(),
      userId: 'stub-user',
      status: 'queued',
      provider: body.provider,
      providerJobId: submission.providerJobId,
      createdAt: now,
      updatedAt: now,
      artifacts: [],
    })

    jobStore.set(jobId, {
      id: jobId,
      userId: 'stub-user',
      type: 'model_generation',
      status: 'queued',
      payload: { generationId, imageAssetId: body.imageAssetId, providerJobId: submission.providerJobId },
      createdAt: now,
      updatedAt: now,
    })

    return c.json({
      generationId,
      jobId,
      status: 'queued' as const,
    }, 201)
  })

  // GET /api/generations/:id
  router.openapi(getGenerationRoute, async (c) => {
    const { id } = c.req.valid('param')
    const gen = generationStore.get(id)
    if (!gen) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Generation not found' } }, 404)
    }

    // Resolve artifact details
    const artifacts = await Promise.all(
      gen.artifacts.map(async (assetId) => {
        const asset = assetStore.get(assetId)
        if (!asset) return null
        const downloadUrl = await storage.getDownloadUrl(asset.storageKey)
        return {
          id: asset.id,
          kind: asset.kind,
          mimeType: asset.mimeType,
          storageKey: asset.storageKey,
          fileSizeBytes: asset.fileSizeBytes,
          downloadUrl,
        }
      })
    )

    return c.json({
      ...gen,
      artifacts: artifacts.filter(Boolean) as NonNullable<(typeof artifacts)[number]>[],
    }, 200)
  })

  // GET /api/generations
  router.openapi(listGenerationsRoute, async (c) => {
    const { limit, status } = c.req.valid('query')
    let items = generationStore.list()
    if (status) items = items.filter((g) => g.status === status)
    items = items.slice(0, limit)

    return c.json({
      items: items.map(({ artifacts: _a, ...rest }) => rest),
      pagination: { nextCursor: null, hasMore: false },
    }, 200)
  })

  // GET /api/jobs/:id
  router.openapi(getJobRoute, async (c) => {
    const { id } = c.req.valid('param')
    const job = jobStore.get(id)
    if (!job) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Job not found' } }, 404)
    }
    return c.json(job, 200)
  })

  // GET /api/assets/:id/download
  router.openapi(downloadRoute, async (c) => {
    const { id } = c.req.valid('param')
    const asset = assetStore.get(id)
    if (!asset) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Asset not found' } }, 404)
    }

    const downloadUrl = await storage.getDownloadUrl(asset.storageKey)
    return c.json({
      assetId: asset.id,
      downloadUrl,
      fileName: asset.storageKey.split('/').pop() ?? 'download',
      mimeType: asset.mimeType,
      fileSizeBytes: asset.fileSizeBytes,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    }, 200)
  })

  return router
}
