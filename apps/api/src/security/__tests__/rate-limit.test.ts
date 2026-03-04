import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createTestableRateLimiter } from '../rate-limit.js'
import { requestId, type AppEnv } from '../../middleware/request-id.js'

function createTestApp(maxRequests: number) {
  const app = new Hono<AppEnv>()
  const { middleware, clear } = createTestableRateLimiter({
    windowMs: 60_000,
    maxRequests,
  })

  app.use('*', requestId)
  app.use('*', middleware)
  app.get('/test', (c) => c.json({ ok: true }))

  return { app, clear }
}

describe('rate limiter', () => {
  it('allows requests within limit', async () => {
    const { app } = createTestApp(5)
    const res = await app.request('/test')
    expect(res.status).toBe(200)
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('4')
  })

  it('returns 429 when limit exceeded', async () => {
    const { app } = createTestApp(2)

    await app.request('/test')
    await app.request('/test')
    const res = await app.request('/test')

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('tracks remaining count correctly', async () => {
    const { app } = createTestApp(3)

    const r1 = await app.request('/test')
    expect(r1.headers.get('X-RateLimit-Remaining')).toBe('2')

    const r2 = await app.request('/test')
    expect(r2.headers.get('X-RateLimit-Remaining')).toBe('1')

    const r3 = await app.request('/test')
    expect(r3.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('includes X-RateLimit-Reset header', async () => {
    const { app } = createTestApp(5)
    const res = await app.request('/test')
    const reset = res.headers.get('X-RateLimit-Reset')
    expect(reset).toBeDefined()
    expect(Number(reset)).toBeGreaterThan(0)
  })
})
