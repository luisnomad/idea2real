import { z } from 'zod'
import { IdSchema, TimestampSchema, PaginationMetaSchema } from '../common.js'
import { GenerationStatusSchema } from '../generation.js'
import { AssetKindSchema } from '../asset.js'

export const CreateGenerationRequestSchema = z.object({
  imageAssetId: IdSchema,
  provider: z.string().min(1),
  params: z.record(z.unknown()).optional(),
})

export const CreateGenerationResponseSchema = z.object({
  generationId: IdSchema,
  jobId: IdSchema,
  status: GenerationStatusSchema,
})

export const GenerationArtifactSchema = z.object({
  id: IdSchema,
  kind: AssetKindSchema,
  mimeType: z.string(),
  storageKey: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  downloadUrl: z.string().url(),
})

export const GenerationDetailResponseSchema = z.object({
  id: IdSchema,
  promptId: IdSchema,
  userId: IdSchema,
  status: GenerationStatusSchema,
  provider: z.string(),
  providerJobId: z.string().optional(),
  errorMessage: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  artifacts: z.array(GenerationArtifactSchema),
})

export const ListGenerationsRequestSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  status: GenerationStatusSchema.optional(),
})

export const ListGenerationsResponseSchema = z.object({
  items: z.array(
    z.object({
      id: IdSchema,
      promptId: IdSchema,
      userId: IdSchema,
      status: GenerationStatusSchema,
      provider: z.string(),
      providerJobId: z.string().optional(),
      errorMessage: z.string().optional(),
      createdAt: TimestampSchema,
      updatedAt: TimestampSchema,
    })
  ),
  pagination: PaginationMetaSchema,
})

export type CreateGenerationRequest = z.infer<typeof CreateGenerationRequestSchema>
export type CreateGenerationResponse = z.infer<typeof CreateGenerationResponseSchema>
export type GenerationArtifact = z.infer<typeof GenerationArtifactSchema>
export type GenerationDetailResponse = z.infer<typeof GenerationDetailResponseSchema>
export type ListGenerationsRequest = z.infer<typeof ListGenerationsRequestSchema>
export type ListGenerationsResponse = z.infer<typeof ListGenerationsResponseSchema>
