import { createMiddleware } from 'hono/factory'
import type { ErrorEnvelope } from '../types/error-envelope.js'
import type { AppEnv } from './request-id.js'

export const authStub = createMiddleware<AppEnv>(async (c, next) => {
  // Stub: skip auth when API_KEY is not configured (dev/test mode)
  const apiKey = process.env['API_KEY']
  if (!apiKey) {
    await next()
    return
  }

  const provided = c.req.header('x-api-key')
  if (provided !== apiKey) {
    const body: ErrorEnvelope = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid API key',
        requestId: c.get('requestId'),
      },
    }
    return c.json(body, 401)
  }

  await next()
})
