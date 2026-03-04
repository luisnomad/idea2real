import { createMiddleware } from 'hono/factory'

export type AppEnv = {
  Variables: {
    requestId: string
  }
}

export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID()
  c.set('requestId', id)
  c.header('x-request-id', id)
  await next()
})
