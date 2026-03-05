import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { createApp } from '../../../app.js'
import { assetStore, generationStore, jobStore } from '../store.js'

const OWNER_KEY = 'owner-key'
const OTHER_KEY = 'other-key'

function json(body: unknown, apiKey: string) {
  return new Request('http://localhost', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  })
}

describe('generation route ownership', () => {
  const originalApiKey = process.env['API_KEY']
  const originalApiKeys = process.env['API_KEYS']
  const originalNodeEnv = process.env['NODE_ENV']

  beforeEach(() => {
    process.env['NODE_ENV'] = 'test'
    delete process.env['API_KEY']
    process.env['API_KEYS'] = `${OWNER_KEY}:11111111-1111-4111-8111-111111111111,${OTHER_KEY}:22222222-2222-4222-8222-222222222222`
    assetStore.clear()
    generationStore.clear()
    jobStore.clear()
  })

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env['API_KEY']
    else process.env['API_KEY'] = originalApiKey
    if (originalApiKeys === undefined) delete process.env['API_KEYS']
    else process.env['API_KEYS'] = originalApiKeys
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = originalNodeEnv
  })

  it('isolates generation resources by authenticated user', async () => {
    const app = createApp()

    const uploadRes = await app.request('/api/uploads/presign', json({
      fileName: 'owner.png',
      mimeType: 'image/png',
      fileSizeBytes: 1234,
    }, OWNER_KEY))
    expect(uploadRes.status).toBe(200)
    const { assetId } = await uploadRes.json()

    const crossCreate = await app.request('/api/generations', json({
      imageAssetId: assetId,
      provider: 'hunyuan3d',
    }, OTHER_KEY))
    expect(crossCreate.status).toBe(404)

    const ownerCreate = await app.request('/api/generations', json({
      imageAssetId: assetId,
      provider: 'hunyuan3d',
    }, OWNER_KEY))
    expect(ownerCreate.status).toBe(201)
    const { generationId, jobId } = await ownerCreate.json()

    const crossGen = await app.request(`/api/generations/${generationId}`, {
      headers: { 'x-api-key': OTHER_KEY },
    })
    expect(crossGen.status).toBe(404)

    const crossJob = await app.request(`/api/jobs/${jobId}`, {
      headers: { 'x-api-key': OTHER_KEY },
    })
    expect(crossJob.status).toBe(404)

    const crossAsset = await app.request(`/api/assets/${assetId}/download`, {
      headers: { 'x-api-key': OTHER_KEY },
    })
    expect(crossAsset.status).toBe(404)

    const ownerList = await app.request('/api/generations', {
      headers: { 'x-api-key': OWNER_KEY },
    })
    const ownerBody = await ownerList.json()
    expect(ownerList.status).toBe(200)
    expect(ownerBody.items).toHaveLength(1)

    const otherList = await app.request('/api/generations', {
      headers: { 'x-api-key': OTHER_KEY },
    })
    const otherBody = await otherList.json()
    expect(otherList.status).toBe(200)
    expect(otherBody.items).toHaveLength(0)
  })
})
