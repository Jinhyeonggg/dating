import type { Persona, CloneMemory } from '@/types/persona'
import { BEHAVIOR_INSTRUCTIONS } from './behavior'
import { TEXTURE_RULES } from './texture'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import { PERSONA_SECTIONS } from '@/lib/constants/personaFields'
import type { StyleCard } from '@/lib/styles/types'
import type { MoodState } from '@/lib/mood/types'
import type { WorldSnippet } from '@/lib/world/types'

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

export interface EnhancedPromptInput {
  persona: Persona
  memories?: CloneMemory[]
  textureRules?: string
  styleCards?: StyleCard[]
  mood?: MoodState
  worldSnippet?: WorldSnippet | null
}

function renderMoodHint(mood: MoodState): string {
  const labels: Record<string, string> = {
    '평온': '차분하고 평온한 상태',
    '설렘': '기대감이 있고 설레는 상태',
    '짜증': '약간 짜증나고 예민한 상태',
    '우울': '기분이 가라앉고 우울한 상태',
    '활기': '에너지가 넘치고 활발한 상태',
    '피곤': '피곤하고 말수가 적은 상태',
    '긴장': '긴장되고 조심스러운 상태',
  }
  const label = labels[mood.primary] ?? mood.primary
  return `[지금 너의 기분: ${mood.primary}(${label}). 이건 시작점일 뿐이야 — 대화하면서 자연스럽게 바뀌어도 돼.]`
}

function renderStyleCards(cards: StyleCard[]): string {
  if (cards.length === 0) return ''
  const sections = cards.map((c) => {
    let section = `--- 스타일 참고: ${c.label} ---\n${c.sample}`
    if (c.texture_notes) section += `\n(참고: ${c.texture_notes})`
    return section
  })
  return `[아래 대화 예시처럼 말해. 똑같이 따라하지 말고 톤과 리듬만 참고:]\n${sections.join('\n\n')}`
}

export function buildEnhancedSystemPrompt(input: EnhancedPromptInput): string {
  const { persona, memories, textureRules, styleCards, mood, worldSnippet } = input

  const parts: string[] = []

  // 1. Texture rules (baseline)
  if (textureRules) parts.push(textureRules)

  // 2. Persona core
  parts.push(renderPersonaCore(persona))

  // 3. Memories
  if (memories && memories.length > 0) {
    parts.push(renderRecentMemories(memories))
  }

  // 4. Mood hint (short, 1-2 lines)
  if (mood) parts.push(renderMoodHint(mood))

  // 5. Style cards (few-shot examples)
  if (styleCards && styleCards.length > 0) {
    parts.push(renderStyleCards(styleCards))
  }

  // 6. World context (optional)
  if (worldSnippet?.promptText) {
    parts.push(worldSnippet.promptText)
  }

  // 7. Behavior instructions (always last)
  parts.push(BEHAVIOR_INSTRUCTIONS)

  return parts.join('\n\n')
}

export { TEXTURE_RULES }
