import { z } from 'zod'
import { IdSchema, TimestampSchema } from '../common.js'
import { JobTypeSchema, JobStatusSchema } from '../job.js'

export const JobDetailResponseSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  type: JobTypeSchema,
  status: JobStatusSchema,
  payload: z.record(z.unknown()),
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  progress: z.number().int().min(0).max(100).optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

export type JobDetailResponse = z.infer<typeof JobDetailResponseSchema>
