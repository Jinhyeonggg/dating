// frontend/src/lib/validation/analysis.ts
import { z } from 'zod'

export const createAnalysisSchema = z.object({
  interactionId: z.string().min(1),
})

export type CreateAnalysisInput = z.infer<typeof createAnalysisSchema>
