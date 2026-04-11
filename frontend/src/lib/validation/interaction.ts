// frontend/src/lib/validation/interaction.ts
import { z } from 'zod'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'

export const createInteractionSchema = z.object({
  participantCloneIds: z.array(z.string().uuid()).length(2),
  scenarioId: z.string().min(1),
  setting: z.string().nullable().optional(),
  maxTurns: z.number().int().min(2).max(40).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateInteractionInput = z.infer<typeof createInteractionSchema>

export const DEFAULT_MAX_TURNS = INTERACTION_DEFAULTS.MAX_TURNS
