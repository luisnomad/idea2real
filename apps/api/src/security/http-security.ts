import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import type { AppEnv } from '../middleware/request-id.js'
import type { ErrorEnvelope } from '../types/error-envelope.js'

const DEFAULT_CORS_ALLOWLIST = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

const DEFAULT_CORS_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
const DEFAULT_CORS_ALLOWED_HEADERS = ['Content-Type', 'X-API-Key', 'X-Request-ID']
const DEFAULT_CORS_MAX_AGE_SECONDS = 600

function parseCsv(raw: string | undefined, fallback: string[]) {
  if (!raw?.trim()) return fallback
  const values = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return values.length > 0 ? values : fallback
}

function parseBoolean(raw: string | undefined, fallback: boolean) {
  if (raw == null) return fallback
  return raw.trim().toLowerCase() === 'true'
}

function parsePositiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

const allowedOrigins = new Set(parseCsv(process.env['API_CORS_ALLOWLIST'], DEFAULT_CORS_ALLOWLIST))
const allowedMethods = parseCsv(process.env['API_CORS_ALLOWED_METHODS'], DEFAULT_CORS_ALLOWED_METHODS)
const allowedHeaders = parseCsv(process.env['API_CORS_ALLOWED_HEADERS'], DEFAULT_CORS_ALLOWED_HEADERS)
const allowCredentials = parseBoolean(process.env['API_CORS_ALLOW_CREDENTIALS'], false)
const maxAgeSeconds = parsePositiveInt(process.env['API_CORS_MAX_AGE_SECONDS'], DEFAULT_CORS_MAX_AGE_SECONDS)

function appendVary(existing: string | null, value: string) {
  if (!existing) return value
  const items = existing.split(',').map((item) => item.trim().toLowerCase())
  if (items.includes(value.toLowerCase())) return existing
  return `${existing}, ${value}`
}

function setCorsHeaders(c: Context<AppEnv>, origin: string) {
  c.header('Access-Control-Allow-Origin', origin)
  c.header('Vary', appendVary(c.res.headers.get('Vary'), 'Origin'))
  c.header('Access-Control-Allow-Methods', allowedMethods.join(', '))
  c.header('Access-Control-Allow-Headers', allowedHeaders.join(', '))
  c.header('Access-Control-Max-Age', String(maxAgeSeconds))
  if (allowCredentials) {
    c.header('Access-Control-Allow-Credentials', 'true')
  }
}

export const corsAllowlist = createMiddleware<AppEnv>(async (c, next) => {
  const origin = c.req.header('origin')
  if (!origin) {
    await next()
    return
  }

  if (!allowedOrigins.has(origin)) {
    const body: ErrorEnvelope = {
      error: {
        code: 'CORS_ORIGIN_DENIED',
        message: 'Origin is not allowed',
        requestId: c.get('requestId'),
      },
    }
    return c.json(body, 403)
  }

  if (c.req.method === 'OPTIONS') {
    setCorsHeaders(c, origin)
    return c.body(null, 204)
  }

  await next()
  setCorsHeaders(c, origin)
})

const DEFAULT_CONTENT_SECURITY_POLICY =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'"

const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': process.env['API_CONTENT_SECURITY_POLICY'] ?? DEFAULT_CONTENT_SECURITY_POLICY,
}

export const responseSecurityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next()
  for (const [headerName, headerValue] of Object.entries(securityHeaders)) {
    if (!c.res.headers.has(headerName)) {
      c.header(headerName, headerValue)
    }
  }
})
