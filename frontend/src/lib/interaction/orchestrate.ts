import { getAllStyleCards } from '@/lib/styles/index'
import { pickStyleCards } from '@/lib/styles/match'
import { rollMood } from '@/lib/mood/roll'
import { scoreAndSelectItems } from '@/lib/world/collect'
import { buildWorldSnippet } from '@/lib/world/inject'
import { buildEnhancedSystemPrompt } from '@/lib/prompts/persona'
import { TEXTURE_RULES } from '@/lib/prompts/texture'
import { REALISM_DEFAULTS, FEATURE_FLAGS } from '@/lib/config/interaction'
import { createServiceClient } from '@/lib/supabase/service'
import type { CloneRelationship } from '@/types/relationship'
import type { Clone, CloneMemory } from '@/types/persona'
import type { WorldSnippet as WorldSnippetType } from '@/lib/world/types'
import type { MoodState } from '@/lib/mood/types'

export interface ClonePromptContext {
  systemPrompt: string
  mood: MoodState
  styleCardIds: string[]
}

/**
 * Fetches world context rows for the given date, falling back up to WORLD_CONTEXT_FALLBACK_DAYS.
 * Gracefully returns [] if the table doesn't exist yet.
 */
async function fetchWorldContextRows(date: string) {
  const admin = createServiceClient()
  const fallbackDays = REALISM_DEFAULTS.WORLD_CONTEXT_FALLBACK_DAYS

  const fromDate = new Date(date)
  fromDate.setDate(fromDate.getDate() - fallbackDays)
  const fromStr = fromDate.toISOString().split('T')[0]

  try {
    const { data, error } = await admin
      .from('world_context')
      .select('*')
      .gte('date', fromStr)
      .lte('date', date)
      .order('date', { ascending: false })

    if (error) {
      // Table may not exist yet — treat as empty
      console.warn('[orchestrate] world_context fetch error (ignored):', error.message)
      return []
    }
    return data ?? []
  } catch (err) {
    console.warn('[orchestrate] world_context fetch threw (ignored):', err)
    return []
  }
}

export async function prepareClonePrompts(
  participants: Clone[],
  memoriesByClone: Map<string, CloneMemory[]>,
  interactionId: string,
  date: string,
): Promise<Map<string, ClonePromptContext>> {
  // 1. Load world context (shared across all clones in this interaction)
  const worldRows = await fetchWorldContextRows(date)

  const allStyleCards = getAllStyleCards()
  const result = new Map<string, ClonePromptContext>()

  // 0. Load relationship memories (if feature enabled)
  const relationshipMap = new Map<string, CloneRelationship>()
  if (FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY && participants.length === 2) {
    const adminRel = createServiceClient()
    const [a, b] = participants
    const { data: relRows } = await adminRel
      .from('clone_relationships')
      .select('*')
      .or(`and(clone_id.eq.${a.id},target_clone_id.eq.${b.id}),and(clone_id.eq.${b.id},target_clone_id.eq.${a.id})`)
    for (const row of (relRows ?? []) as CloneRelationship[]) {
      relationshipMap.set(`${row.clone_id}→${row.target_clone_id}`, row)
    }
  }

  for (const clone of participants) {
    const memories = memoriesByClone.get(clone.id) ?? []
    const persona = clone.persona_json

    // 2. Score + select world context items for this clone
    const selectedRows = scoreAndSelectItems(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      worldRows as any[],
      persona,
      memories,
      REALISM_DEFAULTS.WORLD_CONTEXT_TOP_N,
    )
    const worldSnippet: WorldSnippetType | null =
      selectedRows.length > 0 ? buildWorldSnippet(selectedRows as Parameters<typeof buildWorldSnippet>[0]) : null

    // 3. Roll mood (async Claude call, falls back to deterministic)
    const seed = `${interactionId}:${clone.id}:${date}`
    const mood = await rollMood(persona, memories, worldSnippet, seed)

    // 4. Pick style cards
    const styleCards = pickStyleCards(allStyleCards, persona, memories, mood, {
      topK: REALISM_DEFAULTS.STYLE_CARD_TOP_K,
    })

    // 5. Build enhanced system prompt
    const otherClone = participants.find((p) => p.id !== clone.id)
    const relKey = otherClone ? `${clone.id}→${otherClone.id}` : null
    const relationship = relKey ? relationshipMap.get(relKey) ?? null : null

    // 상대방 핵심 정보 추출 (역할 혼동 방지)
    const partnerHighlights = otherClone
      ? [
          otherClone.persona_json.occupation,
          otherClone.persona_json.age ? `${otherClone.persona_json.age}세` : null,
          otherClone.persona_json.mbti,
        ].filter(Boolean).join(', ')
      : ''

    const systemPrompt = buildEnhancedSystemPrompt({
      persona,
      memories,
      inferredTraits: clone.inferred_traits ?? null,
      relationshipMemory: relationship && otherClone
        ? { relationship, partnerName: otherClone.name }
        : null,
      textureRules: TEXTURE_RULES,
      styleCards,
      mood,
      worldSnippet,
      partnerContext: otherClone
        ? { name: otherClone.name, highlights: partnerHighlights }
        : null,
    })

    result.set(clone.id, {
      systemPrompt,
      mood,
      styleCardIds: styleCards.map((c) => c.id),
    })
  }

  return result
}
