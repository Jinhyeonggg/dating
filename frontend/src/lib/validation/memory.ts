import { z } from 'zod'

export const createMemorySchema = z.object({
  cloneId: z.string().min(1),
  rawText: z.string().min(1).max(2000),
})

export type CreateMemoryInput = z.infer<typeof createMemorySchema>
