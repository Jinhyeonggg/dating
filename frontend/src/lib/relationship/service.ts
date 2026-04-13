import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import {
  buildRelationshipExtractionPrompt,
  buildResummarizationPrompt,
  type RelationshipExtractionInput,
} from '@/lib/prompts/relationship'
import { parseRelationshipExtraction } from './extract'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/errors'
import type { Persona } from '@/types/persona'
import type { CloneRelationship, RelationshipMemoryItem } from '@/types/relationship'
import type { InteractionEvent } from '@/types/interaction'

function buildConversationLog(events: InteractionEvent[], cloneNames: Map<string, string>): string {
  return events
    .map((e) => `${cloneNames.get(e.speaker_clone_id) ?? '?'}: ${e.content}`)
    .join('\n')
}

function parseJsonResponse(response: string): unknown {
  // 마크다운 코드블록 제거
  let clean = response.replace(/```json\s*/gi, '').replace(/```\s*/g, '')
  const jsonStart = clean.indexOf('{')
  const jsonEnd = clean.lastIndexOf('}')
  if (jsonStart < 0 || jsonEnd < 0) {
    throw new Error('JSON 객체를 찾을 수 없음')
  }
  return JSON.parse(clean.slice(jsonStart, jsonEnd + 1))
}

async function extractForOneClone(
  selfCloneId: string,
  selfName: string,
  selfPersona: Persona,
  targetCloneId: string,
  targetName: string,
  conversationLog: string,
  existing: CloneRelationship | null,
  interactionId: string,
  interactionDate: string,
): Promise<void> {
  const input: RelationshipExtractionInput = {
    conversationLog,
    selfName,
    selfPersona,
    partnerName: targetName,
    previousSummary: existing?.summary ?? null,
    previousMemories: existing?.memories ?? [],
  }

  const prompt = buildRelationshipExtractionPrompt(input)

  const response = await callClaude({
    model: CLAUDE_MODELS.RELATIONSHIP,
    system: 'JSON으로만 응답하세요.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_RELATIONSHIP,
    temperature: 0.3,
  })

  let parsed: unknown
  try {
    parsed = parseJsonResponse(response)
  } catch (err) {
    throw new AppError(
      'LLM_ERROR',
      `관계 기억 추출 파싱 실패: ${(err as Error).message}`,
      502,
      { raw: response }
    )
  }

  const extracted = parseRelationshipExtraction(parsed)

  // 각 memory item에 interaction_id + 실제 날짜 주입
  const memoriesWithId = extracted.new_memories.map((m) => ({
    ...m,
    occurred_at: interactionDate,
    interaction_id: interactionId,
  }))

  const admin = createServiceClient()

  if (existing) {
    // 기존 row: summary 재요약 + memories append
    let finalSummary = extracted.summary

    // placeholder(interaction_count===0)면 재요약 스킵 — 바로 새 summary 사용
    const isPlaceholder = existing.interaction_count === 0
    if (!isPlaceholder && existing.summary && existing.summary !== extracted.summary) {
      const newCount = existing.interaction_count + 1
      const resummarizeResponse = await callClaude({
        model: CLAUDE_MODELS.RELATIONSHIP,
        system: 'JSON으로만 응답하세요.',
        messages: [{ role: 'user', content: buildResummarizationPrompt(
          existing.summary,
          extracted.summary,
          newCount,
        )}],
        maxTokens: 256,
        temperature: 0.2,
      })
      try {
        const resumParsed = parseJsonResponse(resummarizeResponse) as { summary?: string }
        if (typeof resumParsed.summary === 'string' && resumParsed.summary.length > 0) {
          finalSummary = resumParsed.summary
        }
      } catch {
        // 재요약 실패 시 새 summary 그대로 사용
      }
    }

    const mergedMemories: RelationshipMemoryItem[] = [
      ...existing.memories,
      ...memoriesWithId,
    ]

    const { error } = await admin
      .from('clone_relationships')
      .update({
        summary: finalSummary,
        memories: mergedMemories,
        interaction_count: existing.interaction_count + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (error) {
      console.error(`[relationship] update failed for ${selfCloneId} → ${targetCloneId}:`, error.message)
    }
  } else {
    // 신규 row
    const { error } = await admin
      .from('clone_relationships')
      .insert({
        clone_id: selfCloneId,
        target_clone_id: targetCloneId,
        interaction_count: 1,
        summary: extracted.summary,
        memories: memoriesWithId,
      })

    if (error) {
      console.error(`[relationship] insert failed for ${selfCloneId} → ${targetCloneId}:`, error.message)
    }
  }
}

/**
 * Interaction 종료 후 양방향 관계 기억 추출.
 * 두 Clone 각각의 관점에서 병렬로 추출한다.
 */
export async function extractRelationshipMemories(
  events: InteractionEvent[],
  participants: { id: string; name: string; persona_json: Persona }[],
  interactionId: string,
): Promise<void> {
  if (participants.length !== 2 || events.length === 0) return

  const interactionDate = new Date().toISOString()
  const [cloneA, cloneB] = participants
  const cloneNames = new Map<string, string>([
    [cloneA.id, cloneA.name],
    [cloneB.id, cloneB.name],
  ])
  const conversationLog = buildConversationLog(events, cloneNames)

  // 기존 관계 조회
  const admin = createServiceClient()
  const { data: existingRows } = await admin
    .from('clone_relationships')
    .select('*')
    .or(`and(clone_id.eq.${cloneA.id},target_clone_id.eq.${cloneB.id}),and(clone_id.eq.${cloneB.id},target_clone_id.eq.${cloneA.id})`)

  const existingMap = new Map<string, CloneRelationship>()
  for (const row of (existingRows ?? []) as CloneRelationship[]) {
    existingMap.set(`${row.clone_id}→${row.target_clone_id}`, row)
  }

  // 양방향 순차 추출 (병렬 시 rate limit 충돌 방지)
  const pairs: [string, string, Persona, string, string][] = [
    [cloneA.id, cloneA.name, cloneA.persona_json, cloneB.id, cloneB.name],
    [cloneB.id, cloneB.name, cloneB.persona_json, cloneA.id, cloneA.name],
  ]

  for (const [selfId, selfName, selfPersona, targetId, targetName] of pairs) {
    try {
      await extractForOneClone(
        selfId, selfName, selfPersona,
        targetId, targetName,
        conversationLog,
        existingMap.get(`${selfId}→${targetId}`) ?? null,
        interactionId,
        interactionDate,
      )
    } catch (err) {
      console.error(`[relationship] extraction failed for ${selfId}→${targetId}:`, err)
    }
  }
}
