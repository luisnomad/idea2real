import pino from 'pino'
import { createMiddleware } from 'hono/factory'
import { env } from '../env.js'
import type { AppEnv } from './request-id.js'

export const logger = pino({
  level: process.env['NODE_ENV'] === 'test' ? 'silent' : env.LOG_LEVEL,
  formatters: { level: (label) => ({ level: label }) },
})

export const requestLogger = createMiddleware<AppEnv>(async (c, next) => {
  const start = Date.now()
  await next()
  logger.info({
    requestId: c.get('requestId'),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
  })
})
