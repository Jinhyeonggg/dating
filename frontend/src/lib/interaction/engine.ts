// frontend/src/lib/interaction/engine.ts
import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import { INTERACTION_DEFAULTS } from '@/lib/config/interaction'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { buildFirstUserMessage } from '@/lib/prompts/interaction'
import { remapHistoryForSpeaker, pickSpeaker } from './remap'
import { shouldEnd } from './endCheck'
import { createServiceClient } from '@/lib/supabase/service'
import { AppError } from '@/lib/errors'
import type { Clone, CloneMemory } from '@/types/persona'
import type { InteractionEvent } from '@/types/interaction'

export interface RunInteractionInput {
  interactionId: string
  participants: Clone[] // length 2
  memoriesByClone: Map<string, CloneMemory[]>
  scenario: {
    id: string
    label: string
    description: string
  }
  setting: string | null
  maxTurns: number
}

export interface RunInteractionResult {
  status: 'completed' | 'failed'
  turnsCompleted: number
  failureReason?: string
}

/**
 * 20턴 대화 루프. 각 턴:
 * 1. pickSpeaker → 이번 발화자 결정
 * 2. remapHistoryForSpeaker → Claude messages 포맷
 * 3. 첫 턴이면 첫 user 메시지 prepend
 * 4. callClaude → 응답 텍스트
 * 5. interaction_events INSERT (service role, RLS 우회)
 * 6. shouldEnd 검사
 */
export async function runInteraction(
  input: RunInteractionInput
): Promise<RunInteractionResult> {
  const admin = createServiceClient()
  const events: InteractionEvent[] = []
  const cloneNames = new Map(input.participants.map((c) => [c.id, c.name]))

  // 기존 이벤트 로드 (재시도 시 이어서 실행 가능하도록)
  const { data: existing } = await admin
    .from('interaction_events')
    .select('*')
    .eq('interaction_id', input.interactionId)
    .order('turn_number', { ascending: true })
  if (existing) events.push(...(existing as InteractionEvent[]))

  try {
    for (
      let turn = events.length;
      turn < input.maxTurns;
      turn++
    ) {
      const speaker = pickSpeaker(input.participants, turn)
      const listener = input.participants.find((c) => c.id !== speaker.id)!

      const persona = speaker.persona_json
      const memories = input.memoriesByClone.get(speaker.id) ?? []
      const systemPrompt = buildSystemPrompt(persona, memories)

      const history = remapHistoryForSpeaker(events, speaker.id, cloneNames)

      // 첫 턴: 시나리오 컨텍스트를 first user 메시지로
      if (turn === 0) {
        const firstUserMessage = buildFirstUserMessage({
          scenarioLabel: input.scenario.label,
          scenarioDescription: input.scenario.description,
          setting: input.setting,
          partnerName: listener.name,
          selfName: speaker.name,
        })
        history.push({ role: 'user', content: firstUserMessage })
      }

      const content = await callClaude({
        model: CLAUDE_MODELS.INTERACTION,
        system: systemPrompt,
        messages: history,
        maxTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
        temperature: 0.9,
      })

      const { data: inserted, error } = await admin
        .from('interaction_events')
        .insert({
          interaction_id: input.interactionId,
          turn_number: turn,
          speaker_clone_id: speaker.id,
          content,
        })
        .select()
        .single()

      if (error) {
        throw new AppError('INTERNAL', `event insert failed: ${error.message}`, 500)
      }
      events.push(inserted as InteractionEvent)

      if (shouldEnd(events, input.maxTurns, content)) break
    }

    return { status: 'completed', turnsCompleted: events.length }
  } catch (err) {
    const reason =
      err instanceof Error ? err.message : String(err)
    return {
      status: 'failed',
      turnsCompleted: events.length,
      failureReason: reason,
    }
  }
}
