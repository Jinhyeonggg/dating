import type { Persona, CloneMemory } from '@/types/persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import { PERSONA_SECTIONS } from '@/lib/constants/personaFields'

export function renderPersonaCore(persona: Persona): string {
  const lines: string[] = [`이름: ${persona.name}`]

  for (const section of PERSONA_SECTIONS) {
    for (const field of section.fields) {
      if (field.key === 'name') continue
      const value = persona[field.key] as unknown
      if (value === null || value === undefined || value === '') continue
      if (Array.isArray(value)) {
        if (value.length === 0) continue
        lines.push(`${field.label}: ${value.join(', ')}`)
      } else if (typeof value === 'object') {
        continue
      } else {
        lines.push(`${field.label}: ${value}`)
      }
    }
  }

  return lines.join('\n')
}

export function renderRecentMemories(
  memories: CloneMemory[],
  limit: number = INTERACTION_DEFAULTS.MEMORY_INJECTION_LIMIT
): string {
  if (memories.length === 0) return ''

  const sorted = [...memories].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  )
  const picked = sorted.slice(0, limit)
  const lines = picked.map((m) => `- ${m.occurred_at}: ${m.content}`)
  return `최근 기억:\n${lines.join('\n')}`
}

export function buildSystemPrompt(
  persona: Persona,
  memories: CloneMemory[] = []
): string {
  const sections = [
    renderPersonaCore(persona),
    renderRecentMemories(memories),
    BEHAVIOR_INSTRUCTIONS,
  ].filter((s) => s.length > 0)
  return sections.join('\n\n')
}
