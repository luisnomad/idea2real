import { z } from 'zod'
import { IdSchema, TimestampSchema } from '../common.js'

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB

export const UploadRequestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.enum(ALLOWED_IMAGE_MIME_TYPES),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
})

export const UploadResponseSchema = z.object({
  assetId: IdSchema,
  uploadUrl: z.string().url(),
  expiresAt: TimestampSchema,
})

export type UploadRequest = z.infer<typeof UploadRequestSchema>
export type UploadResponse = z.infer<typeof UploadResponseSchema>
