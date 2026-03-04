import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { requestId, type AppEnv } from './middleware/request-id.js'
import { requestLogger, logger } from './middleware/logger.js'
import { authStub } from './middleware/auth.js'
import { healthRoute, HealthResponseSchema } from './routes/health.js'
import { type ErrorEnvelope } from './types/error-envelope.js'
import { env } from './env.js'
import { createGenerationModule } from './modules/generation/routes.js'
import { createStubStorageAdapter } from './adapters/storage/index.js'
import { createStubFalAdapter } from './adapters/fal/index.js'

export function createApp() {
  const app = new OpenAPIHono<AppEnv>()

  app.use('*', requestId)
  app.use('*', requestLogger)

  // Public endpoint — no auth
  app.openapi(healthRoute, (c) => {
    return c.json(HealthResponseSchema.parse({ status: 'ok', version: env.VERSION }))
  })

  // OpenAPI JSON spec
  app.doc('/docs', {
    openapi: '3.0.0',
    info: { title: 'idea2real API', version: env.VERSION },
  })

  // Swagger UI
  app.get('/ui', swaggerUI({ url: '/docs' }))

  // All /api/* routes require auth
  app.use('/api/*', authStub)

  // Generation module
  const storage = createStubStorageAdapter()
  const fal = createStubFalAdapter()
  app.route('', createGenerationModule(storage, fal))

  // Global 404 — unknown routes return ErrorEnvelope
  app.notFound((c) => {
    const body: ErrorEnvelope = {
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`,
        requestId: c.get('requestId'),
      },
    }
    return c.json(body, 404)
  })

  // Global error handler — unhandled errors return ErrorEnvelope
  app.onError((err, c) => {
    logger.error({ err, requestId: c.get('requestId') }, 'Unhandled error')
    const body: ErrorEnvelope = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        requestId: c.get('requestId'),
      },
    }
    return c.json(body, 500)
  })

  return app
}

export const app = createApp()
