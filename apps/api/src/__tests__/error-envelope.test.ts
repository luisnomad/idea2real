import { describe, it, expect } from 'vitest'
import { ErrorEnvelopeSchema } from '../types/error-envelope.js'

describe('ErrorEnvelope schema', () => {
  it('validates a minimal error envelope', () => {
    const result = ErrorEnvelopeSchema.safeParse({
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    })
    expect(result.success).toBe(true)
  })

  it('validates an envelope with optional requestId', () => {
    const result = ErrorEnvelopeSchema.safeParse({
      error: { code: 'UNAUTHORIZED', message: 'Auth failed', requestId: 'req-abc-123' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects an envelope missing the error field', () => {
    const result = ErrorEnvelopeSchema.safeParse({ message: 'oops' })
    expect(result.success).toBe(false)
  })

  it('rejects an envelope with missing code', () => {
    const result = ErrorEnvelopeSchema.safeParse({ error: { message: 'oops' } })
    expect(result.success).toBe(false)
  })

  it('rejects an envelope with missing message', () => {
    const result = ErrorEnvelopeSchema.safeParse({ error: { code: 'ERR' } })
    expect(result.success).toBe(false)
  })
})
