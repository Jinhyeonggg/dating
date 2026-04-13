import { createServiceClient } from '@/lib/supabase/service'
import { CLAUDE_MODELS, CLAUDE_LIMITS } from './claude'
import { INTERACTION_DEFAULTS, FEATURE_FLAGS } from './interaction'

export const INTERACTION_PRESETS = {
  economy: {
    model: 'claude-haiku-4-5-20251001' as const,
    maxTurns: 15,
    maxOutputTokens: 200,
  },
  normal: {
    model: 'claude-sonnet-4-6' as const,
    maxTurns: 20,
    maxOutputTokens: 512,
  },
} as const

export type InteractionMode = keyof typeof INTERACTION_PRESETS

export interface RuntimeConfig {
  interactionMode: InteractionMode
  interactionModel: string
  maxTurns: number
  maxOutputTokens: number
  relationshipMemoryEnabled: boolean
}

/** 코드 상수 기반 fallback (DB 조회 실패 시) */
function fallbackConfig(): RuntimeConfig {
  return {
    interactionMode: 'economy',
    interactionModel: CLAUDE_MODELS.INTERACTION,
    maxTurns: INTERACTION_DEFAULTS.MAX_TURNS,
    maxOutputTokens: CLAUDE_LIMITS.MAX_OUTPUT_TOKENS_INTERACTION,
    relationshipMemoryEnabled: FEATURE_FLAGS.ENABLE_RELATIONSHIP_MEMORY,
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
      .in('key', ['interaction_mode', 'relationship_memory_enabled'])

    if (error || !data) {
      console.warn('[runtime-config] DB fetch failed, using fallback:', error?.message)
      return fallbackConfig()
    }

    const configMap = new Map(data.map((row) => [row.key, row.value]))

    const modeRaw = configMap.get('interaction_mode')
    const mode: InteractionMode =
      modeRaw === 'economy' || modeRaw === 'normal' ? modeRaw : 'economy'
    const preset = INTERACTION_PRESETS[mode]

    const relMemRaw = configMap.get('relationship_memory_enabled')
    const relationshipMemoryEnabled =
      typeof relMemRaw === 'boolean' ? relMemRaw : true

    return {
      interactionMode: mode,
      interactionModel: preset.model,
      maxTurns: preset.maxTurns,
      maxOutputTokens: preset.maxOutputTokens,
      relationshipMemoryEnabled,
    }
  } catch (err) {
    console.warn('[runtime-config] Unexpected error, using fallback:', err)
    return fallbackConfig()
  }
}
