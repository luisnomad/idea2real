import { z } from 'zod'
import { IdSchema, TimestampSchema } from '../common.js'

export const ArtifactDownloadResponseSchema = z.object({
  assetId: IdSchema,
  downloadUrl: z.string().url(),
  fileName: z.string().min(1),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  expiresAt: TimestampSchema,
})

export type ArtifactDownloadResponse = z.infer<typeof ArtifactDownloadResponseSchema>
