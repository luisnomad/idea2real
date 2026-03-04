import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../middleware/request-id.js'

const MAX_BODY_SIZE = 1024 * 1024 // 1MB for JSON payloads

/**
 * Validates Content-Length before processing request body.
 * Prevents memory exhaustion from oversized payloads.
 */
export const bodyLimitGuard = createMiddleware<AppEnv>(async (c, next) => {
  const contentLength = c.req.header('content-length')

  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (isNaN(size) || size > MAX_BODY_SIZE) {
      return c.json(
        {
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `Request body must not exceed ${MAX_BODY_SIZE} bytes`,
            requestId: c.get('requestId'),
          },
        },
        413,
      )
    }
  }

  await next()
})

/**
 * Validates that request Content-Type is application/json for API routes.
 * Prevents content-type confusion attacks.
 */
export const jsonOnlyGuard = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || c.req.method === 'OPTIONS') {
    return next()
  }

  const contentType = c.req.header('content-type')
  if (!contentType?.includes('application/json')) {
    return c.json(
      {
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Content-Type must be application/json',
          requestId: c.get('requestId'),
        },
      },
      415,
    )
  }

  await next()
})
