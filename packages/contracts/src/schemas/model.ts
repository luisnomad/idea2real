import { z } from 'zod'
import { IdSchema, TimestampsSchema } from './common.js'

export const ModelFormatSchema = z.enum(['glb', 'obj', 'stl', 'fbx'])

export const ModelSchema = z
  .object({
    id: IdSchema,
    generationId: IdSchema,
    userId: IdSchema,
    format: ModelFormatSchema,
    storageKey: z.string(),
    fileSizeBytes: z.number().int().nonnegative(),
    vertexCount: z.number().int().nonnegative().optional(),
    faceCount: z.number().int().nonnegative().optional(),
  })
  .merge(TimestampsSchema)

export type ModelFormat = z.infer<typeof ModelFormatSchema>
export type Model = z.infer<typeof ModelSchema>
