import { z } from 'zod'

/** UUID v4 string */
export const IdSchema = z.string().uuid()

/** ISO 8601 datetime string */
export const TimestampSchema = z.string().datetime()

/** Standard created/updated timestamps */
export const TimestampsSchema = z.object({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

/** Cursor-based pagination request */
export const PaginationRequestSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
})

/** Cursor-based pagination response metadata */
export const PaginationMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
})
