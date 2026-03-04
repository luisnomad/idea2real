import { createRoute, z } from '@hono/zod-openapi'

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
})

export const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  tags: ['System'],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
      description: 'Service is healthy',
    },
  },
})
