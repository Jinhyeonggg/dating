import type { SpeechRegister } from '@/types/relationship'

export const REALISM_DEFAULTS = {
  STYLE_CARD_TOP_K: 2,
  WORLD_CONTEXT_TOP_N: 5,
  WORLD_CONTEXT_FALLBACK_DAYS: 7,
} as const

export const INTERACTION_DEFAULTS = {
  MAX_TURNS: 15,
  MIN_RESPONSE_LENGTH: 4,
  END_SIGNAL_SHORT_TURNS_THRESHOLD: 5,
  MEMORY_INJECTION_LIMIT: 10,
  SYSTEM_PROMPT_TOKEN_BUDGET: 1500,
  HEARTBEAT_WARNING_MS: 5000,
  HEARTBEAT_DANGER_MS: 30000,
  RELATIONSHIP_MEMORY_INJECTION_LIMIT: 20,
} as const

/** 관계 기억 추출 feature flag. 런타임 설정(platform_config)으로 제어. 여기는 fallback 기본값. */
export const FEATURE_FLAGS = {
  ENABLE_RELATIONSHIP_MEMORY: true,
} as const

export const END_PROMISE_MARKER = '<promise>END</promise>'

export const CONVERSATION_MOODS = [
  {
    id: 'casual',
    label: '가벼운 대화',
    description: '일상적이고 편한 분위기',
  },
  {
    id: 'serious',
    label: '진지한 대화',
    description: '가치관, 인생관을 나누는 분위기',
  },
  {
    id: 'free',
    label: '자유 대화',
    description: '제한 없이 자연스럽게',
  },
] as const

export const RELATIONSHIP_STAGES = [
  { id: 'first-meeting', label: '처음 만나는 사이', minCount: 0, maxCount: 0 },
  { id: 'early-acquaintance', label: '몇 번 대화해 본 사이', minCount: 1, maxCount: 2 },
  { id: 'familiar', label: '여러 번 대화한 사이', minCount: 3, maxCount: Infinity },
] as const

export type RelationshipStageId = (typeof RELATIONSHIP_STAGES)[number]['id']
export type ConversationMoodId = (typeof CONVERSATION_MOODS)[number]['id']

/**
 * interaction_count 기반으로 관계 단계를 결정한다. deterministic.
 */
export function getRelationshipStage(interactionCount: number): { id: RelationshipStageId; label: string } {
  const stage = RELATIONSHIP_STAGES.find(
    (s) => interactionCount >= s.minCount && interactionCount <= s.maxCount
  )
  return stage
    ? { id: stage.id, label: stage.label }
    : { id: 'first-meeting', label: '처음 만나는 사이' }
}

export const SPEECH_REGISTERS = ['formal', 'casual', 'banmal-ready'] as const

/**
 * 나이 차이 + interaction_count 기반으로 말투 초기값 결정. deterministic.
 */
export function getSpeechRegister(
  selfAge: number | null,
  partnerAge: number | null,
  interactionCount: number,
): SpeechRegister {
  if (selfAge !== null && partnerAge !== null) {
    const diff = Math.abs(selfAge - partnerAge)
    if (diff >= 5) return 'formal'
    if (interactionCount >= 3) return 'casual'
    return 'banmal-ready'
  }
  return 'banmal-ready'
}
