import { describe, it, expect, beforeEach } from 'vitest'
import { createApp } from '../../../app.js'
import { assetStore, generationStore, jobStore } from '../store.js'

const app = createApp()

function json(body: unknown) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  assetStore.clear()
  generationStore.clear()
  jobStore.clear()
})

describe('POST /api/uploads/presign', () => {
  it('returns presigned URL for valid image upload', async () => {
    const res = await app.request('/api/uploads/presign', json({
      fileName: 'hero.png',
      mimeType: 'image/png',
      fileSizeBytes: 2048000,
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assetId).toBeDefined()
    expect(body.uploadUrl).toContain('http')
    expect(body.expiresAt).toBeDefined()

    // Asset should be stored
    const asset = assetStore.get(body.assetId)
    expect(asset).toBeDefined()
    expect(asset?.mimeType).toBe('image/png')
  })

  it('rejects invalid mime type', async () => {
    const res = await app.request('/api/uploads/presign', json({
      fileName: 'bad.exe',
      mimeType: 'application/x-executable',
      fileSizeBytes: 100,
    }))
    expect(res.status).toBe(400)
  })

  it('rejects oversized file', async () => {
    const res = await app.request('/api/uploads/presign', json({
      fileName: 'huge.png',
      mimeType: 'image/png',
      fileSizeBytes: 51 * 1024 * 1024,
    }))
    expect(res.status).toBe(400)
  })
})

describe('POST /api/generations', () => {
  it('creates a generation and returns job info', async () => {
    // First create an asset
    const uploadRes = await app.request('/api/uploads/presign', json({
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSizeBytes: 1000,
    }))
    const { assetId } = await uploadRes.json()

    // Create generation
    const res = await app.request('/api/generations', json({
      imageAssetId: assetId,
      provider: 'hunyuan3d',
    }))

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.generationId).toBeDefined()
    expect(body.jobId).toBeDefined()
    expect(body.status).toBe('queued')

    // Verify stores
    const gen = generationStore.get(body.generationId)
    expect(gen).toBeDefined()
    expect(gen?.status).toBe('queued')

    const job = jobStore.get(body.jobId)
    expect(job).toBeDefined()
    expect(job?.type).toBe('model_generation')
  })
})

describe('GET /api/generations/:id', () => {
  it('returns generation detail', async () => {
    // Setup
    const uploadRes = await app.request('/api/uploads/presign', json({
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSizeBytes: 1000,
    }))
    const { assetId } = await uploadRes.json()
    const genRes = await app.request('/api/generations', json({
      imageAssetId: assetId,
      provider: 'hunyuan3d',
    }))
    const { generationId } = await genRes.json()

    // Get detail
    const res = await app.request(`/api/generations/${generationId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(generationId)
    expect(body.status).toBe('queued')
    expect(body.artifacts).toEqual([])
  })

  it('returns 404 for unknown generation', async () => {
    const res = await app.request('/api/generations/550e8400-e29b-41d4-a716-446655440000')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/jobs/:id', () => {
  it('returns job detail', async () => {
    const uploadRes = await app.request('/api/uploads/presign', json({
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSizeBytes: 1000,
    }))
    const { assetId } = await uploadRes.json()
    const genRes = await app.request('/api/generations', json({
      imageAssetId: assetId,
      provider: 'hunyuan3d',
    }))
    const { jobId } = await genRes.json()

    const res = await app.request(`/api/jobs/${jobId}`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(jobId)
    expect(body.type).toBe('model_generation')
    expect(body.status).toBe('queued')
  })

  it('returns 404 for unknown job', async () => {
    const res = await app.request('/api/jobs/550e8400-e29b-41d4-a716-446655440000')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/generations', () => {
  it('returns empty list initially', async () => {
    const res = await app.request('/api/generations')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toEqual([])
    expect(body.pagination.hasMore).toBe(false)
  })

  it('lists created generations', async () => {
    const uploadRes = await app.request('/api/uploads/presign', json({
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSizeBytes: 1000,
    }))
    const { assetId } = await uploadRes.json()
    await app.request('/api/generations', json({
      imageAssetId: assetId,
      provider: 'hunyuan3d',
    }))

    const res = await app.request('/api/generations')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
  })
})

describe('GET /api/assets/:id/download', () => {
  it('returns download URL for known asset', async () => {
    const uploadRes = await app.request('/api/uploads/presign', json({
      fileName: 'test.png',
      mimeType: 'image/png',
      fileSizeBytes: 1000,
    }))
    const { assetId } = await uploadRes.json()

    const res = await app.request(`/api/assets/${assetId}/download`)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.assetId).toBe(assetId)
    expect(body.downloadUrl).toContain('http')
    expect(body.mimeType).toBe('image/png')
  })

  it('returns 404 for unknown asset', async () => {
    const res = await app.request('/api/assets/550e8400-e29b-41d4-a716-446655440000/download')
    expect(res.status).toBe(404)
  })
})
