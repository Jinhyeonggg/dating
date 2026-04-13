export const CLAUDE_MODELS = {
  // TODO: 테스트 후 'claude-sonnet-4-6'으로 복원
  INTERACTION: 'claude-haiku-4-5-20251001',
  EXTRACTION: 'claude-haiku-4-5-20251001',
  ANALYSIS: 'claude-sonnet-4-6',
  ONBOARDING: 'claude-haiku-4-5-20251001',
  RELATIONSHIP: 'claude-haiku-4-5-20251001',
} as const

export const CLAUDE_RETRY = {
  MAX_ATTEMPTS: 3,
  INITIAL_DELAY_MS: 1000,
  BACKOFF_MULTIPLIER: 2,
} as const

export const CLAUDE_LIMITS = {
  // TODO: Sonnet 복원 시 512로 되돌리기. Haiku는 토큰을 꽉 채우는 경향
  MAX_OUTPUT_TOKENS_INTERACTION: 200,
  MAX_OUTPUT_TOKENS_EXTRACTION: 256,
  MAX_OUTPUT_TOKENS_ANALYSIS: 2048,
  MAX_OUTPUT_TOKENS_ONBOARDING: 512,
  MAX_OUTPUT_TOKENS_RELATIONSHIP: 1024,
} as const
