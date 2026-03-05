import { describe, it, expect } from 'vitest'
import { createApp } from '../app.js'

describe('GET /health', () => {
  it('returns 200 with status ok and a version string', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.version).toBe('string')
  })

  it('includes X-Request-ID header in response', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })

  it('echoes a provided X-Request-ID', async () => {
    const app = createApp()
    const res = await app.request('/health', {
      headers: { 'x-request-id': 'test-id-123' },
    })
    expect(res.headers.get('x-request-id')).toBe('test-id-123')
  })

  it('exposes OpenAPI spec at /docs', async () => {
    const originalNodeEnv = process.env['NODE_ENV']
    const originalExpose = process.env['EXPOSE_API_DOCS']
    try {
      process.env['NODE_ENV'] = 'test'
      delete process.env['EXPOSE_API_DOCS']
      const app = createApp()
      const res = await app.request('/docs')
      expect(res.status).toBe(200)
      const spec = await res.json()
      expect(spec.openapi).toBe('3.0.0')
      expect(spec.info.title).toBeTruthy()
    } finally {
      if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = originalNodeEnv
      if (originalExpose === undefined) delete process.env['EXPOSE_API_DOCS']
      else process.env['EXPOSE_API_DOCS'] = originalExpose
    }
  })

  it('hides docs in production by default', async () => {
    const originalNodeEnv = process.env['NODE_ENV']
    const originalExpose = process.env['EXPOSE_API_DOCS']
    try {
      process.env['NODE_ENV'] = 'production'
      delete process.env['EXPOSE_API_DOCS']

      const app = createApp()
      const docsRes = await app.request('/docs')
      const uiRes = await app.request('/ui')
      expect(docsRes.status).toBe(404)
      expect(uiRes.status).toBe(404)
    } finally {
      if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = originalNodeEnv
      if (originalExpose === undefined) delete process.env['EXPOSE_API_DOCS']
      else process.env['EXPOSE_API_DOCS'] = originalExpose
    }
  })

  it('allows docs in production when explicitly enabled', async () => {
    const originalNodeEnv = process.env['NODE_ENV']
    const originalExpose = process.env['EXPOSE_API_DOCS']
    try {
      process.env['NODE_ENV'] = 'production'
      process.env['EXPOSE_API_DOCS'] = 'true'

      const app = createApp()
      const docsRes = await app.request('/docs')
      expect(docsRes.status).toBe(200)
    } finally {
      if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = originalNodeEnv
      if (originalExpose === undefined) delete process.env['EXPOSE_API_DOCS']
      else process.env['EXPOSE_API_DOCS'] = originalExpose
    }
  })
})

describe('global error handlers', () => {
  it('returns ErrorEnvelope shape on unknown routes (404)', async () => {
    const app = createApp()
    const res = await app.request('/unknown-route')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(typeof body.error.message).toBe('string')
  })

  it('includes requestId in 404 ErrorEnvelope', async () => {
    const app = createApp()
    const res = await app.request('/unknown-route', {
      headers: { 'x-request-id': 'req-404-test' },
    })
    const body = await res.json()
    expect(body.error.requestId).toBe('req-404-test')
  })
})
