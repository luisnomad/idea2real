import { z } from 'zod'
import { IdSchema, TimestampsSchema } from './common.js'

export const AssetKindSchema = z.enum([
  'reference_image',
  'generated_image',
  'model_source',
  'model_cleaned',
  'stl_export',
])

export const AssetSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    kind: AssetKindSchema,
    mimeType: z.string(),
    storageKey: z.string(),
    fileSizeBytes: z.number().int().nonnegative(),
    parentId: IdSchema.optional(),
  })
  .merge(TimestampsSchema)

export type AssetKind = z.infer<typeof AssetKindSchema>
export type Asset = z.infer<typeof AssetSchema>
