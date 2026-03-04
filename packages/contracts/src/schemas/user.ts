import { z } from 'zod'
import { IdSchema, TimestampsSchema } from './common.js'

export const UserSchema = z
  .object({
    id: IdSchema,
    email: z.string().email(),
    displayName: z.string().min(1).max(100),
  })
  .merge(TimestampsSchema)

export type User = z.infer<typeof UserSchema>
