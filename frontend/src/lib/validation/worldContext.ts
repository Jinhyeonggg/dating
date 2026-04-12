import { z } from 'zod'
import { WORLD_CATEGORIES } from '@/lib/world/types'

export const createWorldContextSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.enum(WORLD_CATEGORIES),
  headline: z.string().min(1).max(200),
  details: z.string().max(1000).nullable().optional(),
  weight: z.number().int().min(1).max(10).optional().default(5),
})

export const copyWorldContextSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export type CreateWorldContextInput = z.input<typeof createWorldContextSchema>
export type CreateWorldContextParsed = z.output<typeof createWorldContextSchema>

export type CopyWorldContextInput = z.input<typeof copyWorldContextSchema>
export type CopyWorldContextParsed = z.output<typeof copyWorldContextSchema>
