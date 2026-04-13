import { z } from 'zod'

export const relationshipMemoryItemSchema = z.object({
  topic: z.string().min(1),
  detail: z.string().min(1),
  occurred_at: z.string().min(1),
})

export const extractedRelationshipMemorySchema = z.object({
  summary: z.string().min(1),
  new_memories: z.array(relationshipMemoryItemSchema).min(1),
})

export type ValidatedRelationshipMemory = z.infer<typeof extractedRelationshipMemorySchema>
