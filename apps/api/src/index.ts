import { serve } from '@hono/node-server'
import { app } from './app.js'
import { env } from './env.js'
import { logger } from './middleware/logger.js'

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info({ port: info.port }, 'API server started')
})
