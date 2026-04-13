import { createServiceClient } from '@/lib/supabase/service'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from './claude'
import { INTERACTION_DEFAULTS, FEATURE_FLAGS } from './interaction'

export const INTERACTION_PRESETS = {
  economy: {
    model: 'claude-haiku-4-5-20251001' as const,
    maxTurns: 15,
    maxOutputTokens: 200,
    label: '절약 (Haiku 15턴)',
  },
  'sonnet-10': {
    model: 'claude-sonnet-4-6' as const,
    maxTurns: 10,
    maxOutputTokens: 512,
    label: 'Sonnet 10턴',
  },
  'sonnet-15': {
    model: 'claude-sonnet-4-6' as const,
    maxTurns: 15,
    maxOutputTokens: 512,
    label: 'Sonnet 15턴',
  },
  normal: {
    model: 'claude-sonnet-4-6' as const,
    maxTurns: 20,
    maxOutputTokens: 512,
    label: '정상 (Sonnet 20턴)',
  },
} as const

export type InteractionMode = keyof typeof INTERACTION_PRESETS

export interface RuntimeConfig {
  interactionMode: InteractionMode
  interactionModel: string
  maxTurns: number
  maxOutputTokens: number
  relationshipMemoryEnabled: boolean
  /** 대상 클론(A↔B) 기억 주입 */
  pairMemoryInjection: boolean
  /** 다른 클론(A↔C, A↔D...) 기억 주입 */
  otherMemoryInjection: boolean
  /** 대상 클론 기억 최대 개수 */
  pairMemoryInjectionLimit: number
  /** 다른 클론 기억 최대 개수 */
  otherMemoryInjectionLimit: number
}

/** 코드 상수 기반 fallback (DB 조회 실패 시) */
function fallbackConfig(): RuntimeConfig {
  return {
    interactionMode: 'economy',
    interactionModel: CLAUDE_MODELS.INTERACTION,
    maxTurns: INTERACTION_DEFAULTS.MAX_TURNS,
    maxOutputTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
    relationshipMemoryEnabled: FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY,
    pairMemoryInjection: true,
    otherMemoryInjection: false,
    pairMemoryInjectionLimit: 20,
    otherMemoryInjectionLimit: 0,
  }
}

/**
 * Supabase platform_config 테이블에서 런타임 설정 조회.
 * 조회 실패 시 코드 상수 fallback 반환. 에러 로깅만, UX 차단 없음.
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    const service = createServiceClient()
    const { data, error } = await service
      .from('platform_config')
      .select('key, value')
      .in('key', ['interaction_mode', 'relationship_memory_enabled', 'pair_memory_injection', 'other_memory_injection', 'pair_memory_injection_limit', 'other_memory_injection_limit'])

    if (error || !data) {
      console.warn('[runtime-config] DB fetch failed, using fallback:', error?.message)
      return fallbackConfig()
    }

    const configMap = new Map(data.map((row) => [row.key, row.value]))

    const modeRaw = configMap.get('interaction_mode')
    const mode: InteractionMode =
      typeof modeRaw === 'string' && modeRaw in INTERACTION_PRESETS ? (modeRaw as InteractionMode) : 'economy'
    const preset = INTERACTION_PRESETS[mode]

    const relMemRaw = configMap.get('relationship_memory_enabled')
    const relationshipMemoryEnabled =
      typeof relMemRaw === 'boolean' ? relMemRaw : true

    const pairInjRaw = configMap.get('pair_memory_injection')
    const pairMemoryInjection = typeof pairInjRaw === 'boolean' ? pairInjRaw : true

    const otherInjRaw = configMap.get('other_memory_injection')
    const otherMemoryInjection = typeof otherInjRaw === 'boolean' ? otherInjRaw : false

    const pairLimitRaw = configMap.get('pair_memory_injection_limit')
    const pairMemoryInjectionLimit = typeof pairLimitRaw === 'number' ? pairLimitRaw : 20

    const otherLimitRaw = configMap.get('other_memory_injection_limit')
    const otherMemoryInjectionLimit = typeof otherLimitRaw === 'number' ? otherLimitRaw : 0

    return {
      interactionMode: mode,
      interactionModel: preset.model,
      maxTurns: preset.maxTurns,
      maxOutputTokens: preset.maxOutputTokens,
      relationshipMemoryEnabled,
      pairMemoryInjection,
      otherMemoryInjection,
      pairMemoryInjectionLimit,
      otherMemoryInjectionLimit,
    }
  } catch (err) {
    console.warn('[runtime-config] Unexpected error, using fallback:', err)
    return fallbackConfig()
  }
}
