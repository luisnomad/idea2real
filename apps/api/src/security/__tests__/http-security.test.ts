import { describe, expect, it } from 'vitest'
import { createApp } from '../../app.js'

describe('HTTP security middleware', () => {
  it('adds secure response headers', async () => {
    const app = createApp()
    const res = await app.request('/health')

    expect(res.status).toBe(200)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('x-frame-options')).toBe('DENY')
    expect(res.headers.get('referrer-policy')).toBe('no-referrer')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'")
  })

  it('allows preflight from an allowlisted origin', async () => {
    const app = createApp()
    const res = await app.request('/api/generations', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(res.headers.get('vary')).toContain('Origin')
  })

  it('rejects requests from disallowed origins', async () => {
    const app = createApp()
    const res = await app.request('/health', {
      headers: {
        origin: 'https://evil.example',
      },
    })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('CORS_ORIGIN_DENIED')
  })

  it('adds CORS headers to allowlisted non-preflight requests', async () => {
    const app = createApp()
    const res = await app.request('/health', {
      headers: {
        origin: 'http://127.0.0.1:5173',
      },
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
    expect(res.headers.get('vary')).toContain('Origin')
  })
})
