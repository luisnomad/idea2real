import { z } from 'zod'
import { IdSchema, TimestampsSchema } from './common.js'

export const PrintTechSchema = z.enum(['fdm', 'resin', 'sls'])

export const PromptSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    text: z.string().min(1).max(2000),
    printTech: PrintTechSchema,
    negativePrompt: z.string().max(1000).optional(),
  })
  .merge(TimestampsSchema)

export type PrintTech = z.infer<typeof PrintTechSchema>
export type Prompt = z.infer<typeof PromptSchema>
