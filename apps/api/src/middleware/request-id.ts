import { createMiddleware } from 'hono/factory'

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID()
  c.set('requestId' as never, id)
  c.header('x-request-id', id)
  await next()
})
