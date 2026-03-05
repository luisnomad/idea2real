import { createMiddleware } from 'hono/factory'
import type { ErrorEnvelope } from '../types/error-envelope.js'
import type { AppEnv } from './request-id.js'

const DEFAULT_USER_ID = '11111111-1111-4111-8111-111111111111'

function getRuntimeEnv() {
  return process.env['NODE_ENV'] ?? 'development'
}

function isBypassEnvironment() {
  const env = getRuntimeEnv()
  return env === 'development' || env === 'test'
}

function parseApiKeyMap() {
  const keys = new Map<string, string>()
  const raw = process.env['API_KEYS'] ?? ''
  for (const entry of raw.split(',')) {
    const [keyRaw, userIdRaw] = entry.split(':')
    const key = keyRaw?.trim()
    const userId = userIdRaw?.trim()
    if (key && userId) {
      keys.set(key, userId)
    }
  }

  const singleKey = process.env['API_KEY']?.trim()
  if (singleKey && !keys.has(singleKey)) {
    keys.set(singleKey, process.env['API_KEY_USER_ID']?.trim() || DEFAULT_USER_ID)
  }
  return keys
}

export const authStub = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === 'OPTIONS') {
    await next()
    return
  }

  const keyMap = parseApiKeyMap()
  const configuredKeys = keyMap.size > 0

  // Dev/test fallback for local iteration with no auth setup.
  if (!configuredKeys && isBypassEnvironment()) {
    c.set('userId', DEFAULT_USER_ID)
    await next()
    return
  }

  // Fail closed outside dev/test when auth is not configured.
  if (!configuredKeys) {
    const body: ErrorEnvelope = {
      error: {
        code: 'AUTH_NOT_CONFIGURED',
        message: 'API key authentication is not configured',
        requestId: c.get('requestId'),
      },
    }
    return c.json(body, 503)
  }

  const provided = c.req.header('x-api-key')
  const userId = provided ? keyMap.get(provided) : undefined
  if (!userId) {
    const body: ErrorEnvelope = {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid API key',
        requestId: c.get('requestId'),
      },
    }
    return c.json(body, 401)
  }

  c.set('userId', userId)
  await next()
})
