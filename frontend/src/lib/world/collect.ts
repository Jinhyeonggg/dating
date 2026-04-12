import type { WorldContextRow } from './types'
import type { Persona, CloneMemory } from '@/types/persona'

export function scoreAndSelectItems(
  rows: WorldContextRow[],
  persona: Persona | null,
  memories: CloneMemory[],
  topN: number,
): WorldContextRow[] {
  if (rows.length === 0) return []

  const personaKeywords = [
    ...(persona?.hobbies ?? []),
    ...(persona?.tags ?? []),
    ...(persona?.core_values ?? []),
  ].map((k) => k.toLowerCase())

  const memoryKeywords = memories
    .flatMap((m) => m.tags)
    .map((k) => k.toLowerCase())

  const allKeywords = [...personaKeywords, ...memoryKeywords]

  const scored = rows.map((row) => {
    let score = row.weight
    if (allKeywords.length > 0) {
      const combined = (row.headline + ' ' + (row.details ?? '')).toLowerCase()
      const overlap = allKeywords.filter((kw) => combined.includes(kw)).length
      score += overlap * 3
    }
    return { row, score }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topN).map((s) => s.row)
}
