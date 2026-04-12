import { MOOD_PRIMARIES, type MoodPrimary, type MoodState } from './types'
import type { Persona, CloneMemory } from '@/types/persona'

function simpleHash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function seededRandom(seed: string, index: number): number {
  const h = simpleHash(seed + ':' + index)
  return (h % 10000) / 10000
}

export function fallbackMoodRoll(
  persona: Persona,
  memories: CloneMemory[],
  seed: string,
): MoodState {
  const r0 = seededRandom(seed, 0)
  const r1 = seededRandom(seed, 1)
  const r2 = seededRandom(seed, 2)
  const r3 = seededRandom(seed, 3)

  const primaryIndex = Math.floor(r0 * MOOD_PRIMARIES.length)
  const primary: MoodPrimary = MOOD_PRIMARIES[primaryIndex]

  const energy = Math.round(r1 * 10) / 10
  const openness = Math.round(r2 * 10) / 10
  const warmth = Math.round(r3 * 10) / 10

  return {
    primary,
    energy,
    openness,
    warmth,
    reason_hint: `fallback: 랜덤 mood roll (seed: ${seed.slice(0, 8)})`,
  }
}
