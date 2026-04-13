import type { Persona, CloneMemory } from '@/types/persona'
import type { InferredTraits } from '@/types/onboarding'
import type { CloneRelationship } from '@/types/relationship'
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

export function renderInferredTraits(traits: InferredTraits | null): string {
  if (!traits) return ''

  const lines = [
    '[AI가 파악한 성격 패턴]',
    `- 성격: ${traits.personality_summary}`,
    `- 소통: ${traits.communication_tendency}`,
    `- 사회적 스타일: ${traits.social_style}`,
  ]

  if (traits.value_priorities.length > 0) {
    lines.push(`- 가치관 우선순위: ${traits.value_priorities.join(', ')}`)
  }

  lines.push(`- 갈등 대처: ${traits.conflict_style}`)
  lines.push(`- 에너지 패턴: ${traits.energy_pattern}`)

  if (traits.conversation_topics.length > 0) {
    lines.push(`- 대화 시 즐기는 주제: ${traits.conversation_topics.join(', ')}`)
  }

  return lines.join('\n')
}

export function renderRelationshipMemory(
  relationship: CloneRelationship | null,
  partnerName: string,
  limit: number = INTERACTION_DEFAULTS.RELATIONSHIP_MEMORY_INJECTION_LIMIT,
): string {
  if (!relationship) return ''

  const lines = [
    `[이전 대화 기억 — 상대: ${partnerName}]`,
    `대화 ${relationship.interaction_count}회. ${relationship.summary}`,
  ]

  const sorted = [...relationship.memories].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at)
  )
  const picked = sorted.slice(0, limit)

  for (const m of picked) {
    lines.push(`- [${m.topic}] ${m.detail} (${m.occurred_at})`)
  }

  return lines.join('\n')
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
  inferredTraits?: InferredTraits | null
  relationshipMemory?: { relationship: CloneRelationship; partnerName: string; limit?: number } | null
  /** 다른 클론과의 관계 기억 (A↔C, A↔D, ...) */
  otherRelationshipMemories?: CloneRelationship[]
  otherMemoryLimit?: number
  textureRules?: string
  styleCards?: StyleCard[]
  mood?: MoodState
  worldSnippet?: WorldSnippet | null
  /** 대화 상대 기본 정보 — 역할 혼동 방지용 */
  partnerContext?: { name: string; highlights: string } | null
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

function renderOtherRelationshipMemories(
  relationships: CloneRelationship[],
  limit: number,
): string {
  if (relationships.length === 0 || limit <= 0) return ''

  const lines = ['[다른 사람들과의 대화 기억]']

  for (const rel of relationships) {
    if (lines.length > limit + 1) break
    const sorted = [...rel.memories].sort((a, b) =>
      b.occurred_at.localeCompare(a.occurred_at)
    )
    const picked = sorted.slice(0, limit)
    for (const m of picked) {
      if (lines.length > limit + 1) break
      lines.push(`- ${m.detail} (${m.occurred_at})`)
    }
  }

  return lines.join('\n')
}

export function buildEnhancedSystemPrompt(input: EnhancedPromptInput): string {
  const { persona, memories, inferredTraits, relationshipMemory, otherRelationshipMemories, otherMemoryLimit, textureRules, styleCards, mood, worldSnippet, partnerContext } = input

  const parts: string[] = []

  // 1. Texture rules (baseline)
  if (textureRules) parts.push(textureRules)

  // 1.5. Role context — 자신/상대 명확화
  if (partnerContext) {
    parts.push(
      `[역할]\n당신은 "${persona.name}"입니다. 위 페르소나가 당신의 정보입니다.\n상대방은 "${partnerContext.name}"입니다.${partnerContext.highlights ? ` (${partnerContext.highlights})` : ''}\n당신의 정보를 상대방의 것으로 착각하지 마세요.`
    )
  }

  // 2. Persona core
  parts.push(renderPersonaCore(persona))

  // 3. Inferred traits
  if (inferredTraits) {
    const rendered = renderInferredTraits(inferredTraits)
    if (rendered) parts.push(rendered)
  }

  // 4. Relationship memory (대상 클론)
  if (relationshipMemory) {
    const rendered = renderRelationshipMemory(
      relationshipMemory.relationship,
      relationshipMemory.partnerName,
      relationshipMemory.limit,
    )
    if (rendered) parts.push(rendered)
  }

  // 4-b. Other relationship memories (다른 클론들)
  if (otherRelationshipMemories && otherRelationshipMemories.length > 0) {
    const rendered = renderOtherRelationshipMemories(
      otherRelationshipMemories,
      otherMemoryLimit ?? 0,
    )
    if (rendered) parts.push(rendered)
  }

  // 5. Memories
  if (memories && memories.length > 0) {
    parts.push(renderRecentMemories(memories))
  }

  // 6. Mood hint (short, 1-2 lines)
  if (mood) parts.push(renderMoodHint(mood))

  // 7. Style cards (few-shot examples)
  if (styleCards && styleCards.length > 0) {
    parts.push(renderStyleCards(styleCards))
  }

  // 8. World context (optional)
  if (worldSnippet?.promptText) {
    parts.push(worldSnippet.promptText)
  }

  // 9. Behavior instructions (always last)
  parts.push(BEHAVIOR_INSTRUCTIONS)

  return parts.join('\n\n')
}

export { TEXTURE_RULES }
