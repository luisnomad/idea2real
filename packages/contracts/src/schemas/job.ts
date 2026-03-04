import { z } from 'zod'
import { IdSchema, TimestampsSchema } from './common.js'

export const JobTypeSchema = z.enum([
  'image_generation',
  'model_generation',
  'geometry_cleanup',
  'stl_export',
])

export const JobStatusSchema = z.enum([
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
])

export const JobSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    type: JobTypeSchema,
    status: JobStatusSchema,
    payload: z.record(z.unknown()),
    result: z.record(z.unknown()).optional(),
    errorMessage: z.string().optional(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
  })
  .merge(TimestampsSchema)

export type JobType = z.infer<typeof JobTypeSchema>
export type JobStatus = z.infer<typeof JobStatusSchema>
export type Job = z.infer<typeof JobSchema>
