import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createApp } from '../app.js'

describe('auth middleware stub', () => {
  describe('when API_KEY env var is not set (dev/test mode)', () => {
    beforeEach(() => {
      delete process.env['API_KEY']
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
      process.env['API_KEY'] = 'secret-test-key'
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
})
