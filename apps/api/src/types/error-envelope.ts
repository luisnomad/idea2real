// TODO: Replace with import from @idea2real/contracts once P0-CONTRACTS-1 lands
import { z } from 'zod'

export const ErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string().optional(),
  }),
})

export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>
