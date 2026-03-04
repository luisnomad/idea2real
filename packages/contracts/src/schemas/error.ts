import { z } from 'zod'

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
})

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>
