import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { bodyLimitGuard, jsonOnlyGuard } from '../upload-validation.js'
import { requestId, type AppEnv } from '../../middleware/request-id.js'

function createTestApp() {
  const app = new Hono<AppEnv>()
  app.use('*', requestId)
  app.use('*', bodyLimitGuard)
  app.use('*', jsonOnlyGuard)
  app.post('/test', async (c) => {
    const body = await c.req.json()
    return c.json(body)
  })
  app.get('/test', (c) => c.json({ ok: true }))
  return app
}

describe('bodyLimitGuard', () => {
  it('allows requests within body size limit', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': '50',
      },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects oversized requests', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024), // 2MB
      },
      body: JSON.stringify({ data: 'x' }),
    })
    expect(res.status).toBe(413)
    const body = await res.json()
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE')
  })
})

describe('jsonOnlyGuard', () => {
  it('allows GET requests without Content-Type', async () => {
    const app = createTestApp()
    const res = await app.request('/test')
    expect(res.status).toBe(200)
  })

  it('allows POST with application/json', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    })
    expect(res.status).toBe(200)
  })

  it('rejects POST without json Content-Type', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    })
    expect(res.status).toBe(415)
    const body = await res.json()
    expect(body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE')
  })

  it('rejects POST with no Content-Type', async () => {
    const app = createTestApp()
    const res = await app.request('/test', {
      method: 'POST',
      body: 'data',
    })
    expect(res.status).toBe(415)
  })
})
