import { z } from 'zod'
import { IdSchema } from './common.js'

export const CleanupOperationSchema = z.enum([
  'remove_doubles',
  'recalc_normals',
  'manifold_repair',
  'voxel_remesh',
  'decimate',
  'flatten_base',
  'scale',
])

export const CleanupRequestSchema = z.object({
  modelId: IdSchema,
  operations: z.array(CleanupOperationSchema).min(1),
  params: z
    .object({
      voxelSize: z.number().positive().optional(),
      targetFaces: z.number().int().positive().optional(),
      scaleFactor: z.number().positive().optional(),
    })
    .optional(),
})

export const CleanupResponseSchema = z.object({
  jobId: IdSchema,
  status: z.literal('accepted'),
})

export const CleanupResultSchema = z.object({
  jobId: IdSchema,
  modelId: IdSchema,
  outputStorageKey: z.string(),
  vertexCount: z.number().int().nonnegative(),
  faceCount: z.number().int().nonnegative(),
  isManifold: z.boolean(),
  isWatertight: z.boolean(),
})

export type CleanupOperation = z.infer<typeof CleanupOperationSchema>
export type CleanupRequest = z.infer<typeof CleanupRequestSchema>
export type CleanupResponse = z.infer<typeof CleanupResponseSchema>
export type CleanupResult = z.infer<typeof CleanupResultSchema>
