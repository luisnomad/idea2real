import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../middleware/request-id.js'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * Simple in-memory rate limiter per IP.
 * Replace with Redis-backed implementation for production.
 */
export function rateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>()

  // Periodic cleanup to prevent memory leaks
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, config.windowMs).unref()

  return createMiddleware<AppEnv>(async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? c.req.header('x-real-ip')
      ?? 'unknown'

    const now = Date.now()
    let entry = store.get(ip)

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + config.windowMs }
      store.set(ip, entry)
    }

    entry.count++

    c.header('X-RateLimit-Limit', String(config.maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > config.maxRequests) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            requestId: c.get('requestId'),
          },
        },
        429,
      )
    }

    await next()
  })
}

// Convenience: clear store for testing
export function createTestableRateLimiter(config: RateLimitConfig) {
  const store = new Map<string, RateLimitEntry>()

  const middleware = createMiddleware<AppEnv>(async (c, next) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
      ?? c.req.header('x-real-ip')
      ?? 'unknown'

    const now = Date.now()
    let entry = store.get(ip)

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + config.windowMs }
      store.set(ip, entry)
    }

    entry.count++

    c.header('X-RateLimit-Limit', String(config.maxRequests))
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))

    if (entry.count > config.maxRequests) {
      return c.json(
        {
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            requestId: c.get('requestId'),
          },
        },
        429,
      )
    }

    await next()
  })

  return { middleware, clear: () => store.clear() }
}
