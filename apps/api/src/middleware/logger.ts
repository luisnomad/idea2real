import pino from 'pino'
import { createMiddleware } from 'hono/factory'
import { env } from '../env.js'

export const logger = pino({
  level: process.env['NODE_ENV'] === 'test' ? 'silent' : env.LOG_LEVEL,
  formatters: { level: (label) => ({ level: label }) },
})

export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now()
  await next()
  logger.info({
    requestId: c.req.header('x-request-id'),
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    ms: Date.now() - start,
  })
})
