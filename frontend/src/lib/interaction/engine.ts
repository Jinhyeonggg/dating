// frontend/src/lib/interaction/engine.ts
import { callClaude } from '@/lib/claude'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from '@/lib/config/claude'
import { buildSystemPrompt } from '@/lib/prompts/persona'
import { buildFirstUserMessage } from '@/lib/prompts/interaction'
import { remapHistoryForSpeaker } from './remap'
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
  prebuiltPrompts?: Map<string, string>
  /** 엔진 시작 시각. 이 시각 기준으로 TIMEOUT_MS 초과 시 자동 종료 */
  startedAt?: number
  /** 런타임 설정에서 주입. 없으면 코드 상수 fallback */
  model?: string
  maxOutputTokens?: number
}

// Vercel 300초 타임아웃 전에 여유를 두고 종료 (270초)
const ENGINE_TIMEOUT_MS = 270_000

export interface RunInteractionResult {
  status: 'completed' | 'failed'
  turnsCompleted: number
  failureReason?: string
}

// 연속 발화 안전장치: 한 화자가 연속 발화할 수 있는 최대 턴 수
const MAX_CONSECUTIVE_SAME_SPEAKER = 3

/**
 * 다음 발화자 결정.
 * - 이벤트가 비어 있으면 participants[0] (첫 발화자 = 메시지 시작자)
 * - 마지막 이벤트의 next_speaker_clone_id 가 있으면 그걸 따른다
 * - 없으면 교대 (backward compat)
 * - 단, 같은 화자가 연속으로 MAX_CONSECUTIVE_SAME_SPEAKER번 말했으면 강제 교대
 */
function pickNextSpeaker(
  events: InteractionEvent[],
  participants: Clone[]
): Clone {
  if (events.length === 0) return participants[0]
  const last = events[events.length - 1]

  // 연속 발화 카운트
  let consecutive = 1
  for (let i = events.length - 2; i >= 0; i--) {
    if (events[i].speaker_clone_id === last.speaker_clone_id) consecutive++
    else break
  }

  const hinted = last.next_speaker_clone_id
  const other =
    participants.find((p) => p.id !== last.speaker_clone_id) ?? participants[0]

  if (consecutive >= MAX_CONSECUTIVE_SAME_SPEAKER) return other
  if (hinted) {
    return participants.find((p) => p.id === hinted) ?? other
  }
  return other
}

const CONTINUE_MARKER_RE = /<continue\s*\/?>/gi
const END_MARKER_RE = /<end\s*\/?>/gi

/**
 * Claude 응답에서 다음 발화자 힌트 파싱.
 * 반환: { cleanContent, wantsContinue }
 */
function parseSpeakerHint(raw: string): {
  cleanContent: string
  wantsContinue: boolean
} {
  const hasContinue = CONTINUE_MARKER_RE.test(raw)
  // Re-reset regex because /g state
  CONTINUE_MARKER_RE.lastIndex = 0
  const clean = raw.replace(CONTINUE_MARKER_RE, '').replace(END_MARKER_RE, '').trim()
  return { cleanContent: clean, wantsContinue: hasContinue }
}

/**
 * 20턴 대화 루프.
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

  const engineStart = input.startedAt ?? Date.now()

  try {
    for (let turn = events.length; turn < input.maxTurns; turn++) {
      // 타임아웃 체크: Vercel 300초 전에 안전하게 종료
      if (Date.now() - engineStart > ENGINE_TIMEOUT_MS) {
        return { status: 'completed', turnsCompleted: events.length }
      }

      const speaker = pickNextSpeaker(events, input.participants)
      const listener = input.participants.find((c) => c.id !== speaker.id)!

      const persona = speaker.persona_json
      const memories = input.memoriesByClone.get(speaker.id) ?? []
      const systemPrompt = input.prebuiltPrompts?.get(speaker.id)
        ?? buildSystemPrompt(persona, memories)

      const history = remapHistoryForSpeaker(events, speaker.id, cloneNames)

      // 첫 턴: 시나리오 컨텍스트를 first user 메시지로
      if (turn === 0) {
        // 상대방 프로필에서 관심 가질 만한 정보 추출
        const listenerPersona = listener.persona_json
        const highlights = [
          listenerPersona.occupation,
          listenerPersona.hobbies?.slice(0, 2).join(', '),
          listenerPersona.mbti,
          listenerPersona.self_description?.slice(0, 50),
        ].filter(Boolean).join(' / ')

        const firstUserMessage = buildFirstUserMessage({
          scenarioLabel: input.scenario.label,
          scenarioDescription: input.scenario.description,
          setting: input.setting,
          partnerName: listener.name,
          selfName: speaker.name,
          partnerHighlights: highlights || undefined,
        })
        history.push({ role: 'user', content: firstUserMessage })
      }

      // Claude 4.6은 assistant prefill 미지원 → 연속 발화 시
      // history가 assistant 메시지로 끝나면 continuation prompt 추가
      if (history.length > 0 && history[history.length - 1].role === 'assistant') {
        history.push({ role: 'user', content: '(이어서 말해)' })
      }

      const rawContent = await callClaude({
        model: input.model ?? CLAUDE_MODELS.INTERACTION,
        system: systemPrompt,
        messages: history,
        maxTokens: input.maxOutputTokens ?? CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
        temperature: 0.9,
      })

      const { cleanContent, wantsContinue } = parseSpeakerHint(rawContent)

      // 다음 발화자 결정
      // 연속 제한에 걸렸으면 강제 교대
      let consecutiveNow = 1
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].speaker_clone_id === speaker.id) consecutiveNow++
        else break
      }
      const forceSwitch = consecutiveNow >= MAX_CONSECUTIVE_SAME_SPEAKER
      const nextSpeakerId =
        wantsContinue && !forceSwitch ? speaker.id : listener.id

      const { data: inserted, error } = await admin
        .from('interaction_events')
        .insert({
          interaction_id: input.interactionId,
          turn_number: turn,
          speaker_clone_id: speaker.id,
          content: cleanContent,
          next_speaker_clone_id: nextSpeakerId,
        })
        .select()
        .single()

      if (error) {
        throw new AppError('INTERNAL', `event insert failed: ${error.message}`, 500)
      }
      events.push(inserted as InteractionEvent)

      if (shouldEnd(events, input.maxTurns, cleanContent)) break
    }

    return { status: 'completed', turnsCompleted: events.length }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    return {
      status: 'failed',
      turnsCompleted: events.length,
      failureReason: reason,
    }
  }
}
