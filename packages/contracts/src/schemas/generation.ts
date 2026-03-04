import { z } from 'zod'
import { IdSchema, TimestampsSchema } from './common.js'

export const GenerationStatusSchema = z.enum([
  'queued',
  'processing',
  'succeeded',
  'failed',
])

export const GenerationSchema = z
  .object({
    id: IdSchema,
    promptId: IdSchema,
    userId: IdSchema,
    status: GenerationStatusSchema,
    provider: z.string(),
    providerJobId: z.string().optional(),
    errorMessage: z.string().optional(),
  })
  .merge(TimestampsSchema)

export type GenerationStatus = z.infer<typeof GenerationStatusSchema>
export type Generation = z.infer<typeof GenerationSchema>
