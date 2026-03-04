import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { requestId } from './middleware/request-id.js'
import { requestLogger } from './middleware/logger.js'
import { authStub } from './middleware/auth.js'
import { healthRoute, HealthResponseSchema } from './routes/health.js'
import { env } from './env.js'

type Variables = {
  requestId: string
}

export function createApp() {
  const app = new OpenAPIHono<{ Variables: Variables }>()

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

  return app
}

export const app = createApp()
