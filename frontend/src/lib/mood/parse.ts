import { z } from 'zod'
import { MOOD_PRIMARIES } from './types'
import type { MoodState } from './types'

export const moodStateSchema = z.object({
  primary: z.enum(MOOD_PRIMARIES),
  energy: z.number().min(0).max(1),
  openness: z.number().min(0).max(1),
  warmth: z.number().min(0).max(1),
  reason_hint: z.string(),
})

export function parseMoodResponse(raw: string): MoodState | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return moodStateSchema.parse(parsed)
  } catch {
    return null
  }
}
