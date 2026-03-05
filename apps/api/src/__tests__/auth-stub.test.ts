import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp } from '../app.js'

describe('auth middleware stub', () => {
  const originalApiKey = process.env['API_KEY']
  const originalApiKeys = process.env['API_KEYS']
  const originalApiKeyUserId = process.env['API_KEY_USER_ID']
  const originalNodeEnv = process.env['NODE_ENV']

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env['API_KEY']
    else process.env['API_KEY'] = originalApiKey
    if (originalApiKeys === undefined) delete process.env['API_KEYS']
    else process.env['API_KEYS'] = originalApiKeys
    if (originalApiKeyUserId === undefined) delete process.env['API_KEY_USER_ID']
    else process.env['API_KEY_USER_ID'] = originalApiKeyUserId
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV']
    else process.env['NODE_ENV'] = originalNodeEnv
  })

  describe('when API_KEY env var is not set (dev/test mode)', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'test'
      delete process.env['API_KEY']
      delete process.env['API_KEYS']
    })

    it('passes through requests to public endpoints', async () => {
      const app = createApp()
      const res = await app.request('/health')
      expect(res.status).toBe(200)
    })

    it('passes through /api/* without any key', async () => {
      const app = createApp()
      // No route at /api/test, but auth should pass (404 not 401)
      const res = await app.request('/api/test')
      expect(res.status).not.toBe(401)
    })
  })

  describe('when API_KEY env var is set', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'test'
      process.env['API_KEY'] = 'secret-test-key'
      delete process.env['API_KEYS']
    })

    afterEach(() => {
      delete process.env['API_KEY']
    })

    it('does not protect the /health endpoint', async () => {
      const app = createApp()
      const res = await app.request('/health')
      expect(res.status).toBe(200)
    })

    it('rejects /api/* with no API key header', async () => {
      const app = createApp()
      const res = await app.request('/api/whatever')
      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error.code).toBe('UNAUTHORIZED')
      expect(typeof body.error.message).toBe('string')
    })

    it('rejects /api/* with wrong API key', async () => {
      const app = createApp()
      const res = await app.request('/api/whatever', {
        headers: { 'x-api-key': 'wrong-key' },
      })
      expect(res.status).toBe(401)
    })

    it('allows /api/* with correct API key (resolves to 404, not 401)', async () => {
      const app = createApp()
      const res = await app.request('/api/whatever', {
        headers: { 'x-api-key': 'secret-test-key' },
      })
      expect(res.status).not.toBe(401)
    })
  })

  describe('when auth is not configured in production', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'production'
      delete process.env['API_KEY']
      delete process.env['API_KEYS']
    })

    it('fails closed with 503 on /api/* routes', async () => {
      const app = createApp()
      const res = await app.request('/api/whatever')
      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error.code).toBe('AUTH_NOT_CONFIGURED')
    })
  })

  describe('when API_KEYS mapping is configured', () => {
    beforeEach(() => {
      process.env['NODE_ENV'] = 'test'
      delete process.env['API_KEY']
      process.env['API_KEYS'] = 'owner-key:11111111-1111-4111-8111-111111111111,viewer-key:22222222-2222-4222-8222-222222222222'
    })

    it('accepts any configured key and rejects unknown keys', async () => {
      const app = createApp()

      const ok = await app.request('/api/whatever', {
        headers: { 'x-api-key': 'owner-key' },
      })
      expect(ok.status).not.toBe(401)

      const unauthorized = await app.request('/api/whatever', {
        headers: { 'x-api-key': 'invalid-key' },
      })
      expect(unauthorized.status).toBe(401)
    })
  })
})
